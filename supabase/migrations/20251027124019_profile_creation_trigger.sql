-- Migration: Automatic Profile Creation via Database Trigger
-- Date: 2025-10-27
-- Author: Samuel Ahuno (ekwame001@gmail.com)
-- Purpose: Fix signup flow by automatically creating profiles when users sign up
--          This bypasses RLS timing issues with email confirmation

-- ============================================================================
-- FUNCTION: handle_new_user()
-- Automatically creates a profile when a new user signs up in auth.users
-- ============================================================================

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
SECURITY DEFINER -- Run with elevated privileges to bypass RLS
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
  -- Insert profile record for the new user
  -- Extracts data from raw_user_meta_data JSON field
  INSERT INTO public.profiles (id, name, role, phone)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'name', 'New User'),
    'participant',  -- Always force 'participant' role for security
    NEW.raw_user_meta_data->>'phone'
  );

  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    -- Log error but don't block user creation
    RAISE WARNING 'Failed to create profile for user %: %', NEW.id, SQLERRM;
    RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.handle_new_user() IS
  'Automatically creates a profile record when a new user signs up. Runs with SECURITY DEFINER to bypass RLS policies. Always sets role to participant for security.';

-- ============================================================================
-- TRIGGER: on_auth_user_created
-- Fires after a new user is inserted into auth.users
-- ============================================================================

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- Note: Trigger automatically creates profiles in the profiles table when new users sign up

-- ============================================================================
-- CLEANUP: Drop the manual INSERT policy (no longer needed)
-- The trigger handles profile creation automatically
-- ============================================================================

DROP POLICY IF EXISTS "Users can create own profile during signup" ON profiles;

-- Note: We keep the SELECT and UPDATE policies for user profile management
-- Those are still needed after the profile is created
