-- Golden Bridge Spending Tracker - Initial Schema
-- Author: Samuel Ahuno (ekwame001@gmail.com)
-- Date: 2025-10-26
-- Description: Complete database schema with RLS policies for production deployment

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================================
-- PROFILES TABLE
-- Extends Supabase auth.users with custom user information
-- ============================================================================
CREATE TABLE profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('admin', 'program_manager', 'participant')),
  phone TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE profiles IS 'User profiles extending auth.users with role-based information';
COMMENT ON COLUMN profiles.role IS 'User role: admin (full access), program_manager (manage programs), participant (track expenses)';

-- ============================================================================
-- PROGRAMS TABLE
-- Represents mentorship programs managed by program managers
-- ============================================================================
CREATE TABLE programs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  description TEXT,
  manager_id UUID REFERENCES profiles(id),
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  total_budget DECIMAL(10,2) NOT NULL CHECK (total_budget >= 0),
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'paused', 'completed')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  CONSTRAINT valid_program_dates CHECK (end_date > start_date)
);

COMMENT ON TABLE programs IS 'Mentorship programs with budgets and timelines';
COMMENT ON COLUMN programs.total_budget IS 'Total budget allocated for the program in dollars';

-- ============================================================================
-- PROGRAM PARTICIPANTS (Junction Table)
-- Many-to-many relationship between programs and participants
-- ============================================================================
CREATE TABLE program_participants (
  program_id UUID REFERENCES programs(id) ON DELETE CASCADE,
  participant_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  enrolled_at TIMESTAMPTZ DEFAULT NOW(),
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'inactive')),

  PRIMARY KEY (program_id, participant_id)
);

COMMENT ON TABLE program_participants IS 'Junction table linking participants to programs';

-- ============================================================================
-- BALANCE CYCLES TABLE
-- Spending periods within programs for tracking expenses
-- ============================================================================
CREATE TABLE balance_cycles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  program_id UUID REFERENCES programs(id) ON DELETE CASCADE,
  participant_id UUID REFERENCES profiles(id),
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  budget DECIMAL(10,2) NOT NULL CHECK (budget >= 0),
  is_active BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  CONSTRAINT valid_cycle_dates CHECK (end_date > start_date)
);

COMMENT ON TABLE balance_cycles IS 'Budget cycles for tracking expenses within programs';
COMMENT ON COLUMN balance_cycles.is_active IS 'Only one cycle can be active per participant at a time';

-- Create index for active cycles
CREATE INDEX idx_balance_cycles_active ON balance_cycles(participant_id, is_active) WHERE is_active = true;

-- ============================================================================
-- EXPENSES TABLE
-- Individual expense entries within balance cycles
-- ============================================================================
CREATE TABLE expenses (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  cycle_id UUID REFERENCES balance_cycles(id) ON DELETE CASCADE,
  description TEXT NOT NULL,
  amount DECIMAL(10,2) NOT NULL CHECK (amount >= 0),
  date DATE NOT NULL,
  category TEXT,
  contact TEXT,
  remarks TEXT,
  receipt_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE expenses IS 'Individual expense entries with optional receipt images';
COMMENT ON COLUMN expenses.receipt_url IS 'URL to receipt image stored in Supabase Storage';

-- Create indexes for common queries
CREATE INDEX idx_expenses_cycle_id ON expenses(cycle_id);
CREATE INDEX idx_expenses_date ON expenses(date DESC);
CREATE INDEX idx_expenses_category ON expenses(category);

-- ============================================================================
-- MILESTONES TABLE
-- Goals or tasks within programs
-- ============================================================================
CREATE TABLE milestones (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  program_id UUID REFERENCES programs(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  deadline DATE NOT NULL,
  completion_reward DECIMAL(10,2) CHECK (completion_reward >= 0),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE milestones IS 'Program milestones with optional completion rewards';

-- ============================================================================
-- MILESTONE ASSIGNMENTS TABLE
-- Tracks participant progress on milestones
-- ============================================================================
CREATE TABLE milestone_assignments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  milestone_id UUID REFERENCES milestones(id) ON DELETE CASCADE,
  participant_id UUID REFERENCES profiles(id),
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'completed', 'verified')),
  completion_date DATE,
  proof_url TEXT,
  manager_notes TEXT,
  assigned_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE milestone_assignments IS 'Tracks participant progress on assigned milestones';
COMMENT ON COLUMN milestone_assignments.proof_url IS 'URL to proof of completion document/image';

-- Create index for participant assignments
CREATE INDEX idx_milestone_assignments_participant ON milestone_assignments(participant_id, status);

-- ============================================================================
-- NOTIFICATIONS TABLE
-- In-app notifications for users
-- ============================================================================
CREATE TABLE notifications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  is_read BOOLEAN DEFAULT false,
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE notifications IS 'In-app notifications with read status';
COMMENT ON COLUMN notifications.metadata IS 'Additional notification data (links, actions, etc.)';

-- Create indexes for notification queries
CREATE INDEX idx_notifications_user ON notifications(user_id, is_read);
CREATE INDEX idx_notifications_created ON notifications(created_at DESC);

-- ============================================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- ============================================================================

-- Enable RLS on all tables
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE programs ENABLE ROW LEVEL SECURITY;
ALTER TABLE program_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE balance_cycles ENABLE ROW LEVEL SECURITY;
ALTER TABLE expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE milestones ENABLE ROW LEVEL SECURITY;
ALTER TABLE milestone_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- PROFILES POLICIES
-- ============================================================================

-- Users can view their own profile
CREATE POLICY "Users can view own profile" ON profiles
  FOR SELECT USING (auth.uid() = id);

-- Users can update their own profile
CREATE POLICY "Users can update own profile" ON profiles
  FOR UPDATE USING (auth.uid() = id);

-- Admins can view all profiles
CREATE POLICY "Admins can view all profiles" ON profiles
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- Program managers can view participants in their programs
CREATE POLICY "Managers can view their participants" ON profiles
  FOR SELECT USING (
    role = 'participant' AND
    EXISTS (
      SELECT 1 FROM program_participants pp
      JOIN programs p ON p.id = pp.program_id
      WHERE pp.participant_id = profiles.id
      AND p.manager_id = auth.uid()
    )
  );

-- ============================================================================
-- PROGRAMS POLICIES
-- ============================================================================

-- Admins can do everything with programs
CREATE POLICY "Admins full access to programs" ON programs
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- Program managers can view their own programs
CREATE POLICY "Managers can view own programs" ON programs
  FOR SELECT USING (manager_id = auth.uid());

-- Program managers can update their own programs
CREATE POLICY "Managers can update own programs" ON programs
  FOR UPDATE USING (manager_id = auth.uid());

-- Participants can view programs they're enrolled in
CREATE POLICY "Participants can view enrolled programs" ON programs
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM program_participants
      WHERE program_id = programs.id
      AND participant_id = auth.uid()
    )
  );

-- ============================================================================
-- PROGRAM PARTICIPANTS POLICIES
-- ============================================================================

-- Admins can manage all enrollments
CREATE POLICY "Admins full access to enrollments" ON program_participants
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- Program managers can manage their program enrollments
CREATE POLICY "Managers can manage own program enrollments" ON program_participants
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM programs
      WHERE id = program_participants.program_id
      AND manager_id = auth.uid()
    )
  );

-- Participants can view their own enrollments
CREATE POLICY "Participants can view own enrollments" ON program_participants
  FOR SELECT USING (participant_id = auth.uid());

-- ============================================================================
-- BALANCE CYCLES POLICIES
-- ============================================================================

-- Participants can view their own cycles
CREATE POLICY "Participants can view own cycles" ON balance_cycles
  FOR SELECT USING (participant_id = auth.uid());

-- Program managers can view cycles for their programs
CREATE POLICY "Managers can view program cycles" ON balance_cycles
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM programs
      WHERE id = balance_cycles.program_id
      AND manager_id = auth.uid()
    )
  );

-- Admins can do everything with cycles
CREATE POLICY "Admins full access to cycles" ON balance_cycles
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- ============================================================================
-- EXPENSES POLICIES
-- ============================================================================

-- Participants can manage their own expenses
CREATE POLICY "Participants can manage own expenses" ON expenses
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM balance_cycles
      WHERE id = expenses.cycle_id
      AND participant_id = auth.uid()
    )
  );

-- Program managers can view expenses in their programs
CREATE POLICY "Managers can view program expenses" ON expenses
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM balance_cycles bc
      JOIN programs p ON p.id = bc.program_id
      WHERE bc.id = expenses.cycle_id
      AND p.manager_id = auth.uid()
    )
  );

-- Admins can view all expenses
CREATE POLICY "Admins can view all expenses" ON expenses
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- ============================================================================
-- MILESTONES POLICIES
-- ============================================================================

-- Program managers can manage milestones in their programs
CREATE POLICY "Managers can manage own program milestones" ON milestones
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM programs
      WHERE id = milestones.program_id
      AND manager_id = auth.uid()
    )
  );

-- Participants can view milestones in their programs
CREATE POLICY "Participants can view program milestones" ON milestones
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM program_participants
      WHERE program_id = milestones.program_id
      AND participant_id = auth.uid()
    )
  );

-- ============================================================================
-- MILESTONE ASSIGNMENTS POLICIES
-- ============================================================================

-- Participants can view and update their own assignments
CREATE POLICY "Participants can manage own assignments" ON milestone_assignments
  FOR ALL USING (participant_id = auth.uid());

-- Program managers can manage assignments for their programs
CREATE POLICY "Managers can manage program assignments" ON milestone_assignments
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM milestones m
      JOIN programs p ON p.id = m.program_id
      WHERE m.id = milestone_assignments.milestone_id
      AND p.manager_id = auth.uid()
    )
  );

-- ============================================================================
-- NOTIFICATIONS POLICIES
-- ============================================================================

-- Users can view and update their own notifications
CREATE POLICY "Users can manage own notifications" ON notifications
  FOR ALL USING (user_id = auth.uid());

-- ============================================================================
-- FUNCTIONS & TRIGGERS
-- ============================================================================

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply updated_at trigger to relevant tables
CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_programs_updated_at BEFORE UPDATE ON programs
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_balance_cycles_updated_at BEFORE UPDATE ON balance_cycles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_expenses_updated_at BEFORE UPDATE ON expenses
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_milestone_assignments_updated_at BEFORE UPDATE ON milestone_assignments
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Function to ensure only one active cycle per participant
CREATE OR REPLACE FUNCTION enforce_single_active_cycle()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.is_active = true THEN
    -- Deactivate all other cycles for this participant
    UPDATE balance_cycles
    SET is_active = false
    WHERE participant_id = NEW.participant_id
    AND id != NEW.id
    AND is_active = true;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER ensure_single_active_cycle BEFORE INSERT OR UPDATE ON balance_cycles
  FOR EACH ROW EXECUTE FUNCTION enforce_single_active_cycle();

-- ============================================================================
-- STORAGE BUCKET FOR RECEIPTS
-- ============================================================================

-- Note: Storage bucket creation should be done via Supabase Dashboard or CLI
-- After creating the 'receipts' bucket, you can apply these policies:

-- Storage policies for receipts bucket will be created in a separate migration
-- See: supabase/migrations/next_migration_storage_policies.sql
