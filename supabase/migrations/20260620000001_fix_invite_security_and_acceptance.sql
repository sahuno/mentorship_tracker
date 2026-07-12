-- ============================================================================
-- Migration: Fix invite lookup security and invite acceptance
-- Date: 2026-06-20
-- Purpose:
--   1. Remove broad public invite SELECT access.
--   2. Add a safe invite-code lookup RPC for signup screens.
--   3. Replace handle_new_user so invited users get profiles and enrollments.
--   4. Make accept_invite idempotent for the same invited user.
-- ============================================================================

-- Remove broad public invite lookup policies from earlier migrations.
DROP POLICY IF EXISTS "Public can view invite by code" ON invites;
DROP POLICY IF EXISTS "Anyone can view invite by code" ON invites;
DROP POLICY IF EXISTS "Anyone can view invite by code for signup" ON invites;

-- Backups may come from before role-based invite columns were added.
ALTER TABLE invites
ADD COLUMN IF NOT EXISTS target_role TEXT
DEFAULT 'participant'
CHECK (target_role IN ('participant', 'program_manager', 'admin'));

ALTER TABLE invites
ADD COLUMN IF NOT EXISTS invitee_name TEXT;

ALTER TABLE invites
ALTER COLUMN program_id DROP NOT NULL;

-- Ensure anonymous clients cannot select directly from invites. Signup screens
-- should use get_invite_by_code() instead.
REVOKE SELECT ON invites FROM anon;

-- Safe invite lookup for signup screens. This still reveals invite details to
-- anyone with the code, but it prevents listing all pending invites.
CREATE OR REPLACE FUNCTION public.get_invite_by_code(p_invite_code TEXT)
RETURNS TABLE (
  invite_code TEXT,
  email TEXT,
  invitee_name TEXT,
  target_role TEXT,
  expires_at TIMESTAMPTZ,
  program_id UUID,
  program_name TEXT,
  program_description TEXT,
  program_start_date DATE,
  program_end_date DATE
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    i.invite_code,
    i.email,
    i.invitee_name,
    i.target_role,
    i.expires_at,
    p.id AS program_id,
    p.name AS program_name,
    p.description AS program_description,
    p.start_date AS program_start_date,
    p.end_date AS program_end_date
  FROM invites i
  LEFT JOIN programs p ON p.id = i.program_id
  WHERE i.invite_code = p_invite_code
    AND i.status = 'pending'
    AND i.expires_at > NOW()
  LIMIT 1;
$$;

GRANT EXECUTE ON FUNCTION public.get_invite_by_code(TEXT) TO anon;
GRANT EXECUTE ON FUNCTION public.get_invite_by_code(TEXT) TO authenticated;

-- Accept an invite and enroll the user when it is a program invite. This is
-- intentionally idempotent for the same user so the signup trigger and frontend
-- can both call it without creating duplicate enrollments.
CREATE OR REPLACE FUNCTION public.accept_invite(
  p_invite_code TEXT,
  p_user_id UUID
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_invite RECORD;
  v_user_email TEXT;
BEGIN
  IF auth.uid() IS NOT NULL AND auth.uid() <> p_user_id THEN
    RETURN FALSE;
  END IF;

  SELECT LOWER(email) INTO v_user_email
  FROM auth.users
  WHERE id = p_user_id;

  IF v_user_email IS NULL THEN
    RETURN FALSE;
  END IF;

  SELECT * INTO v_invite
  FROM invites
  WHERE invite_code = p_invite_code
    AND LOWER(email) = v_user_email
    AND expires_at > NOW()
    AND (
      status = 'pending'
      OR (status = 'accepted' AND accepted_by = p_user_id)
    )
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN FALSE;
  END IF;

  -- A user cannot accept someone else's already-accepted invite.
  IF v_invite.status = 'accepted' AND v_invite.accepted_by IS DISTINCT FROM p_user_id THEN
    RETURN FALSE;
  END IF;

  IF v_invite.program_id IS NOT NULL THEN
    INSERT INTO program_participants (
      program_id,
      participant_id,
      status,
      enrolled_at
    ) VALUES (
      v_invite.program_id,
      p_user_id,
      'active',
      NOW()
    )
    ON CONFLICT (program_id, participant_id)
    DO UPDATE SET status = 'active';
  END IF;

  UPDATE invites
  SET
    status = 'accepted',
    accepted_at = COALESCE(accepted_at, NOW()),
    accepted_by = COALESCE(accepted_by, p_user_id)
  WHERE id = v_invite.id;

  RETURN TRUE;
EXCEPTION
  WHEN OTHERS THEN
    RAISE WARNING 'Error accepting invite % for user %: %', p_invite_code, p_user_id, SQLERRM;
  RETURN FALSE;
END;
$$;

REVOKE ALL ON FUNCTION public.accept_invite(TEXT, UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.accept_invite(TEXT, UUID) FROM anon;
GRANT EXECUTE ON FUNCTION public.accept_invite(TEXT, UUID) TO authenticated;

-- Replace the profile creation trigger. The earlier version updated
-- invites.updated_at, but invites has no updated_at column in the visible schema.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  invite_record RECORD;
  final_role TEXT := 'participant';
  user_email TEXT;
  user_name TEXT;
  user_phone TEXT;
  has_invite BOOLEAN := FALSE;
BEGIN
  user_email := LOWER(NEW.email);
  user_name := COALESCE(NEW.raw_user_meta_data->>'name', 'New User');
  user_phone := NEW.raw_user_meta_data->>'phone';

  SELECT * INTO invite_record
  FROM invites
  WHERE LOWER(email) = user_email
    AND status = 'pending'
    AND expires_at > NOW()
  ORDER BY created_at DESC
  LIMIT 1;

  IF FOUND THEN
    has_invite := TRUE;
    final_role := COALESCE(invite_record.target_role, 'participant');
  END IF;

  INSERT INTO public.profiles (id, name, role, phone, created_at, updated_at)
  VALUES (
    NEW.id,
    user_name,
    final_role,
    user_phone,
    NOW(),
    NOW()
  )
  ON CONFLICT (id) DO UPDATE
  SET
    name = EXCLUDED.name,
    role = EXCLUDED.role,
    phone = EXCLUDED.phone,
    updated_at = NOW();

  IF has_invite THEN
    PERFORM public.accept_invite(invite_record.invite_code, NEW.id);
  END IF;

  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    RAISE WARNING 'Failed to create profile for user %: %', NEW.id, SQLERRM;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

COMMENT ON FUNCTION public.get_invite_by_code(TEXT) IS
'Returns safe pending invite details for a specific invite code. Prevents public listing of all pending invites.';

COMMENT ON FUNCTION public.accept_invite(TEXT, UUID) IS
'Idempotently accepts an invite for a user and enrolls them in the invite program when present.';

-- Participants need to create and activate their own cycles. The initial schema
-- only granted participant SELECT on balance_cycles, which blocks the migrated
-- participant finance flow.
DROP POLICY IF EXISTS "Participants can create own cycles" ON balance_cycles;
DROP POLICY IF EXISTS "Participants can update own cycles" ON balance_cycles;

CREATE POLICY "Participants can create own cycles" ON balance_cycles
  FOR INSERT
  WITH CHECK (
    participant_id = auth.uid()
    AND EXISTS (
      SELECT 1
      FROM program_participants pp
      WHERE pp.program_id = balance_cycles.program_id
        AND pp.participant_id = auth.uid()
        AND pp.status = 'active'
    )
  );

CREATE POLICY "Participants can update own cycles" ON balance_cycles
  FOR UPDATE
  USING (participant_id = auth.uid())
  WITH CHECK (participant_id = auth.uid());
