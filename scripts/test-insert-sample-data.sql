-- ============================================================================
-- Test Sample Data Insertion
-- This script tests basic CRUD operations and constraints
-- Run after creating a test user via Supabase Auth
-- ============================================================================

-- NOTE: Before running this, create a test user via Supabase Dashboard:
-- Authentication → Users → Add User
-- Email: test@example.com
-- Password: TestPassword123!
-- Then replace 'YOUR_USER_UUID' below with the actual UUID

-- ============================================================================
-- Test 1: Create a test profile
-- ============================================================================
INSERT INTO profiles (id, name, role, phone)
VALUES (
    'YOUR_USER_UUID', -- Replace with actual user UUID from auth.users
    'Test Admin',
    'admin',
    '+1234567890'
);

-- Verify profile created
SELECT * FROM profiles;

-- ============================================================================
-- Test 2: Create a test program
-- ============================================================================
INSERT INTO programs (name, description, manager_id, start_date, end_date, total_budget, status)
VALUES (
    'Test Mentorship Program',
    'A test program for verification',
    'YOUR_USER_UUID', -- Replace with actual user UUID
    '2025-01-01',
    '2025-12-31',
    10000.00,
    'active'
)
RETURNING *;

-- Get the program ID for next steps
SELECT id, name, total_budget FROM programs;

-- ============================================================================
-- Test 3: Create a balance cycle
-- ============================================================================
INSERT INTO balance_cycles (
    program_id,
    participant_id,
    start_date,
    end_date,
    budget,
    is_active
)
VALUES (
    (SELECT id FROM programs WHERE name = 'Test Mentorship Program'),
    'YOUR_USER_UUID', -- Replace with actual user UUID
    '2025-01-01',
    '2025-03-31',
    2500.00,
    true
)
RETURNING *;

-- Verify cycle created
SELECT * FROM balance_cycles;

-- ============================================================================
-- Test 4: Create test expenses
-- ============================================================================
INSERT INTO expenses (
    cycle_id,
    description,
    amount,
    date,
    category,
    contact,
    remarks
)
VALUES
    (
        (SELECT id FROM balance_cycles WHERE is_active = true LIMIT 1),
        'Office Supplies',
        150.50,
        '2025-01-15',
        'Supplies',
        'Office Depot',
        'Pens, paper, folders'
    ),
    (
        (SELECT id FROM balance_cycles WHERE is_active = true LIMIT 1),
        'Software License',
        299.00,
        '2025-01-20',
        'Software',
        'Adobe',
        'Annual subscription'
    ),
    (
        (SELECT id FROM balance_cycles WHERE is_active = true LIMIT 1),
        'Training Workshop',
        500.00,
        '2025-02-01',
        'Training',
        'Skills Academy',
        'Leadership training'
    )
RETURNING *;

-- Verify expenses created
SELECT
    e.description,
    e.amount,
    e.date,
    e.category,
    bc.budget,
    (SELECT SUM(amount) FROM expenses WHERE cycle_id = bc.id) AS total_spent,
    bc.budget - (SELECT SUM(amount) FROM expenses WHERE cycle_id = bc.id) AS remaining
FROM expenses e
JOIN balance_cycles bc ON e.cycle_id = bc.id
ORDER BY e.date;

-- ============================================================================
-- Test 5: Test single active cycle constraint
-- ============================================================================
-- Try to create a second active cycle (should deactivate the first one)
INSERT INTO balance_cycles (
    program_id,
    participant_id,
    start_date,
    end_date,
    budget,
    is_active
)
VALUES (
    (SELECT id FROM programs WHERE name = 'Test Mentorship Program'),
    'YOUR_USER_UUID', -- Replace with actual user UUID
    '2025-04-01',
    '2025-06-30',
    2500.00,
    true
);

-- Verify only one cycle is active
SELECT
    id,
    start_date,
    end_date,
    budget,
    is_active,
    CASE WHEN is_active THEN '✓ ACTIVE' ELSE '✗ inactive' END AS status
FROM balance_cycles
ORDER BY created_at;

-- Expected: Only the newest cycle should be active

-- ============================================================================
-- Test 6: Create a milestone
-- ============================================================================
INSERT INTO milestones (
    program_id,
    name,
    description,
    deadline,
    completion_reward
)
VALUES (
    (SELECT id FROM programs WHERE name = 'Test Mentorship Program'),
    'Complete Online Course',
    'Finish the leadership fundamentals course',
    '2025-03-31',
    100.00
)
RETURNING *;

-- ============================================================================
-- Test 7: Create a milestone assignment
-- ============================================================================
INSERT INTO milestone_assignments (
    milestone_id,
    participant_id,
    status
)
VALUES (
    (SELECT id FROM milestones WHERE name = 'Complete Online Course'),
    'YOUR_USER_UUID', -- Replace with actual user UUID
    'in_progress'
)
RETURNING *;

-- ============================================================================
-- Test 8: Create a notification
-- ============================================================================
INSERT INTO notifications (
    user_id,
    type,
    title,
    message,
    is_read,
    metadata
)
VALUES (
    'YOUR_USER_UUID', -- Replace with actual user UUID
    'expense_added',
    'New Expense Added',
    'Your expense "Office Supplies" of $150.50 has been recorded.',
    false,
    '{"expense_id": "test-id", "amount": 150.50}'::jsonb
)
RETURNING *;

-- ============================================================================
-- Test 9: Test updated_at trigger
-- ============================================================================
-- Update a profile and check if updated_at changed
UPDATE profiles
SET phone = '+9876543210'
WHERE id = 'YOUR_USER_UUID'; -- Replace with actual user UUID

-- Verify updated_at changed
SELECT
    name,
    phone,
    created_at,
    updated_at,
    CASE
        WHEN updated_at > created_at THEN '✓ Trigger working'
        ELSE '✗ Trigger not working'
    END AS trigger_status
FROM profiles
WHERE id = 'YOUR_USER_UUID'; -- Replace with actual user UUID

-- ============================================================================
-- CLEANUP (Optional - uncomment to remove test data)
-- ============================================================================
-- DELETE FROM notifications WHERE user_id = 'YOUR_USER_UUID';
-- DELETE FROM milestone_assignments WHERE participant_id = 'YOUR_USER_UUID';
-- DELETE FROM milestones WHERE program_id IN (SELECT id FROM programs WHERE name = 'Test Mentorship Program');
-- DELETE FROM expenses WHERE cycle_id IN (SELECT id FROM balance_cycles WHERE participant_id = 'YOUR_USER_UUID');
-- DELETE FROM balance_cycles WHERE participant_id = 'YOUR_USER_UUID';
-- DELETE FROM programs WHERE name = 'Test Mentorship Program';
-- DELETE FROM profiles WHERE id = 'YOUR_USER_UUID';

-- ============================================================================
-- Final Summary Query
-- ============================================================================
SELECT '=== TEST DATA SUMMARY ===' AS summary;
SELECT
    'Profiles' AS table_name,
    COUNT(*) AS record_count
FROM profiles
UNION ALL
SELECT 'Programs', COUNT(*) FROM programs
UNION ALL
SELECT 'Balance Cycles', COUNT(*) FROM balance_cycles
UNION ALL
SELECT 'Expenses', COUNT(*) FROM expenses
UNION ALL
SELECT 'Milestones', COUNT(*) FROM milestones
UNION ALL
SELECT 'Milestone Assignments', COUNT(*) FROM milestone_assignments
UNION ALL
SELECT 'Notifications', COUNT(*) FROM notifications;
