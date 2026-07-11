-- Include role so manager workflows cannot enroll manager/admin accounts as participants.

DROP FUNCTION IF EXISTS public.find_user_by_email(TEXT);

CREATE OR REPLACE FUNCTION public.find_user_by_email(search_email TEXT)
RETURNS TABLE (id UUID, name TEXT, email TEXT, role TEXT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    p.id,
    p.name,
    COALESCE(p.email, au.email) AS email,
    p.role
  FROM profiles p
  JOIN auth.users au ON au.id = p.id
  WHERE LOWER(COALESCE(p.email, au.email)) = LOWER(search_email);
END;
$$;

REVOKE ALL ON FUNCTION public.find_user_by_email(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.find_user_by_email(TEXT) TO authenticated;
