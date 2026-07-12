-- ============================================================================
-- Migration: Allow participants to create/update/delete their own self-milestones
-- Date: 2026-06-20
-- Purpose:
--   The participant "self-created milestone" flow (createSelfMilestone ->
--   createMilestoneAssignments in src/lib/milestones.ts) INSERTs directly into
--   the milestones table, but the only write policy on milestones is
--   "Managers can manage own program milestones". Participants therefore hit
--   "new row violates row-level security policy for table milestones" and the
--   entire self-milestone feature is broken.
--
--   The milestones table has no owner column, and a self-created milestone is
--   otherwise only identifiable via its milestone_assignments row -- which does
--   not exist yet at milestone-INSERT time and is already deleted by the time
--   deleteMilestoneAssignment removes the milestone. So scoping on the
--   assignment is fragile. Instead we add an explicit created_by column and
--   scope participant writes on it.
-- ============================================================================

-- 1. Ownership column. DEFAULT auth.uid() stamps the creator automatically on
--    every authenticated INSERT (participant or manager) with no app change.
ALTER TABLE milestones
  ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES profiles(id) DEFAULT auth.uid();

COMMENT ON COLUMN milestones.created_by IS
'User who created the milestone. Set automatically via DEFAULT auth.uid(); used to scope participant self-milestone write access.';

-- 2. Backfill existing rows to the program manager. All pre-existing milestones
--    were manager-created, and managers retain full access via program
--    ownership regardless, so this is a safe attribution.
UPDATE milestones m
SET created_by = p.manager_id
FROM programs p
WHERE p.id = m.program_id
  AND m.created_by IS NULL;

-- 3. Participant self-milestone policies. These are ADDED alongside the existing
--    manager FOR ALL policy (permissive policies OR together), scoped so a
--    participant can only touch milestones they created in a program they are
--    actively enrolled in. is_active_program_participant is a SECURITY DEFINER
--    helper (20260620_04) and avoids RLS recursion into program_participants.

DROP POLICY IF EXISTS "Participants can create self milestones" ON milestones;
CREATE POLICY "Participants can create self milestones" ON milestones
  FOR INSERT
  WITH CHECK (
    created_by = auth.uid()
    AND public.is_active_program_participant(program_id)
  );

DROP POLICY IF EXISTS "Participants can update own self milestones" ON milestones;
CREATE POLICY "Participants can update own self milestones" ON milestones
  FOR UPDATE
  USING (created_by = auth.uid())
  WITH CHECK (
    created_by = auth.uid()
    AND public.is_active_program_participant(program_id)
  );

-- DELETE intentionally does NOT require an active enrollment or a surviving
-- assignment: deleteMilestoneAssignment removes the assignment first, then the
-- milestone, so only created_by is a reliable check at that point.
DROP POLICY IF EXISTS "Participants can delete own self milestones" ON milestones;
CREATE POLICY "Participants can delete own self milestones" ON milestones
  FOR DELETE
  USING (created_by = auth.uid());
