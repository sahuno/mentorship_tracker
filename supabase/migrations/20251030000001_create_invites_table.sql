-- Migration: Create Invites Table for Program Enrollment
-- Date: 2025-10-30
-- Description: Implements invite system for manager-driven enrollment
-- Allows managers to invite participants who don't have accounts yet

-- ============================================================================
-- STEP 1: Create invites table
-- ============================================================================
CREATE TABLE IF NOT EXISTS invites (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  program_id UUID REFERENCES programs(id) ON DELETE CASCADE NOT NULL,
  email TEXT NOT NULL,
  invite_code TEXT UNIQUE DEFAULT gen_random_uuid()::TEXT NOT NULL,
  invited_by UUID REFERENCES profiles(id),
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'expired')) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  accepted_at TIMESTAMPTZ,
  accepted_by UUID REFERENCES profiles(id),
  expires_at TIMESTAMPTZ DEFAULT now() + interval '30 days' NOT NULL
);

-- ============================================================================
-- STEP 2: Create indexes for faster lookups
-- ============================================================================
CREATE INDEX idx_invites_email ON invites(email);
CREATE INDEX idx_invites_code ON invites(invite_code);
CREATE INDEX idx_invites_status ON invites(status);
CREATE INDEX idx_invites_program ON invites(program_id);
CREATE INDEX idx_invites_expires ON invites(expires_at);

-- Add unique constraint to prevent duplicate pending invites
CREATE UNIQUE INDEX idx_invites_unique_pending
  ON invites(program_id, email, status)
  WHERE status = 'pending';

-- ============================================================================
-- STEP 3: Enable Row Level Security
-- ============================================================================
ALTER TABLE invites ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- STEP 4: Create RLS Policies
-- ============================================================================

-- Policy 1: Managers can view invites for their programs
CREATE POLICY "Managers can view program invites"
  ON invites FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM programs
      WHERE programs.id = invites.program_id
      AND programs.manager_id = auth.uid()
    )
  );

-- Policy 2: Managers can create invites for their programs
CREATE POLICY "Managers can create invites"
  ON invites FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM programs
      WHERE programs.id = program_id
      AND programs.manager_id = auth.uid()
    )
  );

-- Policy 3: Managers can update invites for their programs (e.g., cancel)
CREATE POLICY "Managers can update program invites"
  ON invites FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM programs
      WHERE programs.id = invites.program_id
      AND programs.manager_id = auth.uid()
    )
  );

-- Policy 4: Public can view invite by code (for signup page)
-- This is intentionally permissive - anyone with the invite code can view it
CREATE POLICY "Public can view invite by code"
  ON invites FOR SELECT
  USING (true);

-- ============================================================================
-- STEP 5: Create function to accept an invite
-- ============================================================================
CREATE OR REPLACE FUNCTION accept_invite(
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
  v_already_enrolled BOOLEAN;
BEGIN
  -- Get the invite
  SELECT * INTO v_invite
  FROM invites
  WHERE invite_code = p_invite_code
  AND status = 'pending'
  AND expires_at > now();

  -- Invite not found or expired
  IF NOT FOUND THEN
    RETURN FALSE;
  END IF;

  -- Check if user is already enrolled in the program
  SELECT EXISTS (
    SELECT 1
    FROM program_participants
    WHERE program_id = v_invite.program_id
    AND participant_id = p_user_id
  ) INTO v_already_enrolled;

  -- If already enrolled, just mark invite as accepted
  IF v_already_enrolled THEN
    UPDATE invites
    SET
      status = 'accepted',
      accepted_at = now(),
      accepted_by = p_user_id
    WHERE id = v_invite.id;

    RETURN TRUE;
  END IF;

  -- Update invite status
  UPDATE invites
  SET
    status = 'accepted',
    accepted_at = now(),
    accepted_by = p_user_id
  WHERE id = v_invite.id;

  -- Add participant to program
  INSERT INTO program_participants (
    program_id,
    participant_id,
    status,
    enrolled_at
  ) VALUES (
    v_invite.program_id,
    p_user_id,
    'active',
    now()
  );

  RETURN TRUE;
EXCEPTION
  WHEN OTHERS THEN
    -- Log error but don't fail the function
    RAISE WARNING 'Error accepting invite %: %', p_invite_code, SQLERRM;
    RETURN FALSE;
END;
$$;

-- ============================================================================
-- STEP 6: Create function to cleanup expired invites (optional)
-- ============================================================================
CREATE OR REPLACE FUNCTION cleanup_expired_invites()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_count INTEGER;
BEGIN
  -- Mark expired invites
  UPDATE invites
  SET status = 'expired'
  WHERE status = 'pending'
  AND expires_at < now();

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

-- ============================================================================
-- STEP 7: Create trigger to set invited_by automatically
-- ============================================================================
CREATE OR REPLACE FUNCTION set_invited_by()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Set invited_by to current user if not specified
  IF NEW.invited_by IS NULL THEN
    NEW.invited_by := auth.uid();
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER set_invited_by_trigger
  BEFORE INSERT ON invites
  FOR EACH ROW
  EXECUTE FUNCTION set_invited_by();

-- ============================================================================
-- STEP 8: Grant necessary permissions
-- ============================================================================
GRANT SELECT, INSERT, UPDATE ON invites TO authenticated;

-- Allow calling the accept_invite function
GRANT EXECUTE ON FUNCTION accept_invite(TEXT, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION accept_invite(TEXT, UUID) TO anon;

-- ============================================================================
-- STEP 9: Add comments for documentation
-- ============================================================================
COMMENT ON TABLE invites IS
  'Stores program enrollment invitations for users who do not yet have accounts';

COMMENT ON COLUMN invites.invite_code IS
  'Unique code used in signup URLs to auto-enroll participants';

COMMENT ON COLUMN invites.expires_at IS
  'Invites expire after 30 days by default';

COMMENT ON FUNCTION accept_invite(TEXT, UUID) IS
  'Accepts an invite and enrolls the user in the program. Returns TRUE on success.';

COMMENT ON FUNCTION cleanup_expired_invites() IS
  'Marks all expired pending invites as expired. Returns count of updated records.';

-- ============================================================================
-- VERIFICATION QUERIES (Run these manually to test)
-- ============================================================================

-- Test 1: Check table was created
-- SELECT * FROM invites LIMIT 1;

-- Test 2: Check indexes exist
-- SELECT indexname FROM pg_indexes WHERE tablename = 'invites';

-- Test 3: Check RLS is enabled
-- SELECT relname, relrowsecurity FROM pg_class WHERE relname = 'invites';

-- Test 4: List all policies
-- SELECT * FROM pg_policies WHERE tablename = 'invites';

-- ============================================================================
-- ROLLBACK INSTRUCTIONS (if needed)
-- ============================================================================
-- To rollback this migration, run:
-- DROP TRIGGER IF EXISTS set_invited_by_trigger ON invites;
-- DROP FUNCTION IF EXISTS set_invited_by();
-- DROP FUNCTION IF EXISTS cleanup_expired_invites();
-- DROP FUNCTION IF EXISTS accept_invite(TEXT, UUID);
-- DROP TABLE IF EXISTS invites CASCADE;
