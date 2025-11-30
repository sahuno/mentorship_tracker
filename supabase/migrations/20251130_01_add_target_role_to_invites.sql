-- ============================================================================
-- Migration: Add target_role to invites table
-- Date: 2025-11-30
-- Author: Samuel Ahuno (ekwame001@gmail.com)
-- Purpose: Enable invitation-based role assignment
-- ============================================================================

-- Add target_role column to invites table
-- This determines what role the user gets when they accept the invite
ALTER TABLE invites
ADD COLUMN IF NOT EXISTS target_role TEXT
DEFAULT 'participant'
CHECK (target_role IN ('participant', 'program_manager', 'admin'));

-- Add invitee_name for display purposes (optional field)
ALTER TABLE invites
ADD COLUMN IF NOT EXISTS invitee_name TEXT;

-- Ensure invited_by column exists and references profiles
-- (May already exist from previous migration)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'invites' AND column_name = 'invited_by'
  ) THEN
    ALTER TABLE invites ADD COLUMN invited_by UUID REFERENCES profiles(id);
  END IF;
END $$;

-- Make program_id nullable for role-only invites (admin/manager invites without program)
ALTER TABLE invites
ALTER COLUMN program_id DROP NOT NULL;

-- Create index for faster role-based lookups
CREATE INDEX IF NOT EXISTS idx_invites_target_role ON invites(target_role);
CREATE INDEX IF NOT EXISTS idx_invites_status ON invites(status);

-- Add comments for documentation
COMMENT ON COLUMN invites.target_role IS 'The role to assign when this invite is accepted (participant, program_manager, admin)';
COMMENT ON COLUMN invites.invitee_name IS 'Optional name of the person being invited for display purposes';
COMMENT ON COLUMN invites.invited_by IS 'UUID of the user who created this invitation';

-- ============================================================================
-- Verification
-- ============================================================================
-- Run this to verify: SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'invites';
