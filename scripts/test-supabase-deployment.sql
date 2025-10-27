-- ============================================================================
-- Supabase Deployment Verification Script
-- Run this in the Supabase SQL Editor to verify your deployment
-- ============================================================================

-- Test 1: Check all tables exist
SELECT '=== Test 1: Verify All Tables Exist ===' AS test;
SELECT table_name, table_type
FROM information_schema.tables
WHERE table_schema = 'public'
ORDER BY table_name;

-- Expected: 8 tables (balance_cycles, expenses, milestone_assignments,
--           milestones, notifications, profiles, program_participants, programs)

-- Test 2: Check Row Level Security is enabled
SELECT '=== Test 2: Verify RLS is Enabled ===' AS test;
SELECT
    schemaname,
    tablename,
    rowsecurity AS rls_enabled
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY tablename;

-- Expected: All tables should show rls_enabled = true

-- Test 3: Count RLS policies
SELECT '=== Test 3: Count RLS Policies ===' AS test;
SELECT
    schemaname,
    tablename,
    COUNT(*) AS policy_count
FROM pg_policies
WHERE schemaname = 'public'
GROUP BY schemaname, tablename
ORDER BY tablename;

-- Expected: Multiple policies per table (20+ total)

-- Test 4: Check indexes
SELECT '=== Test 4: Verify Indexes ===' AS test;
SELECT
    schemaname,
    tablename,
    indexname,
    indexdef
FROM pg_indexes
WHERE schemaname = 'public'
ORDER BY tablename, indexname;

-- Expected: Multiple indexes including idx_expenses_cycle_id, idx_expenses_date, etc.

-- Test 5: Check triggers
SELECT '=== Test 5: Verify Triggers ===' AS test;
SELECT
    trigger_name,
    event_manipulation,
    event_object_table,
    action_statement
FROM information_schema.triggers
WHERE trigger_schema = 'public'
ORDER BY event_object_table, trigger_name;

-- Expected: update_*_updated_at triggers and ensure_single_active_cycle trigger

-- Test 6: Check constraints
SELECT '=== Test 6: Verify Constraints ===' AS test;
SELECT
    tc.table_name,
    tc.constraint_name,
    tc.constraint_type,
    cc.check_clause
FROM information_schema.table_constraints tc
LEFT JOIN information_schema.check_constraints cc
    ON tc.constraint_name = cc.constraint_name
WHERE tc.table_schema = 'public'
ORDER BY tc.table_name, tc.constraint_type;

-- Expected: CHECK constraints on roles, dates, budgets, etc.

-- Test 7: Check foreign key relationships
SELECT '=== Test 7: Verify Foreign Keys ===' AS test;
SELECT
    tc.table_name AS from_table,
    kcu.column_name AS from_column,
    ccu.table_name AS to_table,
    ccu.column_name AS to_column
FROM information_schema.table_constraints AS tc
JOIN information_schema.key_column_usage AS kcu
    ON tc.constraint_name = kcu.constraint_name
    AND tc.table_schema = kcu.table_schema
JOIN information_schema.constraint_column_usage AS ccu
    ON ccu.constraint_name = tc.constraint_name
    AND ccu.table_schema = tc.table_schema
WHERE tc.constraint_type = 'FOREIGN KEY'
    AND tc.table_schema = 'public'
ORDER BY tc.table_name;

-- Expected: Multiple foreign key relationships between tables

-- Test 8: Test table structure for profiles
SELECT '=== Test 8: Verify Profiles Table Structure ===' AS test;
SELECT
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns
WHERE table_name = 'profiles'
ORDER BY ordinal_position;

-- Expected: id, name, role, phone, created_at, updated_at columns

-- Test 9: Test table structure for expenses
SELECT '=== Test 9: Verify Expenses Table Structure ===' AS test;
SELECT
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns
WHERE table_name = 'expenses'
ORDER BY ordinal_position;

-- Expected: id, cycle_id, description, amount, date, category, contact, remarks, receipt_url, created_at, updated_at

-- Test 10: Check extensions are installed
SELECT '=== Test 10: Verify Extensions ===' AS test;
SELECT
    extname AS extension_name,
    extversion AS version
FROM pg_extension
WHERE extname IN ('pgcrypto', 'uuid-ossp')
ORDER BY extname;

-- Expected: pgcrypto extension installed

-- ============================================================================
-- Summary
-- ============================================================================
SELECT '=== DEPLOYMENT VERIFICATION SUMMARY ===' AS summary;
SELECT
    'Tables' AS component,
    COUNT(*) AS count
FROM information_schema.tables
WHERE table_schema = 'public'
UNION ALL
SELECT
    'RLS Policies',
    COUNT(*)
FROM pg_policies
WHERE schemaname = 'public'
UNION ALL
SELECT
    'Indexes',
    COUNT(*)
FROM pg_indexes
WHERE schemaname = 'public'
    AND indexname NOT LIKE '%_pkey'
UNION ALL
SELECT
    'Triggers',
    COUNT(*)
FROM information_schema.triggers
WHERE trigger_schema = 'public'
UNION ALL
SELECT
    'Foreign Keys',
    COUNT(*)
FROM information_schema.table_constraints
WHERE table_schema = 'public'
    AND constraint_type = 'FOREIGN KEY';

-- ============================================================================
-- Expected Results Summary:
-- - Tables: 8
-- - RLS Policies: 20+
-- - Indexes: 7+
-- - Triggers: 6+
-- - Foreign Keys: 10+
-- ============================================================================
