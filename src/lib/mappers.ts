import {
  AssignmentInfo,
  AssignmentType,
  BalanceSheetCycle,
  Expense,
  Milestone,
  MilestoneCategory,
  MilestoneStatus,
  Program,
  ProgressReport,
  User,
  UserRole
} from '../../types'

export interface DbProgram {
  id: string
  name: string
  description?: string | null
  manager_id?: string | null
  start_date: string
  end_date: string
  total_budget?: number | string | null
  status?: string | null
  created_at?: string | null
  program_participants?: Array<{
    participant_id: string
    status?: string | null
    enrolled_at?: string | null
    profiles?: DbProfile | null
  }>
}

export interface DbProfile {
  id: string
  name?: string | null
  email?: string | null
  role?: string | null
  phone?: string | null
  created_at?: string | null
}

export interface DbExpense {
  id: string
  date: string
  description: string
  amount: number | string
  category?: string | null
  contact?: string | null
  remarks?: string | null
  receipt_url?: string | null
}

export interface DbBalanceCycle {
  id: string
  start_date: string
  end_date: string
  budget: number | string
  is_active?: boolean | null
}

export interface DbMilestone {
  id: string
  program_id?: string | null
  name: string
  description?: string | null
  category?: string | null
  start_date?: string | null
  deadline: string
  created_at?: string | null
}

export interface DbMilestoneAssignment {
  id: string
  milestone_id: string
  participant_id: string
  assigned_by?: string | null
  status?: string | null
  assigned_at?: string | null
  assignment_type?: string | null
  is_required?: boolean | null
  can_decline?: boolean | null
  decline_reason?: string | null
  declined_at?: string | null
  manager_response?: {
    accepted?: boolean
    comment?: string
    respondedAt?: string
  } | null
  milestone?: DbMilestone | null
  progress_reports?: DbProgressReport[] | null
}

export interface DbProgressReport {
  id: string
  week_number?: number | null
  report_date: string
  content: string
  hours_spent?: number | string | null
  completion_percentage?: number | null
  manager_feedback?: any
}

export function dbProgramToProgram(program: DbProgram): Program {
  const participantIds = (program.program_participants || [])
    .filter((participant) => participant.status !== 'inactive')
    .map((participant) => participant.participant_id)

  return {
    id: program.id,
    name: program.name,
    description: program.description || '',
    managerIds: program.manager_id ? [program.manager_id] : [],
    participantIds,
    startDate: program.start_date,
    endDate: program.end_date,
    status: normalizeProgramStatus(program.status),
    createdBy: program.manager_id || '',
    createdAt: program.created_at || ''
  }
}

export function dbProfileToUser(profile: DbProfile): User {
  return {
    id: profile.id,
    name: profile.name || 'Unnamed User',
    email: profile.email || '',
    role: (profile.role as UserRole) || UserRole.PARTICIPANT
  }
}

export function dbExpenseToExpense(expense: DbExpense): Expense {
  return {
    id: expense.id,
    date: expense.date,
    item: expense.description,
    amount: Number(expense.amount),
    category: expense.category || undefined,
    receiptUrl: expense.receipt_url || undefined,
    contact: expense.contact || undefined,
    remarks: expense.remarks || undefined
  }
}

export function expenseToDbInsert(cycleId: string, expense: Omit<Expense, 'id'>) {
  return {
    cycle_id: cycleId,
    description: expense.item,
    amount: expense.amount,
    date: expense.date,
    category: expense.category,
    contact: expense.contact,
    remarks: expense.remarks,
    receipt_url: expense.receiptUrl
  }
}

export function expenseToDbUpdate(expense: Expense) {
  return {
    description: expense.item,
    amount: expense.amount,
    date: expense.date,
    category: expense.category,
    contact: expense.contact,
    remarks: expense.remarks,
    receipt_url: expense.receiptUrl
  }
}

export function dbCycleToBalanceSheetCycle(
  cycle: DbBalanceCycle,
  expenses: Expense[] = []
): BalanceSheetCycle {
  return {
    id: cycle.id,
    startDate: cycle.start_date,
    endDate: cycle.end_date,
    budget: Number(cycle.budget),
    isActive: !!cycle.is_active,
    expenses
  }
}

export function dbMilestoneAssignmentToMilestone(
  assignment: DbMilestoneAssignment
): Milestone {
  const milestone = assignment.milestone
  const progressReports = (assignment.progress_reports || []).map(dbProgressReportToProgressReport)

  return {
    id: assignment.id,
    userId: assignment.participant_id,
    programId: milestone?.program_id || undefined,
    title: milestone?.name || 'Untitled Milestone',
    description: milestone?.description || undefined,
    category: normalizeMilestoneCategory(milestone?.category),
    startDate: milestone?.start_date || assignment.assigned_at || new Date().toISOString(),
    endDate: milestone?.deadline || new Date().toISOString(),
    dueDate: milestone?.deadline || undefined,
    status: normalizeMilestoneStatus(assignment.status),
    createdAt: assignment.assigned_at || '',
    progressReports,
    assignmentInfo: dbAssignmentInfoToAssignmentInfo(assignment)
  }
}

export function milestoneFormToDbInsert(programId: string, milestone: Partial<Milestone>) {
  return {
    program_id: programId,
    name: milestone.title || 'Untitled Milestone',
    description: milestone.description || null,
    category: milestone.category || MilestoneCategory.OTHER,
    start_date: milestone.startDate || new Date().toISOString().split('T')[0],
    deadline: milestone.endDate || milestone.dueDate || new Date().toISOString().split('T')[0]
  }
}

export function milestoneFormToDbUpdate(milestone: Partial<Milestone>) {
  return {
    name: milestone.title || 'Untitled Milestone',
    description: milestone.description || null,
    category: milestone.category || MilestoneCategory.OTHER,
    start_date: milestone.startDate || new Date().toISOString().split('T')[0],
    deadline: milestone.endDate || milestone.dueDate || new Date().toISOString().split('T')[0]
  }
}

export function dbProgressReportToProgressReport(report: DbProgressReport): ProgressReport {
  return {
    id: report.id,
    weekNumber: report.week_number || 0,
    date: report.report_date,
    content: report.content,
    hoursSpent: report.hours_spent == null ? undefined : Number(report.hours_spent),
    completionPercentage: report.completion_percentage ?? undefined,
    managerFeedback: Array.isArray(report.manager_feedback) ? report.manager_feedback : undefined
  }
}

function dbAssignmentInfoToAssignmentInfo(assignment: DbMilestoneAssignment): AssignmentInfo {
  return {
    assignedBy: assignment.assigned_by || '',
    assignedAt: assignment.assigned_at || '',
    assignmentType: normalizeAssignmentType(assignment.assignment_type),
    isRequired: assignment.is_required ?? true,
    canDecline: assignment.can_decline ?? false,
    declineReason: assignment.decline_reason || undefined,
    declinedAt: assignment.declined_at || undefined,
    managerResponse: assignment.manager_response
      ? {
          accepted: !!assignment.manager_response.accepted,
          comment: assignment.manager_response.comment || '',
          respondedAt: assignment.manager_response.respondedAt || ''
        }
      : undefined
  }
}

function normalizeProgramStatus(status?: string | null): Program['status'] {
  if (status === 'completed') return 'completed'
  if (status === 'upcoming') return 'upcoming'
  return 'active'
}

function normalizeMilestoneCategory(category?: string | null): MilestoneCategory {
  if (category && Object.values(MilestoneCategory).includes(category as MilestoneCategory)) {
    return category as MilestoneCategory
  }
  return MilestoneCategory.OTHER
}

function normalizeMilestoneStatus(status?: string | null): MilestoneStatus {
  if (status === 'in_progress') return MilestoneStatus.IN_PROGRESS
  if (status === 'completed' || status === 'verified') return MilestoneStatus.COMPLETED
  if (status === 'paused') return MilestoneStatus.PAUSED
  return MilestoneStatus.NOT_STARTED
}

function normalizeAssignmentType(type?: string | null): AssignmentType {
  if (type && Object.values(AssignmentType).includes(type as AssignmentType)) {
    return type as AssignmentType
  }
  return AssignmentType.MANAGER_ASSIGNED
}
