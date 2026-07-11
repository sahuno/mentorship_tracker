-- Remove recursive profile policies restored from older migrations.
-- Policies on profiles must not query profiles directly, or PostgREST can hit
-- infinite recursion when anonymous/authenticated clients touch profile-backed
-- joins.

CREATE OR REPLACE FUNCTION public.current_user_role()
RETURNS TEXT
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role FROM public.profiles WHERE id = auth.uid();
$$;

REVOKE ALL ON FUNCTION public.current_user_role() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.current_user_role() TO authenticated;

DROP POLICY IF EXISTS "Admins can update all profiles" ON profiles;
DROP POLICY IF EXISTS "Admins can view all profiles" ON profiles;
DROP POLICY IF EXISTS "Managers can view their participants" ON profiles;
DROP POLICY IF EXISTS "Program managers can view participants" ON profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON profiles;
DROP POLICY IF EXISTS "Users can update their own profile" ON profiles;
DROP POLICY IF EXISTS "Users can view own profile" ON profiles;
DROP POLICY IF EXISTS "Users can view their own profile" ON profiles;

CREATE POLICY "Users can view own profile" ON profiles
  FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Users can update own profile" ON profiles
  FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (
    auth.uid() = id
    AND role = public.current_user_role()
  );

CREATE POLICY "Admins can view all profiles" ON profiles
  FOR SELECT
  USING (public.current_user_role() = 'admin');

CREATE POLICY "Admins can update all profiles" ON profiles
  FOR UPDATE
  USING (public.current_user_role() = 'admin')
  WITH CHECK (public.current_user_role() = 'admin');

CREATE POLICY "Managers can view program participants" ON profiles
  FOR SELECT
  USING (
    role = 'participant'
    AND EXISTS (
      SELECT 1
      FROM program_participants pp
      JOIN programs p ON p.id = pp.program_id
      WHERE pp.participant_id = profiles.id
      AND p.manager_id = auth.uid()
    )
  );
