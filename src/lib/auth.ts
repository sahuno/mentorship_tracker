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
  role: 'admin' | 'program_manager' | 'participant'
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
export async function signUp({ email, password, name, role, phone }: SignUpData) {
  // Create auth user
  // Note: Profile is created automatically by database trigger (handle_new_user)
  // The trigger extracts name, role, and phone from raw_user_meta_data
  const { data: authData, error: authError } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        name,
        role,
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
 * Listen to auth state changes
 */
export function onAuthStateChange(callback: (user: User | null) => void) {
  return supabase.auth.onAuthStateChange((_event, session) => {
    callback(session?.user ?? null)
  })
}

/**
 * Get user profile with role information
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
 * Check if user has specific role
 */
export async function hasRole(role: 'admin' | 'program_manager' | 'participant'): Promise<boolean> {
  const user = await getUser()

  if (!user) {
    return false
  }

  const profile = await getUserProfile(user.id)
  return profile?.role === role
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
