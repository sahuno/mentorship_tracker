-- Keep profile email available to app joins and manager participant lists.

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS email TEXT;

UPDATE profiles
SET email = auth.users.email
FROM auth.users
WHERE profiles.id = auth.users.id
AND profiles.email IS NULL;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_invite_code TEXT;
  v_invite_role TEXT;
  v_name TEXT;
  v_phone TEXT;
BEGIN
  v_invite_code := NEW.raw_user_meta_data->>'invite_code';
  v_invite_role := COALESCE(NEW.raw_user_meta_data->>'role', 'participant');
  v_name := COALESCE(NEW.raw_user_meta_data->>'name', NEW.email);
  v_phone := NEW.raw_user_meta_data->>'phone';

  IF v_invite_code IS NOT NULL THEN
    SELECT target_role
    INTO v_invite_role
    FROM invites
    WHERE invite_code = v_invite_code
    AND status = 'pending'
    AND expires_at > NOW();
  END IF;

  INSERT INTO public.profiles (id, name, email, role, phone, created_at, updated_at)
  VALUES (
    NEW.id,
    v_name,
    NEW.email,
    COALESCE(v_invite_role, 'participant'),
    v_phone,
    NOW(),
    NOW()
  )
  ON CONFLICT (id) DO UPDATE
  SET
    name = EXCLUDED.name,
    email = EXCLUDED.email,
    role = COALESCE(v_invite_role, public.profiles.role),
    phone = EXCLUDED.phone,
    updated_at = NOW();

  IF v_invite_code IS NOT NULL THEN
    PERFORM public.accept_invite(v_invite_code, NEW.id);
  END IF;

  RETURN NEW;
END;
$$;
