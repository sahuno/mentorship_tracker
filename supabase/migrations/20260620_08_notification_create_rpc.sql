-- Allow app workflows to create notifications for another user without
-- granting cross-user notification read access.

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
