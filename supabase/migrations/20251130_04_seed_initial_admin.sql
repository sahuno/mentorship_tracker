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
--
-- IDEMPOTENT / REPLAY-SAFE:
-- Previously this migration did DELETE-pending + blind INSERT. On any re-run that
-- (a) minted a NEW invite_code, invalidating any link already distributed, and
-- (b) re-created a fresh 365-day pending admin invite even if the admin had
-- already accepted their invite -- effectively re-opening a completed invite.
--
-- The unique index idx_invites_unique_pending is ON (program_id, email, status)
-- WHERE status = 'pending'. Because admin invites have program_id = NULL and
-- Postgres treats NULLs as distinct in unique indexes, that index does NOT
-- prevent duplicate pending admin invites, so ON CONFLICT cannot be relied on
-- here. Instead we guard with a NOT EXISTS check.
--
-- We only insert a pending admin invite when there is NOT already a pending OR
-- accepted admin invite for this email. This preserves an existing invite_code
-- on re-run and never clobbers or re-opens an already-accepted invite.
INSERT INTO invites (
  id,
  program_id,
  email,
  target_role,
  invitee_name,
  invited_by,
  status,
  expires_at,
  created_at
)
SELECT
  gen_random_uuid(),
  NULL,  -- No program association for admin invite
  'ekwame001@gmail.com',  -- CHANGE THIS to your admin email
  'admin',
  'System Administrator',
  NULL,  -- No inviter (system-generated)
  'pending',
  NOW() + INTERVAL '365 days',  -- Long expiry for initial setup
  NOW()
WHERE NOT EXISTS (
  SELECT 1 FROM invites
  WHERE email = 'ekwame001@gmail.com'
    AND target_role = 'admin'
    AND status IN ('pending', 'accepted')
);

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
