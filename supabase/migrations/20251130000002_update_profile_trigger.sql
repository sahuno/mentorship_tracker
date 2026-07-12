-- ============================================================================
-- Migration: Update handle_new_user trigger for invitation-based roles
-- Date: 2025-11-30
-- Author: Samuel Ahuno (ekwame001@gmail.com)
-- Purpose: Automatically assign roles based on invitation when user signs up
-- ============================================================================

-- Drop and recreate the function with new logic
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  invite_record RECORD;
  final_role TEXT := 'participant';
  user_email TEXT;
  user_name TEXT;
  user_phone TEXT;
BEGIN
  -- Extract user information
  user_email := LOWER(NEW.email);
  user_name := COALESCE(NEW.raw_user_meta_data->>'name', 'New User');
  user_phone := NEW.raw_user_meta_data->>'phone';

  -- Check if user was invited with a specific role
  -- Look for pending, non-expired invites matching this email
  SELECT * INTO invite_record
  FROM invites
  WHERE LOWER(email) = user_email
    AND status = 'pending'
    AND expires_at > NOW()
  ORDER BY created_at DESC
  LIMIT 1;

  IF FOUND THEN
    -- Use the role from the invite
    final_role := COALESCE(invite_record.target_role, 'participant');

    -- Mark invite as accepted
    UPDATE invites
    SET status = 'accepted',
        updated_at = NOW()
    WHERE id = invite_record.id;

    -- Log successful invite acceptance
    RAISE NOTICE 'User % accepted invite % with role %', user_email, invite_record.id, final_role;
  ELSE
    -- No invite found - default to participant
    RAISE NOTICE 'No invite found for %, defaulting to participant', user_email;
  END IF;

  -- Create profile with determined role
  INSERT INTO public.profiles (id, name, role, phone, created_at, updated_at)
  VALUES (
    NEW.id,
    user_name,
    final_role,
    user_phone,
    NOW(),
    NOW()
  );

  RETURN NEW;
EXCEPTION
  WHEN unique_violation THEN
    -- Profile already exists, ignore
    RAISE NOTICE 'Profile already exists for user %', NEW.id;
    RETURN NEW;
  WHEN OTHERS THEN
    -- Log error but don't block user creation
    RAISE WARNING 'Failed to create profile for user %: %', NEW.id, SQLERRM;
    RETURN NEW;
END;
$$;

-- Update function comment
COMMENT ON FUNCTION public.handle_new_user() IS
'Automatically creates a profile when a new user signs up.
If the user has a pending invitation, assigns the role from that invitation.
Otherwise, defaults to participant role.
Runs with SECURITY DEFINER to bypass RLS policies.';

-- Ensure trigger exists (recreate to be safe)
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- ============================================================================
-- Verification
-- ============================================================================
-- Test query: SELECT proname, prosrc FROM pg_proc WHERE proname = 'handle_new_user';
