-- Migration: Enable Proper RLS Policies for Profiles Table
-- Date: 2025-10-30
-- Description: Implements secure Row Level Security policies with auth.uid() verification
-- Author: Golden Bridge Spending Tracker Team

-- ============================================================================
-- STEP 1: Enable RLS on profiles table
-- ============================================================================
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- STEP 2: Drop any existing policies to start fresh
-- ============================================================================
DROP POLICY IF EXISTS "Users can view their own profile" ON profiles;
DROP POLICY IF EXISTS "Users can update their own profile" ON profiles;
DROP POLICY IF EXISTS "Admins can view all profiles" ON profiles;
DROP POLICY IF EXISTS "Admins can update all profiles" ON profiles;
DROP POLICY IF EXISTS "Program managers can view participants" ON profiles;
DROP POLICY IF EXISTS "Profiles are viewable by everyone" ON profiles;
DROP POLICY IF EXISTS "Users can insert their own profile during signup" ON profiles;

-- ============================================================================
-- STEP 3: Create New Security Policies
-- ============================================================================

-- Policy 1: Users can view their own profile
-- This is the most basic policy - users can always see their own data
CREATE POLICY "Users can view their own profile"
  ON profiles FOR SELECT
  USING (auth.uid() = id);

-- Policy 2: Users can update their own profile (but NOT their role)
-- Prevents privilege escalation by ensuring role cannot be changed
CREATE POLICY "Users can update their own profile"
  ON profiles FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (
    auth.uid() = id
    AND (
      -- Ensure role field cannot be modified
      role = (SELECT role FROM profiles WHERE id = auth.uid())
    )
  );

-- Policy 3: Admins can view all profiles
-- Admins need visibility into all user accounts
CREATE POLICY "Admins can view all profiles"
  ON profiles FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- Policy 4: Admins can update all profiles
-- Admins can modify any profile, including role changes
CREATE POLICY "Admins can update all profiles"
  ON profiles FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- Policy 5: Admins can delete profiles (optional - uncomment if needed)
-- CREATE POLICY "Admins can delete profiles"
--   ON profiles FOR DELETE
--   USING (
--     EXISTS (
--       SELECT 1 FROM profiles
--       WHERE profiles.id = auth.uid()
--       AND profiles.role = 'admin'
--     )
--   );

-- Policy 6: Program managers can view participants in their programs
-- This requires the program_participants table to be properly set up
-- Note: This policy assumes a many-to-many relationship via program_participants
CREATE POLICY "Program managers can view participants"
  ON profiles FOR SELECT
  USING (
    -- Allow if the current user is a program manager
    -- AND the target profile is a participant in one of their programs
    EXISTS (
      SELECT 1
      FROM program_participants pp1
      JOIN program_participants pp2 ON pp1.program_id = pp2.program_id
      JOIN profiles manager ON manager.id = pp1.participant_id
      WHERE manager.id = auth.uid()
      AND manager.role = 'program_manager'
      AND pp2.participant_id = profiles.id
    )
    OR
    -- Alternative: Simpler version if program managers should see all participants
    -- Uncomment if this is the desired behavior:
    -- EXISTS (
    --   SELECT 1 FROM profiles
    --   WHERE profiles.id = auth.uid()
    --   AND profiles.role = 'program_manager'
    --   AND profiles.role = 'participant'
    -- )
  );

-- ============================================================================
-- STEP 4: Grant necessary permissions
-- ============================================================================
-- Ensure authenticated users can perform CRUD operations (subject to RLS)
GRANT SELECT, UPDATE ON profiles TO authenticated;
-- Note: INSERT is handled by the trigger, not directly by users
-- Note: DELETE is restricted to admins only (if policy is enabled)

-- ============================================================================
-- STEP 5: Create helper functions for testing (optional)
-- ============================================================================

-- Function to check if current user is admin
CREATE OR REPLACE FUNCTION is_admin()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid()
    AND role = 'admin'
  );
$$;

-- Function to check if current user is program manager
CREATE OR REPLACE FUNCTION is_program_manager()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid()
    AND role = 'program_manager'
  );
$$;

-- ============================================================================
-- STEP 6: Add comments for documentation
-- ============================================================================
COMMENT ON POLICY "Users can view their own profile" ON profiles IS
  'Basic policy allowing users to view their own profile data';

COMMENT ON POLICY "Users can update their own profile" ON profiles IS
  'Allows users to update their profile except for role field to prevent privilege escalation';

COMMENT ON POLICY "Admins can view all profiles" ON profiles IS
  'Grants admins read access to all user profiles for management purposes';

COMMENT ON POLICY "Admins can update all profiles" ON profiles IS
  'Grants admins write access to all profiles including role changes';

COMMENT ON POLICY "Program managers can view participants" ON profiles IS
  'Allows program managers to view profiles of participants in their programs';

-- ============================================================================
-- VERIFICATION QUERIES (Run these manually to test)
-- ============================================================================

-- Test 1: Check RLS is enabled
-- SELECT relname, relrowsecurity
-- FROM pg_class
-- WHERE relname = 'profiles';

-- Test 2: List all policies on profiles table
-- SELECT * FROM pg_policies
-- WHERE tablename = 'profiles';

-- Test 3: Test as a specific user (replace UUID)
-- SET SESSION ROLE 'authenticated';
-- SET SESSION "request.jwt.claims" = '{"sub": "user-uuid-here"}';
-- SELECT * FROM profiles;
-- RESET ROLE;

-- ============================================================================
-- ROLLBACK INSTRUCTIONS (if needed)
-- ============================================================================
-- To rollback this migration, run:
-- ALTER TABLE profiles DISABLE ROW LEVEL SECURITY;
-- DROP POLICY IF EXISTS "Users can view their own profile" ON profiles;
-- DROP POLICY IF EXISTS "Users can update their own profile" ON profiles;
-- DROP POLICY IF EXISTS "Admins can view all profiles" ON profiles;
-- DROP POLICY IF EXISTS "Admins can update all profiles" ON profiles;
-- DROP POLICY IF EXISTS "Program managers can view participants" ON profiles;
-- DROP FUNCTION IF EXISTS is_admin();
-- DROP FUNCTION IF EXISTS is_program_manager();