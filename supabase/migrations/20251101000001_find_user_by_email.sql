-- Find user by email function
-- Searches auth.users and returns matching profile info

CREATE OR REPLACE FUNCTION find_user_by_email(search_email TEXT)
RETURNS TABLE (id UUID, name TEXT, email TEXT)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT
    p.id,
    p.name,
    au.email
  FROM profiles p
  JOIN auth.users au ON au.id = p.id
  WHERE LOWER(au.email) = LOWER(search_email);
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION find_user_by_email(TEXT) TO authenticated;

COMMENT ON FUNCTION find_user_by_email IS 'Finds a user by email address by joining profiles with auth.users';
