import { supabase } from './supabase'

export interface ExpenseInsert {
  cycle_id: string
  description: string
  amount: number
  date: string
  category?: string
  contact?: string
  remarks?: string
  receipt_url?: string
}

export type ExpenseUpdate = Partial<Omit<ExpenseInsert, 'cycle_id'>>

export async function getExpenses(cycleId: string) {
  const { data, error } = await supabase
    .from('expenses')
    .select('*')
    .eq('cycle_id', cycleId)
    .order('date', { ascending: false })

  if (error) throw error
  return data || []
}

export async function createExpense(expense: ExpenseInsert) {
  const { data, error } = await supabase
    .from('expenses')
    .insert(expense)
    .select()
    .single()

  if (error) throw error
  return data
}

export async function updateExpense(expenseId: string, updates: ExpenseUpdate) {
  // Use .select() (returning the affected rows) instead of .single() so that an
  // RLS-blocked or non-existent update surfaces as zero rows rather than a PostgREST
  // "no rows"/"multiple rows" error. We then verify a row was actually written so the
  // mutation fails loudly instead of silently "succeeding".
  const { data, error } = await supabase
    .from('expenses')
    .update(updates)
    .eq('id', expenseId)
    .select()

  if (error) throw error
  if (!data || data.length === 0) {
    throw new Error(
      'Expense update affected no rows. You may not have permission to edit this expense, or it no longer exists.'
    )
  }
  return data[0]
}

export async function deleteExpense(expenseId: string) {
  // .select() makes DELETE return the rows it removed. Without this an RLS-blocked
  // DELETE matches zero rows with no error, which previously caused the UI to report
  // a false success. Verify at least one row was deleted.
  const { data, error } = await supabase
    .from('expenses')
    .delete()
    .eq('id', expenseId)
    .select()

  if (error) throw error
  if (!data || data.length === 0) {
    throw new Error(
      'Expense delete affected no rows. You may not have permission to delete this expense, or it no longer exists.'
    )
  }
  return { success: true }
}
