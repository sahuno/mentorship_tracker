import { supabase } from './supabase'

export interface BalanceCycleInsert {
  program_id: string
  start_date: string
  end_date: string
  budget: number
}

export async function getMyBalanceCycles(programId: string) {
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

// Same as getMyBalanceCycles but embeds each cycle's expenses in a single query
// (avoids an N+1 of one getExpenses() call per cycle). Embedded expenses are
// ordered by date descending to match the ordering getExpenses() applied before.
export async function getMyBalanceCyclesWithExpenses(programId: string) {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  const { data, error } = await supabase
    .from('balance_cycles')
    .select('*, expenses (*)')
    .eq('program_id', programId)
    .eq('participant_id', user.id)
    .order('created_at', { ascending: false })
    .order('date', { ascending: false, referencedTable: 'expenses' })

  if (error) throw error
  return data || []
}

export async function createBalanceCycle(cycle: BalanceCycleInsert) {
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

export async function setActiveCycle(cycleId: string) {
  const { data, error } = await supabase
    .from('balance_cycles')
    .update({ is_active: true })
    .eq('id', cycleId)
    .select()
    .single()

  if (error) throw error
  return data
}
