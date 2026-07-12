-- Align milestone assignments and progress reporting with the application model.

ALTER TABLE milestones
  ADD COLUMN IF NOT EXISTS category TEXT DEFAULT 'other',
  ADD COLUMN IF NOT EXISTS start_date DATE DEFAULT CURRENT_DATE,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

ALTER TABLE milestone_assignments
  ADD COLUMN IF NOT EXISTS assignment_type TEXT DEFAULT 'manager_assigned',
  ADD COLUMN IF NOT EXISTS is_required BOOLEAN DEFAULT true,
  ADD COLUMN IF NOT EXISTS can_decline BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS decline_reason TEXT,
  ADD COLUMN IF NOT EXISTS declined_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS manager_response JSONB,
  ADD COLUMN IF NOT EXISTS assigned_by UUID REFERENCES profiles(id);

UPDATE milestone_assignments
SET assigned_by = (
  SELECT p.manager_id
  FROM milestones m
  JOIN programs p ON p.id = m.program_id
  WHERE m.id = milestone_assignments.milestone_id
)
WHERE assigned_by IS NULL;

CREATE TABLE IF NOT EXISTS progress_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  assignment_id UUID NOT NULL REFERENCES milestone_assignments(id) ON DELETE CASCADE,
  participant_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  week_number INTEGER NOT NULL CHECK (week_number >= 1),
  report_date DATE NOT NULL DEFAULT CURRENT_DATE,
  content TEXT NOT NULL,
  hours_spent DECIMAL(8,2) CHECK (hours_spent IS NULL OR hours_spent >= 0),
  completion_percentage INTEGER CHECK (
    completion_percentage IS NULL OR completion_percentage BETWEEN 0 AND 100
  ),
  manager_feedback JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_progress_reports_assignment
  ON progress_reports(assignment_id, report_date DESC);

CREATE INDEX IF NOT EXISTS idx_progress_reports_participant
  ON progress_reports(participant_id, report_date DESC);

ALTER TABLE progress_reports ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Participants can manage own progress reports" ON progress_reports;
DROP POLICY IF EXISTS "Managers can view program progress reports" ON progress_reports;
DROP POLICY IF EXISTS "Managers can update report feedback" ON progress_reports;
DROP POLICY IF EXISTS "Admins full access to progress reports" ON progress_reports;

CREATE POLICY "Participants can manage own progress reports" ON progress_reports
  FOR ALL
  USING (participant_id = auth.uid())
  WITH CHECK (
    participant_id = auth.uid()
    AND EXISTS (
      SELECT 1
      FROM milestone_assignments ma
      WHERE ma.id = progress_reports.assignment_id
      AND ma.participant_id = auth.uid()
    )
  );

CREATE POLICY "Managers can view program progress reports" ON progress_reports
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM milestone_assignments ma
      JOIN milestones m ON m.id = ma.milestone_id
      JOIN programs p ON p.id = m.program_id
      WHERE ma.id = progress_reports.assignment_id
      AND p.manager_id = auth.uid()
    )
  );

CREATE POLICY "Managers can update report feedback" ON progress_reports
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1
      FROM milestone_assignments ma
      JOIN milestones m ON m.id = ma.milestone_id
      JOIN programs p ON p.id = m.program_id
      WHERE ma.id = progress_reports.assignment_id
      AND p.manager_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM milestone_assignments ma
      JOIN milestones m ON m.id = ma.milestone_id
      JOIN programs p ON p.id = m.program_id
      WHERE ma.id = progress_reports.assignment_id
      AND p.manager_id = auth.uid()
    )
  );

CREATE POLICY "Admins full access to progress reports" ON progress_reports
  FOR ALL
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

GRANT SELECT, INSERT, UPDATE, DELETE ON progress_reports TO authenticated;

DROP TRIGGER IF EXISTS update_progress_reports_updated_at ON progress_reports;
CREATE TRIGGER update_progress_reports_updated_at
  BEFORE UPDATE ON progress_reports
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
