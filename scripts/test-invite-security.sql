-- Golden Bridge Spending Tracker - Invite Security Verification
-- Run in Supabase SQL editor after applying migrations.
--
-- These checks verify that invite lookup and acceptance are exposed through
-- constrained RPCs instead of broad public table reads.

-- 1. Required functions exist.
SELECT
  'get_invite_by_code_exists' AS check_name,
  EXISTS (
    SELECT 1
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname = 'get_invite_by_code'
  ) AS passed;

SELECT
  'accept_invite_exists' AS check_name,
  EXISTS (
    SELECT 1
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname = 'accept_invite'
  ) AS passed;

-- 2. Broad public invite lookup policies should not exist.
SELECT
  'no_public_invite_select_policy' AS check_name,
  NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'invites'
      AND policyname IN (
        'Public can view invite by code',
        'Anyone can view invite by code',
        'Anyone can view invite by code for signup'
      )
  ) AS passed;

-- 3. Anonymous role should not have direct SELECT on invites.
SELECT
  'anon_cannot_select_invites' AS check_name,
  NOT has_table_privilege('anon', 'public.invites', 'SELECT') AS passed;

-- 4. Anonymous role can look up a specific invite code via RPC.
SELECT
  'anon_can_execute_get_invite_by_code' AS check_name,
  has_function_privilege('anon', 'public.get_invite_by_code(text)', 'EXECUTE') AS passed;

-- 5. Anonymous role cannot directly accept invites for arbitrary user IDs.
SELECT
  'anon_cannot_execute_accept_invite' AS check_name,
  NOT has_function_privilege('anon', 'public.accept_invite(text, uuid)', 'EXECUTE') AS passed;

-- 6. Authenticated users can execute accept_invite.
SELECT
  'authenticated_can_execute_accept_invite' AS check_name,
  has_function_privilege('authenticated', 'public.accept_invite(text, uuid)', 'EXECUTE') AS passed;

-- 7. handle_new_user trigger function has been replaced.
SELECT
  'handle_new_user_uses_accept_invite' AS check_name,
  EXISTS (
    SELECT 1
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname = 'handle_new_user'
      AND p.prosrc ILIKE '%accept_invite%'
      AND NOT (
        p.prosrc ILIKE '%UPDATE invites%'
        AND p.prosrc ILIKE '%updated_at%'
      )
  ) AS passed;

-- 8. accept_invite must bind invite code acceptance to the accepting user's email.
SELECT
  'accept_invite_checks_user_email' AS check_name,
  EXISTS (
    SELECT 1
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname = 'accept_invite'
      AND p.prosrc ILIKE '%auth.users%'
      AND p.prosrc ILIKE '%LOWER(email)%'
      AND p.prosrc ILIKE '%LOWER(email) = v_user_email%'
  ) AS passed;

-- 9. Participants can create and update their own balance cycles.
SELECT
  'participant_cycle_insert_policy_exists' AS check_name,
  EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'balance_cycles'
      AND policyname = 'Participants can create own cycles'
      AND cmd = 'INSERT'
  ) AS passed;

SELECT
  'participant_cycle_update_policy_exists' AS check_name,
  EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'balance_cycles'
      AND policyname = 'Participants can update own cycles'
      AND cmd = 'UPDATE'
  ) AS passed;

-- Expected result: every row above should return passed = true.
