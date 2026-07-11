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
import { logAuditEvent } from './audit'

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
        email,
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
    return ((enrollments || []) as any[]).map(item => ({
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
export async function getProgram(programId: string): Promise<any> {
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
        email,
        phone
      )
      )
    `)
    .eq('id', programId)
    .single()

  if (error) throw error
  if (!data) throw new Error('Program not found')
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
        target_role: 'participant',
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

    await logAuditEvent({
      action: 'CREATE_PARTICIPANT_INVITE',
      programId,
      metadata: {
        inviteId: invite.id,
        email: participantEmail.toLowerCase().trim(),
        targetRole: 'participant'
      }
    })

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
    const userRole = userIds[0].role

    if (userRole && userRole !== 'participant') {
      throw new Error('Only participant accounts can be enrolled in programs')
    }

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

    await logAuditEvent({
      action: 'ADD_PARTICIPANT',
      targetUserId: userId,
      programId,
      metadata: {
        email: participantEmail.toLowerCase().trim()
      }
    })

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
        target_role: 'participant',
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

    await logAuditEvent({
      action: 'CREATE_PARTICIPANT_INVITE',
      programId,
      metadata: {
        inviteId: invite.id,
        email: participantEmail.toLowerCase().trim(),
        targetRole: 'participant'
      }
    })

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
  await logAuditEvent({
    action: 'REMOVE_PARTICIPANT',
    targetUserId: participantId,
    programId
  })
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
  if (!data) throw new Error('Program was not created')
  await logAuditEvent({
    action: 'CREATE_PROGRAM',
    programId: data.id,
    metadata: {
      programName: data.name
    }
  })
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
  if (!data) throw new Error('Program was not updated')
  await logAuditEvent({
    action: 'UPDATE_PROGRAM',
    programId,
    metadata: updates
  })
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
  if (!data) throw new Error('Program was not completed')
  await logAuditEvent({
    action: 'COMPLETE_PROGRAM',
    programId,
    metadata: {
      previousStatus: data.status
    }
  })
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
    .rpc('get_invite_by_code', { p_invite_code: inviteCode })

  if (error) {
    if (error.code === 'PGRST116') {
      return null // Invite not found or expired
    }
    throw error
  }

  const invite = Array.isArray(data) ? data[0] : data

  if (!invite) {
    return null
  }

  return {
    invite_code: invite.invite_code,
    email: invite.email,
    invitee_name: invite.invitee_name,
    target_role: invite.target_role,
    expires_at: invite.expires_at,
    program_id: invite.program_id,
    program: invite.program_id
      ? {
          id: invite.program_id,
          name: invite.program_name,
          description: invite.program_description,
          start_date: invite.program_start_date,
          end_date: invite.program_end_date
        }
      : null
  }
}

/**
 * Accept an invite after signup
 */
export async function acceptInvite(inviteCode: string, userId: string): Promise<boolean> {
  const { data, error } = await supabase
    .rpc('accept_invite', {
      p_invite_code: inviteCode,
      p_user_id: userId
    })

  if (error) throw error
  return !!data
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
  const { data: invite } = await supabase
    .from('invites')
    .select('program_id, email, target_role')
    .eq('id', inviteId)
    .single()

  const { error } = await supabase
    .from('invites')
    .update({ status: 'expired' })
    .eq('id', inviteId)

  if (error) throw error
  await logAuditEvent({
    action: 'CANCEL_INVITE',
    programId: invite?.program_id || null,
    metadata: {
      inviteId,
      email: invite?.email,
      targetRole: invite?.target_role
    }
  })
  return { success: true }
}

// ============================================================================
// ADMIN/ROLE MANAGEMENT FUNCTIONS
// ============================================================================

/**
 * Get all users (admin only)
 * Returns users with their profiles joined with auth.users for email
 */
export async function getAllUsers() {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  // Check if user is admin
  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (profile?.role !== 'admin') {
    throw new Error('Only admins can view all users')
  }

  // Get all profiles - email will need to be fetched separately or via RPC
  const { data, error } = await supabase
    .from('profiles')
    .select('id, name, role, phone, created_at, updated_at')
    .order('created_at', { ascending: false })

  if (error) throw error

  // Try to get emails via RPC function
  const usersWithEmails = await Promise.all(
    (data || []).map(async (profile) => {
      try {
        // Use a simple approach - the email should be available from auth context
        // For now, return profile without email - email can be added later via admin API
        return {
          ...profile,
          email: undefined // Email requires admin API or database function
        }
      } catch {
        return profile
      }
    })
  )

  return usersWithEmails
}

/**
 * Get all pending invites (admin only)
 */
export async function getPendingInvites() {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  // Check if user is admin
  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (profile?.role !== 'admin') {
    throw new Error('Only admins can view all invites')
  }

  const { data, error } = await supabase
    .from('invites')
    .select(`
      id,
      email,
      target_role,
      invitee_name,
      status,
      created_at,
      expires_at,
      program:program_id (
        id,
        name
      )
    `)
    .eq('status', 'pending')
    .gt('expires_at', new Date().toISOString())
    .order('created_at', { ascending: false })

  if (error) throw error
  return data || []
}

/**
 * Create a role-based invite (admin only for admin/manager roles)
 */
export async function createRoleInvite(
  email: string,
  inviteeName: string,
  targetRole: 'participant' | 'program_manager' | 'admin',
  programId?: string
) {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  // Check if user has permission to create this invite
  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  // Only admins can create admin or manager invites
  if (targetRole === 'admin' || targetRole === 'program_manager') {
    if (profile?.role !== 'admin') {
      throw new Error('Only admins can invite managers and admins')
    }
  }

  // Create the invite
  const { data: invite, error } = await supabase
    .from('invites')
    .insert({
      email: email.toLowerCase().trim(),
      invitee_name: inviteeName || null,
      target_role: targetRole,
      program_id: programId || null,
      invited_by: user.id,
      status: 'pending',
      expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString() // 30 days
    })
    .select()
    .single()

  if (error) {
    if (error.code === '23505') {
      throw new Error('An invitation already exists for this email')
    }
    throw error
  }

  await logAuditEvent({
    action: 'CREATE_ROLE_INVITE',
    programId: programId || null,
    metadata: {
      inviteId: invite.id,
      email: email.toLowerCase().trim(),
      targetRole
    }
  })

  return {
    success: true,
    inviteCode: invite.invite_code,
    inviteId: invite.id
  }
}

/**
 * Update a user's role (admin only)
 */
export async function updateUserRole(userId: string, newRole: 'participant' | 'program_manager' | 'admin') {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  // Check if user is admin
  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (profile?.role !== 'admin') {
    throw new Error('Only admins can change user roles')
  }

  // Prevent changing own role
  if (userId === user.id) {
    throw new Error('You cannot change your own role')
  }

  const { data, error } = await supabase
    .from('profiles')
    .update({ role: newRole, updated_at: new Date().toISOString() })
    .eq('id', userId)
    .select()
    .single()

  if (error) throw error
  await logAuditEvent({
    action: 'UPDATE_USER_ROLE',
    targetUserId: userId,
    metadata: {
      newRole
    }
  })
  return data
}

/**
 * Get system statistics (admin only)
 */
export async function getSystemStats() {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  // Check if user is admin
  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (profile?.role !== 'admin') {
    throw new Error('Only admins can view system stats')
  }

  // Get counts in parallel
  const [
    usersResult,
    programsResult,
    invitesResult,
    participantsResult,
    managersResult,
    adminsResult
  ] = await Promise.all([
    supabase.from('profiles').select('id', { count: 'exact', head: true }),
    supabase.from('programs').select('id', { count: 'exact', head: true }).eq('status', 'active'),
    supabase.from('invites').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
    supabase.from('profiles').select('id', { count: 'exact', head: true }).eq('role', 'participant'),
    supabase.from('profiles').select('id', { count: 'exact', head: true }).eq('role', 'program_manager'),
    supabase.from('profiles').select('id', { count: 'exact', head: true }).eq('role', 'admin')
  ])

  return {
    totalUsers: usersResult.count || 0,
    totalPrograms: programsResult.count || 0,
    activePrograms: programsResult.count || 0,
    pendingInvites: invitesResult.count || 0,
    totalParticipants: participantsResult.count || 0,
    totalManagers: managersResult.count || 0,
    totalAdmins: adminsResult.count || 0
  }
}
