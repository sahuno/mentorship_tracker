-- ============================================================================
-- Migration: RLS Policies for Role-Based Invitations
-- Date: 2025-11-30
-- Author: Samuel Ahuno (ekwame001@gmail.com)
-- Purpose: Secure invitation creation based on user roles
-- ============================================================================

-- First, drop existing invite policies to avoid conflicts
DROP POLICY IF EXISTS "Managers can create invites" ON invites;
DROP POLICY IF EXISTS "Managers can view their invites" ON invites;
DROP POLICY IF EXISTS "Anyone can view invite by code" ON invites;
DROP POLICY IF EXISTS "Admins can create role invites" ON invites;
DROP POLICY IF EXISTS "Admins can view all invites" ON invites;
DROP POLICY IF EXISTS "Managers can view own invites" ON invites;

-- ============================================================================
-- INSERT Policies - Who can create invites
-- ============================================================================

-- Policy 1: Admins can create any type of invite (admin, manager, participant)
CREATE POLICY "Admins can create any invite"
  ON invites FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- Policy 2: Managers can only create participant invites for their programs
CREATE POLICY "Managers can create participant invites"
  ON invites FOR INSERT
  WITH CHECK (
    -- Must be a manager
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'program_manager'
    )
    AND
    -- Target role must be participant
    target_role = 'participant'
    AND
    -- Must be for a program they manage
    (
      program_id IS NULL
      OR
      EXISTS (
        SELECT 1 FROM programs
        WHERE programs.id = program_id
        AND programs.manager_id = auth.uid()
      )
    )
  );

-- ============================================================================
-- SELECT Policies - Who can view invites
-- ============================================================================

-- Policy 3: Admins can view all invites
CREATE POLICY "Admins can view all invites"
  ON invites FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- Policy 4: Managers can view invites they created
CREATE POLICY "Managers can view own invites"
  ON invites FOR SELECT
  USING (invited_by = auth.uid());

-- Policy 5: Managers can view invites for their programs
CREATE POLICY "Managers can view program invites"
  ON invites FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM programs
      WHERE programs.id = invites.program_id
      AND programs.manager_id = auth.uid()
    )
  );

-- Policy 6: Anyone can view invite details by invite code (for signup flow)
-- This allows the signup page to display invite info
CREATE POLICY "Anyone can view invite by code for signup"
  ON invites FOR SELECT
  USING (
    -- Only pending invites that haven't expired
    status = 'pending'
    AND expires_at > NOW()
  );

-- ============================================================================
-- UPDATE Policies - Who can modify invites
-- ============================================================================

-- Policy 7: Admins can update any invite
CREATE POLICY "Admins can update any invite"
  ON invites FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- Policy 8: Managers can update invites they created
CREATE POLICY "Managers can update own invites"
  ON invites FOR UPDATE
  USING (invited_by = auth.uid());

-- Policy 9: System can update invite status (for trigger)
-- Note: The trigger runs with SECURITY DEFINER so it bypasses RLS

-- ============================================================================
-- DELETE Policies - Who can delete/cancel invites
-- ============================================================================

-- Policy 10: Admins can delete any invite
CREATE POLICY "Admins can delete any invite"
  ON invites FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- Policy 11: Managers can delete invites they created
CREATE POLICY "Managers can delete own invites"
  ON invites FOR DELETE
  USING (invited_by = auth.uid());

-- ============================================================================
-- Verification
-- ============================================================================
-- Check policies: SELECT * FROM pg_policies WHERE tablename = 'invites';
