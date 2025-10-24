
// User Role System
export enum UserRole {
  ADMIN = 'admin',
  PROGRAM_MANAGER = 'program_manager',
  PARTICIPANT = 'participant'
}

export interface User {
  id: string;
  name: string;
  email: string;
  role?: UserRole; // Optional for backward compatibility
  programIds?: string[]; // Programs user is part of
  managedProgramIds?: string[]; // Programs user manages (for managers)
}

export interface StoredUser extends User {
  passwordHash: string;
  createdAt: string;
}

export interface Expense {
  id: string;
  date: string;
  item: string;
  amount: number;
  receiptUrl?: string; // Data URL for the image
  contact?: string;
  remarks?: string;
}

export interface BalanceSheetCycle {
  id: string;
  startDate: string;
  endDate: string;
  budget: number;
  expenses: Expense[];
  isActive: boolean;
}

// Program Model
export interface Program {
  id: string;
  name: string;
  description: string;
  managerIds: string[]; // Multiple managers per program
  participantIds: string[];
  startDate: string;
  endDate: string;
  status: 'active' | 'completed' | 'upcoming';
  createdBy: string;
  createdAt: string;
}

// Milestone Types
export enum AssignmentType {
  SELF_CREATED = 'self_created',
  MANAGER_ASSIGNED = 'manager_assigned',
  TEMPLATE_BASED = 'template_based',
  BULK_ASSIGNED = 'bulk_assigned'
}

export interface AssignmentInfo {
  assignedBy: string;
  assignedAt: string;
  assignmentType: AssignmentType;
  isRequired: boolean;
  canDecline: boolean;
  declineReason?: string;
  declinedAt?: string;
  managerResponse?: {
    accepted: boolean;
    comment: string;
    respondedAt: string;
  };
}

export interface ManagerFeedback {
  managerId: string;
  feedback: string;
  feedbackDate: string;
}

export interface ProgressReport {
  id: string;
  weekNumber: number;
  date: string;
  content: string;
  hoursSpent?: number;
  completionPercentage?: number;
  managerFeedback?: ManagerFeedback[];
}

export interface Milestone {
  id: string;
  userId: string;
  programId?: string; // Associated program
  title: string;
  description?: string;
  category: MilestoneCategory;
  startDate: string;
  endDate: string;
  status: MilestoneStatus;
  createdAt: string;
  progressReports: ProgressReport[];
  assignmentInfo?: AssignmentInfo; // Assignment details
}

export interface MilestoneTemplate {
  id: string;
  programId: string;
  title: string;
  description: string;
  category: MilestoneCategory;
  suggestedDuration: number; // in days
  isRequired: boolean;
  createdBy: string;
}

export enum MilestoneCategory {
  EDUCATION = 'education',
  SKILL = 'skill',
  PROJECT = 'project',
  FITNESS = 'fitness',
  OTHER = 'other'
}

export enum MilestoneStatus {
  NOT_STARTED = 'not_started',
  IN_PROGRESS = 'in_progress',
  COMPLETED = 'completed',
  PAUSED = 'paused'
}
