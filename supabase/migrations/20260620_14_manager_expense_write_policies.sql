-- Grant program managers (and admins) scoped WRITE access to participant expenses.
--
-- Product decision: managers SHALL have full write access (add/edit/delete) to
-- participant expenses within the programs they manage. Prior to this migration,
-- managers only had a SELECT policy ("Managers can view program expenses"), so
-- INSERT/UPDATE/DELETE from the Financial Oversight UI silently matched zero rows
-- (RLS-filtered, no error) and reported false success.
--
-- Scoping mirrors the existing "Managers can view program expenses" SELECT policy:
-- an expense is reachable only through its cycle's program. We reuse the
-- recursion-safe SECURITY DEFINER helper public.can_manage_program(program_id),
-- which already returns true for admins (via public.is_admin()) OR the program's
-- manager. This keeps the manager/admin scoping consistent with the rest of the
-- schema and avoids RLS recursion on programs/profiles.
--
-- The existing "Participants can manage own expenses" FOR ALL policy is left
-- untouched, so participant ownership is not weakened. RLS is permissive by
-- default (policies OR together), so these new policies only ADD manager/admin
-- write access.
--
-- Idempotent: each policy is dropped (IF EXISTS) before being recreated, so this
-- migration is safe to re-run and does not assume it is the last migration.

-- INSERT: managers/admins may add expenses to cycles in programs they manage.
DROP POLICY IF EXISTS "Managers can insert program expenses" ON expenses;
CREATE POLICY "Managers can insert program expenses" ON expenses
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM balance_cycles bc
      WHERE bc.id = expenses.cycle_id
      AND public.can_manage_program(bc.program_id)
    )
  );

-- UPDATE: managers/admins may edit expenses in programs they manage. Both the
-- existing row (USING) and the resulting row (WITH CHECK) must remain within a
-- managed program, so an expense cannot be moved into a cycle outside the
-- manager's scope.
DROP POLICY IF EXISTS "Managers can update program expenses" ON expenses;
CREATE POLICY "Managers can update program expenses" ON expenses
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM balance_cycles bc
      WHERE bc.id = expenses.cycle_id
      AND public.can_manage_program(bc.program_id)
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM balance_cycles bc
      WHERE bc.id = expenses.cycle_id
      AND public.can_manage_program(bc.program_id)
    )
  );

-- DELETE: managers/admins may delete expenses in programs they manage.
DROP POLICY IF EXISTS "Managers can delete program expenses" ON expenses;
CREATE POLICY "Managers can delete program expenses" ON expenses
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM balance_cycles bc
      WHERE bc.id = expenses.cycle_id
      AND public.can_manage_program(bc.program_id)
    )
  );
