import { User, UserRole, Program } from '../types';
import UserManager from './userManager';

export class PermissionManager {
  // Check if user can view financial data
  static canViewFinancialData(viewer: User, targetUserId: string): boolean {
    // Users can always view their own data
    if (viewer.id === targetUserId) return true;

    // Admins can view all data
    if (viewer.role === UserRole.ADMIN) return true;

    // Program managers can view data of participants in their programs
    if (viewer.role === UserRole.PROGRAM_MANAGER && viewer.managedProgramIds) {
      const targetUser = UserManager.getUserById(targetUserId);
      if (!targetUser) return false;

      // Check if manager manages any program the target is in
      return viewer.managedProgramIds.some(programId =>
        targetUser.programIds?.includes(programId)
      );
    }

    return false;
  }

  // Check if user can edit financial data
  static canEditFinancialData(editor: User, targetUserId: string): boolean {
    // Users can always edit their own data
    if (editor.id === targetUserId) return true;

    // Admins can edit all data
    if (editor.role === UserRole.ADMIN) return true;

    // Program managers can edit data of participants in their programs (with audit log)
    if (editor.role === UserRole.PROGRAM_MANAGER && editor.managedProgramIds) {
      const targetUser = UserManager.getUserById(targetUserId);
      if (!targetUser) return false;

      // Check if manager manages any program the target is in
      return editor.managedProgramIds.some(programId =>
        targetUser.programIds?.includes(programId)
      );
    }

    return false;
  }

  // Check if user can view milestones
  static canViewMilestones(viewer: User, targetUserId: string): boolean {
    // Users can always view their own milestones
    if (viewer.id === targetUserId) return true;

    // Admins can view all milestones
    if (viewer.role === UserRole.ADMIN) return true;

    // Program managers can view milestones of participants in their programs
    if (viewer.role === UserRole.PROGRAM_MANAGER && viewer.managedProgramIds) {
      const targetUser = UserManager.getUserById(targetUserId);
      if (!targetUser) return false;

      // Check if manager manages any program the target is in
      return viewer.managedProgramIds.some(programId =>
        targetUser.programIds?.includes(programId)
      );
    }

    return false;
  }

  // Check if user can assign milestones
  static canAssignMilestones(user: User, targetUserId: string): boolean {
    // Admins can assign to anyone
    if (user.role === UserRole.ADMIN) return true;

    // Program managers can assign to participants in their programs
    if (user.role === UserRole.PROGRAM_MANAGER && user.managedProgramIds) {
      const targetUser = UserManager.getUserById(targetUserId);
      if (!targetUser) return false;

      // Check if manager manages any program the target is in
      return user.managedProgramIds.some(programId =>
        targetUser.programIds?.includes(programId)
      );
    }

    return false;
  }

  // Check if user can manage a program
  static canManageProgram(user: User, programId: string): boolean {
    // Admins can manage all programs
    if (user.role === UserRole.ADMIN) return true;

    // Program managers can manage programs they're assigned to
    if (user.role === UserRole.PROGRAM_MANAGER) {
      return user.managedProgramIds?.includes(programId) || false;
    }

    return false;
  }

  // Check if user can create programs
  static canCreatePrograms(user: User): boolean {
    return user.role === UserRole.ADMIN;
  }

  // Check if user can export data
  static canExportData(user: User, programId?: string): boolean {
    // Admins can export all data
    if (user.role === UserRole.ADMIN) return true;

    // Program managers can export data from their programs
    if (user.role === UserRole.PROGRAM_MANAGER && programId) {
      return user.managedProgramIds?.includes(programId) || false;
    }

    // Participants can export their own data
    if (user.role === UserRole.PARTICIPANT) return true;

    return false;
  }

  // Check if user can view progress reports
  static canViewProgressReports(viewer: User, targetUserId: string): boolean {
    // Same as viewing milestones
    return this.canViewMilestones(viewer, targetUserId);
  }

  // Check if user can provide feedback on progress reports
  static canProvideFeedback(user: User, targetUserId: string): boolean {
    // Only managers and admins can provide feedback
    if (user.role === UserRole.PARTICIPANT) return false;

    // Otherwise same as viewing milestones
    return this.canViewMilestones(user, targetUserId);
  }

  // Get accessible users for a manager/admin
  static getAccessibleUsers(user: User): User[] {
    if (user.role === UserRole.ADMIN) {
      // Admins can access all users
      return UserManager.getUsers().map(({ passwordHash: _, ...u }) => u);
    }

    if (user.role === UserRole.PROGRAM_MANAGER && user.managedProgramIds) {
      // Get all participants in managed programs
      const accessibleUsers = new Map<string, User>();

      for (const programId of user.managedProgramIds) {
        const programUsers = UserManager.getUsersInProgram(programId);
        programUsers.forEach(u => accessibleUsers.set(u.id, u));
      }

      return Array.from(accessibleUsers.values());
    }

    // Participants can only access themselves
    return [user];
  }

  // Log an audit action
  static logAuditAction(
    userId: string,
    action: string,
    targetId: string,
    details: any
  ): void {
    const auditKey = 'gbw_audit_log';
    const existingLog = localStorage.getItem(auditKey);
    const log = existingLog ? JSON.parse(existingLog) : [];

    log.push({
      id: crypto.randomUUID(),
      userId,
      action,
      targetId,
      details,
      timestamp: new Date().toISOString()
    });

    // Keep only last 1000 entries
    if (log.length > 1000) {
      log.splice(0, log.length - 1000);
    }

    localStorage.setItem(auditKey, JSON.stringify(log));
  }

  // Get audit log for a specific program or user
  static getAuditLog(filterBy?: { programId?: string; userId?: string }): any[] {
    const auditKey = 'gbw_audit_log';
    const existingLog = localStorage.getItem(auditKey);
    const log = existingLog ? JSON.parse(existingLog) : [];

    if (!filterBy) return log;

    return log.filter((entry: any) => {
      if (filterBy.userId) {
        return entry.userId === filterBy.userId || entry.targetId === filterBy.userId;
      }
      if (filterBy.programId) {
        return entry.details?.programId === filterBy.programId;
      }
      return true;
    });
  }
}

export default PermissionManager;