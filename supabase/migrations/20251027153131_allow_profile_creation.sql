-- Migration: Allow users to create their own profile during signup
-- Date: 2025-10-27
-- Purpose: Fix signup flow by adding INSERT policy with role validation

-- Allow users to create their own profile during signup
-- Security: Restricts role to 'participant' only to prevent privilege escalation
CREATE POLICY "Users can create own profile during signup" ON profiles
  FOR INSERT
  WITH CHECK (
    auth.uid() = id AND
    role IN ('participant')  -- Only allow participant role during signup
  );

-- Note: Admins and managers must be created manually by existing admins
-- This prevents unauthorized privilege escalation during self-signup
