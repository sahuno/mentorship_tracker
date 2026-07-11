import { BalanceSheetCycle, User } from '../../types';
import { dbCycleToBalanceSheetCycle, dbExpenseToExpense, dbProfileToUser } from './mappers';
import { supabase } from './supabase';

export interface ParticipantFinancials {
  participant: User;
  cycles: BalanceSheetCycle[];
  activeCycle: BalanceSheetCycle | null;
  totalSpent: number;
  totalBudget: number;
}

export async function getProgramParticipantFinancials(
  programId: string
): Promise<ParticipantFinancials[]> {
  const { data: enrollments, error: enrollmentError } = await supabase
    .from('program_participants')
    .select(`
      participant_id,
      profiles:participant_id (*)
    `)
    .eq('program_id', programId)
    .eq('status', 'active');

  if (enrollmentError) throw enrollmentError;

  // Single query for every cycle (with embedded expenses) in the program, then
  // group by participant client-side. This replaces the previous N+1 pattern that
  // ran one balance_cycles+expenses query per participant.
  const { data: cycles, error: cycleError } = await supabase
    .from('balance_cycles')
    .select(`
      *,
      expenses (*)
    `)
    .eq('program_id', programId)
    .order('created_at', { ascending: false });

  if (cycleError) throw cycleError;

  // Preserve the previous per-participant ordering: iterating the created_at-desc
  // ordered result and appending keeps each participant's cycles in the same order
  // the old per-participant `.order('created_at', { ascending: false })` produced.
  const cyclesByParticipant = new Map<string, any[]>();
  for (const cycle of (cycles || [])) {
    const existing = cyclesByParticipant.get(cycle.participant_id);
    if (existing) {
      existing.push(cycle);
    } else {
      cyclesByParticipant.set(cycle.participant_id, [cycle]);
    }
  }

  // Build from enrollments so participants with zero cycles still appear, and the
  // output array order matches the enrollment order exactly as before.
  const financials = (enrollments || []).map((enrollment: any) => {
    const participantCycles = cyclesByParticipant.get(enrollment.participant_id) || [];

    const appCycles = participantCycles.map((cycle: any) =>
      dbCycleToBalanceSheetCycle(
        cycle,
        (cycle.expenses || []).map(dbExpenseToExpense)
      )
    );

    const totalSpent = appCycles.reduce((sum, cycle) =>
      sum + cycle.expenses.reduce((expenseSum, expense) => expenseSum + expense.amount, 0), 0);
    const totalBudget = appCycles.reduce((sum, cycle) => sum + cycle.budget, 0);

    return {
      participant: dbProfileToUser(enrollment.profiles),
      cycles: appCycles,
      activeCycle: appCycles.find((cycle) => cycle.isActive) || null,
      totalSpent,
      totalBudget
    };
  });

  return financials;
}

export async function getParticipantCycles(
  programId: string,
  participantId: string
): Promise<BalanceSheetCycle[]> {
  const { data, error } = await supabase
    .from('balance_cycles')
    .select(`
      *,
      expenses (*)
    `)
    .eq('program_id', programId)
    .eq('participant_id', participantId)
    .order('created_at', { ascending: false });

  if (error) throw error;

  return (data || []).map((cycle: any) =>
    dbCycleToBalanceSheetCycle(cycle, (cycle.expenses || []).map(dbExpenseToExpense))
  );
}
