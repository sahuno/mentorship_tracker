/**
 * Authentication Functions
 *
 * Provides authentication utilities for the Golden Bridge application
 * Supports email/password and magic link authentication
 */

import { supabase } from './supabase'
import type { User } from '@supabase/supabase-js'

export interface SignInCredentials {
  email: string
  password: string
}

export interface SignUpData {
  email: string
  password: string
  name: string
  phone?: string
}

export interface UpdateProfileData {
  name?: string
  email?: string
  phone?: string
}

/**
 * Sign in with email and password
 */
export async function signInWithPassword({ email, password }: SignInCredentials) {
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  })

  if (error) {
    throw new Error(error.message)
  }

  return data
}

/**
 * Login interface matching app expectations
 */
export interface LoginData {
  email: string
  password: string
}

/**
 * Enhanced login function with secure profile fetching
 * Handles auth.uid() timing issues
 */
export async function login({ email, password }: LoginData) {
  // Sign in the user
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  })

  if (error) {
    throw error
  }

  // Wait for session to be fully established
  await new Promise(resolve => setTimeout(resolve, 100))

  // Use the secure profile fetch with retry logic
  try {
    const profile = await getUserProfileSecure()
    return { ...data, profile }
  } catch (profileError) {
    console.error('Failed to fetch profile after login:', profileError)
    // Return auth data even if profile fetch fails
    // The app can retry fetching the profile
    return { ...data, profile: null }
  }
}

/**
 * Sign in with magic link (passwordless)
 */
export async function signInWithMagicLink(email: string) {
  const { data, error } = await supabase.auth.signInWithOtp({
    email,
    options: {
      emailRedirectTo: `${window.location.origin}/auth/callback`,
    },
  })

  if (error) {
    throw new Error(error.message)
  }

  return data
}

/**
 * Sign up new user
 * Creates auth user and profile record
 */
export async function signUp({ email, password, name, phone }: SignUpData) {
  // Create auth user
  // Note: Profile is created automatically by database trigger (handle_new_user).
  // The trigger derives `role` SOLELY from an email-matched invite and IGNORES any
  // client-supplied role in user_metadata. Therefore we intentionally do NOT send
  // `role` here — doing so would be inert and misleadingly imply the client controls
  // the role. Only `name` and `phone` are forwarded for the trigger to populate.
  const { data: authData, error: authError } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        name,
        phone,
      },
    },
  })

  if (authError) {
    throw new Error(authError.message)
  }

  if (!authData.user) {
    throw new Error('Failed to create user')
  }

  // Profile is automatically created by the database trigger
  // No need for manual insertion - the trigger handles it with SECURITY DEFINER

  return authData
}

/**
 * Sign out current user
 */
export async function signOut() {
  const { error } = await supabase.auth.signOut()

  if (error) {
    throw new Error(error.message)
  }

  // Clear any local storage except Supabase auth
  const authKey = 'golden-bridge-auth'
  const supabaseKeys = Object.keys(localStorage).filter(key => key.startsWith('sb-'))

  Object.keys(localStorage).forEach(key => {
    if (key !== authKey && !supabaseKeys.includes(key)) {
      localStorage.removeItem(key)
    }
  })
}

/**
 * Get current session
 */
export async function getSession() {
  const { data: { session }, error } = await supabase.auth.getSession()

  if (error) {
    throw new Error(error.message)
  }

  return session
}

/**
 * Get current user
 */
export async function getUser(): Promise<User | null> {
  const { data: { user }, error } = await supabase.auth.getUser()

  if (error) {
    console.error('Error getting user:', error)
    return null
  }

  return user
}

/**
 * Reset password
 */
export async function resetPassword(email: string) {
  const { data, error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${window.location.origin}/auth/reset-password`,
  })

  if (error) {
    throw new Error(error.message)
  }

  return data
}

/**
 * Update password
 */
export async function updatePassword(newPassword: string) {
  const { data, error } = await supabase.auth.updateUser({
    password: newPassword,
  })

  if (error) {
    throw new Error(error.message)
  }

  return data
}

/**
 * Update profile details and optionally request an email change.
 * Name/phone update the profiles table immediately.
 * Email changes go through Supabase auth and may require confirmation.
 */
export async function updateProfile({ name, email, phone }: UpdateProfileData) {
  const { data: authData, error: authError } = await supabase.auth.getUser()

  if (authError) {
    throw new Error(authError.message)
  }

  const user = authData.user
  if (!user) {
    throw new Error('No authenticated user found')
  }

  const profileUpdates: Record<string, string | null> = {}

  if (typeof name === 'string') {
    profileUpdates.name = name.trim()
  }

  if (typeof phone === 'string') {
    const trimmedPhone = phone.trim()
    profileUpdates.phone = trimmedPhone.length > 0 ? trimmedPhone : null
  }

  if (Object.keys(profileUpdates).length > 0) {
    const { error: profileError } = await supabase
      .from('profiles')
      .update(profileUpdates)
      .eq('id', user.id)

    if (profileError) {
      throw new Error(profileError.message)
    }
  }

  let emailChangeRequested = false

  if (typeof email === 'string') {
    const normalizedEmail = email.trim().toLowerCase()
    if (normalizedEmail && normalizedEmail !== (user.email || '').toLowerCase()) {
      const { error: emailError } = await supabase.auth.updateUser({
        email: normalizedEmail,
      })

      if (emailError) {
        throw new Error(emailError.message)
      }

      emailChangeRequested = true
    }
  }

  const profile = await getUserProfileSecure()

  return {
    profile,
    emailChangeRequested,
  }
}

/**
 * Listen to auth state changes
 */
export function onAuthStateChange(callback: (user: User | null) => void) {
  return supabase.auth.onAuthStateChange((_event, session) => {
    callback(session?.user ?? null)
  })
}

/**
 * Get user profile with role information (legacy - for backward compatibility)
 * @deprecated Use getUserProfileSecure instead
 */
export async function getUserProfile(userId: string) {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .single()

  if (error) {
    console.error('Error fetching profile:', error)
    throw new Error('Failed to fetch user profile')
  }

  return data
}

/**
 * Get user profile with session verification and retry logic
 * Handles auth.uid() timing issues by verifying session first
 * @param maxRetries - Maximum number of retry attempts (default: 3)
 * @param retryDelay - Delay between retries in milliseconds (default: 500)
 */
export async function getUserProfileSecure(maxRetries = 3, retryDelay = 500) {
  // First, verify we have a valid session
  const { data: { session }, error: sessionError } = await supabase.auth.getSession()

  if (sessionError || !session) {
    throw new Error('No valid session found')
  }

  // Use the session's user ID directly for the query
  const userId = session.user.id

  // Retry logic to handle timing issues
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    const { data: profile, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)  // Explicit ID match
      .single()

    if (!error && profile) {
      return profile
    }

    // Log retry attempts for monitoring
    if (error) {
      console.warn(`Profile fetch attempt ${attempt + 1} failed:`, error.message)
    }

    // If it's not the last attempt, wait before retrying
    if (attempt < maxRetries - 1) {
      await new Promise(resolve => setTimeout(resolve, retryDelay))
    }
  }

  throw new Error('Failed to fetch user profile after multiple attempts')
}

/**
 * Check if user has specific role
 */
export async function hasRole(role: 'admin' | 'program_manager' | 'participant'): Promise<boolean> {
  try {
    // Use secure profile fetch which handles session verification
    const profile = await getUserProfileSecure()
    return profile?.role === role
  } catch (error) {
    console.error('Error checking user role:', error)
    return false
  }
}

/**
 * Check if user is admin
 */
export async function isAdmin(): Promise<boolean> {
  return hasRole('admin')
}

/**
 * Check if user is program manager
 */
export async function isProgramManager(): Promise<boolean> {
  return hasRole('program_manager')
}

/**
 * Check if user is participant
 */
export async function isParticipant(): Promise<boolean> {
  return hasRole('participant')
}
