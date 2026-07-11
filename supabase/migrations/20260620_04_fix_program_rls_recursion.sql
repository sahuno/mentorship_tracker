-- Break RLS recursion across profiles, programs, and program_participants.

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(public.current_user_role() = 'admin', false);
$$;

CREATE OR REPLACE FUNCTION public.can_manage_program(p_program_id UUID)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    public.is_admin()
    OR EXISTS (
      SELECT 1
      FROM public.programs
      WHERE id = p_program_id
      AND manager_id = auth.uid()
    ),
    false
  );
$$;

CREATE OR REPLACE FUNCTION public.is_active_program_participant(p_program_id UUID)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    EXISTS (
      SELECT 1
      FROM public.program_participants
      WHERE program_id = p_program_id
      AND participant_id = auth.uid()
      AND status = 'active'
    ),
    false
  );
$$;

CREATE OR REPLACE FUNCTION public.can_view_participant_profile(p_profile_id UUID)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    public.is_admin()
    OR p_profile_id = auth.uid()
    OR EXISTS (
      SELECT 1
      FROM public.program_participants pp
      JOIN public.programs p ON p.id = pp.program_id
      WHERE pp.participant_id = p_profile_id
      AND pp.status = 'active'
      AND p.manager_id = auth.uid()
    ),
    false
  );
$$;

REVOKE ALL ON FUNCTION public.is_admin() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.can_manage_program(UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.is_active_program_participant(UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.can_view_participant_profile(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_manage_program(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_active_program_participant(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_view_participant_profile(UUID) TO authenticated;

DROP POLICY IF EXISTS "Admins can update all profiles" ON profiles;
DROP POLICY IF EXISTS "Admins can view all profiles" ON profiles;
DROP POLICY IF EXISTS "Managers can view program participants" ON profiles;
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
  USING (public.is_admin());

CREATE POLICY "Admins can update all profiles" ON profiles
  FOR UPDATE
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

CREATE POLICY "Managers can view program participants" ON profiles
  FOR SELECT
  USING (
    role = 'participant'
    AND public.can_view_participant_profile(id)
  );

DROP POLICY IF EXISTS "Admins can view all programs" ON programs;
DROP POLICY IF EXISTS "Admins full access to programs" ON programs;
DROP POLICY IF EXISTS "Managers can create programs" ON programs;
DROP POLICY IF EXISTS "Managers can update own programs" ON programs;
DROP POLICY IF EXISTS "Managers can update their programs" ON programs;
DROP POLICY IF EXISTS "Managers can view own programs" ON programs;
DROP POLICY IF EXISTS "Managers can view their programs" ON programs;
DROP POLICY IF EXISTS "Participants can view enrolled programs" ON programs;

CREATE POLICY "Admins full access to programs" ON programs
  FOR ALL
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

CREATE POLICY "Managers can create programs" ON programs
  FOR INSERT
  WITH CHECK (
    manager_id = auth.uid()
    AND public.current_user_role() IN ('program_manager', 'admin')
  );

CREATE POLICY "Managers can view own programs" ON programs
  FOR SELECT
  USING (manager_id = auth.uid());

CREATE POLICY "Managers can update own programs" ON programs
  FOR UPDATE
  USING (manager_id = auth.uid())
  WITH CHECK (manager_id = auth.uid());

CREATE POLICY "Participants can view enrolled programs" ON programs
  FOR SELECT
  USING (public.is_active_program_participant(id));

DROP POLICY IF EXISTS "Admins full access to enrollments" ON program_participants;
DROP POLICY IF EXISTS "Managers can manage own program enrollments" ON program_participants;
DROP POLICY IF EXISTS "Participants can view own enrollments" ON program_participants;

CREATE POLICY "Admins full access to enrollments" ON program_participants
  FOR ALL
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

CREATE POLICY "Managers can manage own program enrollments" ON program_participants
  FOR ALL
  USING (public.can_manage_program(program_id))
  WITH CHECK (public.can_manage_program(program_id));

CREATE POLICY "Participants can view own enrollments" ON program_participants
  FOR SELECT
  USING (participant_id = auth.uid());
