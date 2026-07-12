-- ============================================================================
-- Migration: Close notification forgery (security review S2)
-- Date: 2026-06-20
-- Purpose:
--   20260620_07 set the notifications INSERT policy to
--   `WITH CHECK (auth.uid() IS NOT NULL)` and 20260620_08's create_notification
--   RPC (SECURITY DEFINER) inserted an arbitrary p_user_id with no authorization
--   beyond "is logged in". Any authenticated user could therefore plant a
--   notification -- including a forged type='system' message -- in any other
--   user's feed (in-app phishing).
--
--   Fix:
--     1. Tighten the direct-INSERT RLS policy to self-only. The app creates
--        cross-user notifications exclusively through create_notification()
--        (SECURITY DEFINER, owner=postgres, table not FORCE RLS -> bypasses
--        RLS), so restricting direct inserts to self breaks no real flow.
--     2. Authorize create_notification: the target must be the caller, an
--        admin, or a manager<->participant counterpart in a shared active
--        program (the only cross-user flows the app actually performs:
--        notifyAssignment, notifyFeedback, notifyDecline).
--     3. Restrict type to the application allowlist so 'system' and other
--        arbitrary types cannot be forged.
-- ============================================================================

-- 1. Direct table inserts may only target the caller's own row.
DROP POLICY IF EXISTS "Authenticated users can create notifications" ON notifications;
DROP POLICY IF EXISTS "Users can create own notifications" ON notifications;
CREATE POLICY "Users can create own notifications" ON notifications
  FOR INSERT
  WITH CHECK (user_id = auth.uid());

-- 2 + 3. Authorize target and constrain type inside the SECURITY DEFINER RPC.
CREATE OR REPLACE FUNCTION public.create_notification(
  p_user_id UUID,
  p_type TEXT,
  p_title TEXT,
  p_message TEXT,
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

  -- Only the application's own notification types may be created; blocks a
  -- forged 'system' or arbitrary type.
  IF p_type NOT IN ('assignment', 'feedback', 'deadline', 'decline', 'general') THEN
    RAISE EXCEPTION 'Invalid notification type: %', p_type;
  END IF;

  -- The caller may notify: themselves; anyone (if admin); or a
  -- manager<->participant counterpart in a shared, active program.
  IF NOT (
    p_user_id = auth.uid()
    OR public.is_admin()
    OR EXISTS (
      SELECT 1
      FROM programs pr
      JOIN program_participants pp ON pp.program_id = pr.id
      WHERE pr.manager_id = auth.uid()
        AND pp.participant_id = p_user_id
        AND pp.status = 'active'
    )
    OR EXISTS (
      SELECT 1
      FROM programs pr
      JOIN program_participants pp ON pp.program_id = pr.id
      WHERE pr.manager_id = p_user_id
        AND pp.participant_id = auth.uid()
        AND pp.status = 'active'
    )
  ) THEN
    RAISE EXCEPTION 'Not authorized to create a notification for user %', p_user_id;
  END IF;

  INSERT INTO notifications (user_id, type, title, message, is_read, read, metadata)
  VALUES (
    p_user_id,
    p_type,
    p_title,
    p_message,
    false,
    false,
    COALESCE(p_metadata, '{}'::jsonb)
  )
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

REVOKE ALL ON FUNCTION public.create_notification(UUID, TEXT, TEXT, TEXT, JSONB) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_notification(UUID, TEXT, TEXT, TEXT, JSONB) TO authenticated;

COMMENT ON FUNCTION public.create_notification(UUID, TEXT, TEXT, TEXT, JSONB) IS
'Creates a notification for p_user_id. Authorizes that the caller may notify the target (self, admin, or manager<->participant in a shared active program) and restricts type to the application allowlist, preventing cross-user notification forgery (security review S2).';
