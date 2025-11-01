/**
 * Program Management Service
 *
 * Handles all program-related database operations including:
 * - Program CRUD operations
 * - Participant enrollment/removal
 * - Invite system
 * - Balance cycles and expenses
 */

import { supabase } from './supabase'

/**
 * Get all programs for the current user
 * - Managers see programs they manage
 * - Participants see programs they're enrolled in
 * - Admins see all programs
 */
export async function getMyPrograms() {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  // Get user's role
  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (profileError) throw profileError

  let query = supabase.from('programs').select(`
    *,
    program_participants (
      participant_id,
      status,
      enrolled_at,
      profiles:participant_id (
        id,
        name,
        phone
      )
    )
  `)

  // Filter based on role
  if (profile?.role === 'admin') {
    // Admins see all programs - no additional filter needed
  } else if (profile?.role === 'program_manager') {
    // Managers see programs they manage
    query = query.eq('manager_id', user.id)
  } else {
    // Participants see programs they're enrolled in
    const { data: enrollments, error: enrollError } = await supabase
      .from('program_participants')
      .select(`
        program:program_id (
          *,
          manager:manager_id (
            name,
            phone
          )
        ),
        status,
        enrolled_at
      `)
      .eq('participant_id', user.id)
      .eq('status', 'active')

    if (enrollError) throw enrollError

    // Extract programs from enrollments
    return (enrollments || []).map(item => ({
      ...item.program,
      enrollment_status: item.status,
      enrolled_at: item.enrolled_at
    }))
  }

  const { data, error } = await query

  if (error) throw error
  return data || []
}

/**
 * Get a single program by ID with all participants
 */
export async function getProgram(programId: string) {
  const { data, error } = await supabase
    .from('programs')
    .select(`
      *,
      manager:manager_id (
        id,
        name,
        phone
      ),
      program_participants (
        participant_id,
        status,
        enrolled_at,
        profiles:participant_id (
          id,
          name,
          role,
          phone
        )
      )
    `)
    .eq('id', programId)
    .single()

  if (error) throw error
  return data
}

/**
 * Add a participant to a program by email
 * If user exists, enrolls them directly
 * If user doesn't exist, creates an invite
 */
export async function addParticipantToProgram(
  programId: string,
  participantEmail: string
) {
  // Use RPC function to find user by email (since email is in auth.users, not profiles)
  const { data: userIds, error: searchError } = await supabase
    .rpc('find_user_by_email', { search_email: participantEmail.toLowerCase().trim() })

  if (searchError) {
    console.error('Error searching for user:', searchError)
    // If RPC fails, assume user doesn't exist and create invite
    const { data: invite, error: inviteError } = await supabase
      .from('invites')
      .insert({
        program_id: programId,
        email: participantEmail.toLowerCase().trim(),
        status: 'pending'
      })
      .select()
      .single()

    if (inviteError) {
      if (inviteError.code === '23505') {
        throw new Error('An invite has already been sent to this email')
      }
      throw inviteError
    }

    return {
      success: true,
      enrolled: false,
      needsInvite: true,
      inviteId: invite.id,
      inviteCode: invite.invite_code,
      email: participantEmail
    }
  }

  if (userIds && userIds.length > 0) {
    const userId = userIds[0].id
    const userName = userIds[0].name

    // User exists - add them directly
    const { data, error } = await supabase
      .from('program_participants')
      .insert({
        program_id: programId,
        participant_id: userId,
        status: 'active'
      })
      .select()
      .single()

    if (error) {
      // Check if already enrolled
      if (error.code === '23505') {
        throw new Error('Participant is already in this program')
      }
      throw error
    }

    return {
      success: true,
      enrolled: true,
      participant: { id: userId, name: userName, email: participantEmail }
    }
  } else {
    // User doesn't exist - create invite
    const { data: invite, error } = await supabase
      .from('invites')
      .insert({
        program_id: programId,
        email: participantEmail.toLowerCase().trim(),
        status: 'pending'
      })
      .select()
      .single()

    if (error) {
      if (error.code === '23505') {
        throw new Error('An invite has already been sent to this email')
      }
      throw error
    }

    return {
      success: true,
      enrolled: false,
      needsInvite: true,
      inviteId: invite.id,
      inviteCode: invite.invite_code,
      email: participantEmail
    }
  }
}

/**
 * Remove a participant from a program
 */
export async function removeParticipantFromProgram(
  programId: string,
  participantId: string
) {
  const { error } = await supabase
    .from('program_participants')
    .delete()
    .eq('program_id', programId)
    .eq('participant_id', participantId)

  if (error) throw error
  return { success: true }
}

/**
 * Create a new program
 */
export async function createProgram(program: {
  name: string
  description: string
  start_date: string
  end_date: string
  total_budget: number
}) {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  const { data, error } = await supabase
    .from('programs')
    .insert({
      ...program,
      manager_id: user.id,
      status: 'active'
    })
    .select()
    .single()

  if (error) throw error
  return data
}

/**
 * Update an existing program
 */
export async function updateProgram(
  programId: string,
  updates: Partial<{
    name: string
    description: string
    start_date: string
    end_date: string
    total_budget: number
    status: string
  }>
) {
  const { data, error } = await supabase
    .from('programs')
    .update(updates)
    .eq('id', programId)
    .select()
    .single()

  if (error) throw error
  return data
}

/**
 * Delete a program (soft delete by setting status)
 */
export async function deleteProgram(programId: string) {
  const { data, error } = await supabase
    .from('programs')
    .update({ status: 'completed' })
    .eq('id', programId)
    .select()
    .single()

  if (error) throw error
  return data
}

/**
 * Get participant's balance cycles for a specific program
 */
export async function getBalanceCycles(programId: string) {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  const { data, error } = await supabase
    .from('balance_cycles')
    .select('*')
    .eq('program_id', programId)
    .eq('participant_id', user.id)
    .order('created_at', { ascending: false })

  if (error) throw error
  return data || []
}

/**
 * Create a new balance cycle
 */
export async function createBalanceCycle(cycle: {
  program_id: string
  start_date: string
  end_date: string
  budget: number
}) {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  const { data, error } = await supabase
    .from('balance_cycles')
    .insert({
      ...cycle,
      participant_id: user.id,
      is_active: true
    })
    .select()
    .single()

  if (error) throw error
  return data
}

/**
 * Get expenses for a specific balance cycle
 */
export async function getExpenses(cycleId: string) {
  const { data, error } = await supabase
    .from('expenses')
    .select('*')
    .eq('cycle_id', cycleId)
    .order('date', { ascending: false })

  if (error) throw error
  return data || []
}

/**
 * Create a new expense
 */
export async function createExpense(expense: {
  cycle_id: string
  description: string
  amount: number
  date: string
  category?: string
  contact?: string
  remarks?: string
  receipt_url?: string
}) {
  const { data, error } = await supabase
    .from('expenses')
    .insert(expense)
    .select()
    .single()

  if (error) throw error
  return data
}

/**
 * Update an existing expense
 */
export async function updateExpense(
  expenseId: string,
  updates: Partial<{
    description: string
    amount: number
    date: string
    category: string
    contact: string
    remarks: string
    receipt_url: string
  }>
) {
  const { data, error } = await supabase
    .from('expenses')
    .update(updates)
    .eq('id', expenseId)
    .select()
    .single()

  if (error) throw error
  return data
}

/**
 * Delete an expense
 */
export async function deleteExpense(expenseId: string) {
  const { error } = await supabase
    .from('expenses')
    .delete()
    .eq('id', expenseId)

  if (error) throw error
  return { success: true }
}

/**
 * Get invite details by invite code
 */
export async function getInviteDetails(inviteCode: string) {
  const { data, error } = await supabase
    .from('invites')
    .select(`
      *,
      program:program_id (
        id,
        name,
        description,
        start_date,
        end_date
      )
    `)
    .eq('invite_code', inviteCode)
    .eq('status', 'pending')
    .gt('expires_at', new Date().toISOString())
    .single()

  if (error) {
    if (error.code === 'PGRST116') {
      return null // Invite not found or expired
    }
    throw error
  }

  return data
}

/**
 * Accept an invite after signup
 */
export async function acceptInvite(inviteCode: string, userId: string) {
  const { data, error } = await supabase
    .rpc('accept_invite', {
      p_invite_code: inviteCode,
      p_user_id: userId
    })

  if (error) throw error
  return data
}

/**
 * Get all invites for a program (manager only)
 */
export async function getProgramInvites(programId: string) {
  const { data, error } = await supabase
    .from('invites')
    .select('*')
    .eq('program_id', programId)
    .order('created_at', { ascending: false })

  if (error) throw error
  return data || []
}

/**
 * Cancel/delete an invite
 */
export async function cancelInvite(inviteId: string) {
  const { error } = await supabase
    .from('invites')
    .update({ status: 'expired' })
    .eq('id', inviteId)

  if (error) throw error
  return { success: true }
}
