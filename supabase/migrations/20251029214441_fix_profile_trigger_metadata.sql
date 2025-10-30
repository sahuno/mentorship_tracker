-- Migration: Fix profile creation trigger to handle missing metadata
-- Date: 2025-10-29
-- Author: Samuel Ahuno (ekwame001@gmail.com)
-- Purpose: Fix trigger to handle cases where raw_user_meta_data is empty or incomplete

-- ============================================================================
-- UPDATED FUNCTION: handle_new_user()
-- More robust metadata extraction with better error handling
-- ============================================================================

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  user_name TEXT;
  user_role TEXT;
  user_phone TEXT;
BEGIN
  -- Extract metadata with fallbacks for missing data
  user_name := COALESCE(
    NEW.raw_user_meta_data->>'name',
    split_part(NEW.email, '@', 1),  -- Use email username as fallback
    'New User'
  );

  -- Always force 'participant' role for security
  user_role := 'participant';

  -- Extract phone (optional field)
  user_phone := NEW.raw_user_meta_data->>'phone';

  -- Log for debugging
  RAISE NOTICE 'Creating profile for user % with name: %, role: %, phone: %',
    NEW.id, user_name, user_role, user_phone;

  -- Insert profile record
  INSERT INTO public.profiles (id, name, role, phone)
  VALUES (
    NEW.id,
    user_name,
    user_role,
    user_phone
  );

  RETURN NEW;
EXCEPTION
  WHEN unique_violation THEN
    -- Profile already exists, log and continue
    RAISE NOTICE 'Profile already exists for user %', NEW.id;
    RETURN NEW;
  WHEN OTHERS THEN
    -- Log error details but don't block user creation
    RAISE WARNING 'Failed to create profile for user %: % (SQLSTATE: %)',
      NEW.id, SQLERRM, SQLSTATE;
    RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.handle_new_user() IS
  'Automatically creates a profile record when a new user signs up. Uses email username as fallback if name is missing. Always sets role to participant for security.';

-- The trigger already exists, no need to recreate it
-- It was created in migration 20251027124019_profile_creation_trigger.sql
