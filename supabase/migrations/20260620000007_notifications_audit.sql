-- Persistent notifications and immutable audit logging.

ALTER TABLE notifications
  ADD COLUMN IF NOT EXISTS read BOOLEAN,
  ADD COLUMN IF NOT EXISTS is_read BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS metadata JSONB;

UPDATE notifications
SET is_read = COALESCE(is_read, read, false);

UPDATE notifications
SET read = COALESCE(read, is_read, false);

ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can manage own notifications" ON notifications;
DROP POLICY IF EXISTS "Users can view own notifications" ON notifications;
DROP POLICY IF EXISTS "Users can update own notifications" ON notifications;
DROP POLICY IF EXISTS "System can create notifications" ON notifications;

CREATE POLICY "Users can view own notifications" ON notifications
  FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Users can update own notifications" ON notifications
  FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Authenticated users can create notifications" ON notifications
  FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE TABLE IF NOT EXISTS audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  target_user_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  program_id UUID REFERENCES programs(id) ON DELETE SET NULL,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can view audit logs" ON audit_logs;

CREATE POLICY "Admins can view audit logs" ON audit_logs
  FOR SELECT
  USING (public.is_admin());

REVOKE INSERT, UPDATE, DELETE ON audit_logs FROM authenticated;

CREATE OR REPLACE FUNCTION public.log_audit_event(
  p_action TEXT,
  p_target_user_id UUID DEFAULT NULL,
  p_program_id UUID DEFAULT NULL,
  p_metadata JSONB DEFAULT '{}'::jsonb
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id UUID;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  INSERT INTO audit_logs (actor_id, action, target_user_id, program_id, metadata)
  VALUES (auth.uid(), p_action, p_target_user_id, p_program_id, COALESCE(p_metadata, '{}'::jsonb))
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

REVOKE ALL ON FUNCTION public.log_audit_event(TEXT, UUID, UUID, JSONB) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.log_audit_event(TEXT, UUID, UUID, JSONB) TO authenticated;
