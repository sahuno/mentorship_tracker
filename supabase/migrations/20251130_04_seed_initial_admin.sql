-- ============================================================================
-- Migration: Seed Initial Admin Account
-- Date: 2025-11-30
-- Author: Samuel Ahuno (ekwame001@gmail.com)
-- Purpose: Create the first admin invitation for bootstrapping the system
-- ============================================================================

-- IMPORTANT: Change this email to your actual admin email before running!
-- The person with this email will become the system administrator when they sign up.

-- Create admin invitation
-- When someone signs up with this email, they'll automatically get admin role
INSERT INTO invites (
  id,
  program_id,
  email,
  target_role,
  invitee_name,
  invited_by,
  status,
  expires_at,
  created_at,
  updated_at
) VALUES (
  gen_random_uuid(),
  NULL,  -- No program association for admin invite
  'ekwame001@gmail.com',  -- CHANGE THIS to your admin email
  'admin',
  'System Administrator',
  NULL,  -- No inviter (system-generated)
  'pending',
  NOW() + INTERVAL '365 days',  -- Long expiry for initial setup
  NOW(),
  NOW()
)
ON CONFLICT (email) WHERE status = 'pending'
DO UPDATE SET
  target_role = 'admin',
  expires_at = NOW() + INTERVAL '365 days',
  updated_at = NOW();

-- ============================================================================
-- Optional: Create additional initial invites
-- Uncomment and modify as needed
-- ============================================================================

-- Example: Create a program manager invite
-- INSERT INTO invites (id, program_id, email, target_role, invitee_name, status, expires_at, created_at, updated_at)
-- VALUES (
--   gen_random_uuid(),
--   NULL,
--   'manager@goldenbridge.org',
--   'program_manager',
--   'Program Manager',
--   'pending',
--   NOW() + INTERVAL '30 days',
--   NOW(),
--   NOW()
-- ) ON CONFLICT DO NOTHING;

-- ============================================================================
-- Verification
-- ============================================================================
-- Check created invite: SELECT * FROM invites WHERE target_role = 'admin';

-- ============================================================================
-- NOTES:
-- 1. After running this migration, the specified email can sign up
-- 2. The signup process will automatically assign them the 'admin' role
-- 3. Once signed up, they can invite other admins and managers via the UI
-- 4. This invite expires in 365 days - if not used, re-run or create new invite
-- ============================================================================
