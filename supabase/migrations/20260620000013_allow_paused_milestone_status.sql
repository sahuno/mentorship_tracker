-- ============================================================================
-- Migration: Allow 'paused' status on milestone_assignments
-- Date: 2026-06-20
-- Author: Samuel Ahuno (ekwame001@gmail.com)
-- Purpose: The application model (types.ts MilestoneStatus.PAUSED = 'paused')
--          and the UI let a participant/manager pause a milestone, but the
--          milestone_assignments.status CHECK constraint from the initial
--          schema only permitted ('pending','in_progress','completed','verified').
--          Writing 'paused' therefore always failed with a CHECK violation.
--          This migration widens the CHECK to also allow 'paused'.
--
-- Idempotent: safe to run multiple times. It discovers and drops ANY existing
-- CHECK constraint that governs the status column (whether it was the inline,
-- auto-named constraint from the CREATE TABLE, or the named one created by a
-- previous run of this migration) and then (re)creates the widened constraint.
-- It does not assume it is the last migration applied.
-- ============================================================================

DO $$
DECLARE
  v_conname text;
BEGIN
  -- Drop every CHECK constraint on milestone_assignments whose definition
  -- references the status column. This covers the inline unnamed constraint
  -- (auto-named 'milestone_assignments_status_check' by Postgres) as well as
  -- the explicitly named constraint this migration adds below.
  FOR v_conname IN
    SELECT con.conname
    FROM pg_constraint con
    JOIN pg_class rel ON rel.oid = con.conrelid
    JOIN pg_namespace nsp ON nsp.oid = rel.relnamespace
    WHERE nsp.nspname = 'public'
      AND rel.relname = 'milestone_assignments'
      AND con.contype = 'c'
      AND pg_get_constraintdef(con.oid) ILIKE '%status%'
  LOOP
    EXECUTE format(
      'ALTER TABLE public.milestone_assignments DROP CONSTRAINT IF EXISTS %I',
      v_conname
    );
  END LOOP;
END $$;

ALTER TABLE public.milestone_assignments
  ADD CONSTRAINT milestone_assignments_status_check
  CHECK (status IN ('pending', 'in_progress', 'completed', 'verified', 'paused'));

-- ============================================================================
-- Verification
-- ============================================================================
-- SELECT conname, pg_get_constraintdef(oid)
-- FROM pg_constraint
-- WHERE conrelid = 'public.milestone_assignments'::regclass AND contype = 'c';
-- ============================================================================
