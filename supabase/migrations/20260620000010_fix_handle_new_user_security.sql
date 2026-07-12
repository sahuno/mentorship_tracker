-- ============================================================================
-- Migration: Restore secure profile-creation trigger
-- Date: 2026-06-20
-- Purpose:
--   Fix a privilege-escalation regression introduced by 20260620_05, which
--   derived the new profile's role from client-controlled signup metadata
--   (raw_user_meta_data->>'role') and matched invites by code only. Anyone
--   could self-signup with { role: 'admin' } and become an admin.
--
--   This restores the secure model from 20260620_01:
--     * Role defaults to 'participant' and is NEVER read from client metadata.
--     * Elevated roles come ONLY from a pending invite matched by the new
--       user's email address (invites for elevated roles can only be created
--       by an admin, per invite RLS).
--     * Enrollment happens via accept_invite() on the email-matched invite, so
--       it works without the client sending an invite_code at signup.
--
--   It also populates profiles.email (the column added by 20260620_05), which
--   the 20260620_01 version predated.
--
--   Because 20260620_05 already applied successfully to the database, this
--   forward migration is required to correct the live function (editing _05 in
--   place would not re-run it). CREATE OR REPLACE makes this idempotent and
--   last-wins on a fresh reset as well.
-- ============================================================================

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

  -- SECURITY: role is derived ONLY from a pending invite matched by email.
  -- raw_user_meta_data->>'role' is client-controlled and is deliberately
  -- ignored to prevent privilege escalation via signup.
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

  INSERT INTO public.profiles (id, name, email, role, phone, created_at, updated_at)
  VALUES (
    NEW.id,
    user_name,
    NEW.email,
    final_role,
    user_phone,
    NOW(),
    NOW()
  )
  ON CONFLICT (id) DO UPDATE
  SET
    name = EXCLUDED.name,
    email = EXCLUDED.email,
    -- Only change an existing profile's role when this signup carries an
    -- invite; otherwise preserve whatever role the profile already has (never
    -- silently downgrade an admin/manager on a re-fired insert).
    role = CASE WHEN has_invite THEN final_role ELSE public.profiles.role END,
    phone = EXCLUDED.phone,
    updated_at = NOW();

  IF has_invite THEN
    PERFORM public.accept_invite(invite_record.invite_code, NEW.id);
  END IF;

  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    -- Never let a profile-creation error abort the auth.users insert; degrade
    -- to a default profile and log instead.
    RAISE WARNING 'Failed to create profile for user %: %', NEW.id, SQLERRM;
    RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.handle_new_user() IS
'Creates a profile on auth signup. Role defaults to participant and is only elevated by a pending invite matched on the user email; client-supplied role metadata is ignored to prevent privilege escalation.';
