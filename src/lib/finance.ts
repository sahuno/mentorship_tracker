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

  const financials = await Promise.all((enrollments || []).map(async (enrollment: any) => {
    const { data: cycles, error: cycleError } = await supabase
      .from('balance_cycles')
      .select(`
        *,
        expenses (*)
      `)
      .eq('program_id', programId)
      .eq('participant_id', enrollment.participant_id)
      .order('created_at', { ascending: false });

    if (cycleError) throw cycleError;

    const appCycles = (cycles || []).map((cycle: any) =>
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
  }));

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
