import { Program, User, UserRole } from '../types';
import { v4 as uuidv4 } from 'uuid';
import UserManager from './userManager';
import PermissionManager from './permissions';

const PROGRAMS_STORAGE_KEY = 'gbw_programs';

export class ProgramManager {
  // Get all programs
  private static getPrograms(): Program[] {
    const programsJson = localStorage.getItem(PROGRAMS_STORAGE_KEY);
    return programsJson ? JSON.parse(programsJson) : [];
  }

  // Save programs to localStorage
  private static savePrograms(programs: Program[]): void {
    localStorage.setItem(PROGRAMS_STORAGE_KEY, JSON.stringify(programs));
  }

  // Create a new program
  static createProgram(
    name: string,
    description: string,
    startDate: string,
    endDate: string,
    createdBy: string,
    managerIds: string[] = []
  ): Program {
    const newProgram: Program = {
      id: uuidv4(),
      name,
      description,
      managerIds,
      participantIds: [],
      startDate,
      endDate,
      status: this.determineStatus(startDate, endDate),
      createdBy,
      createdAt: new Date().toISOString()
    };

    const programs = this.getPrograms();
    programs.push(newProgram);
    this.savePrograms(programs);

    // Add program to managers
    managerIds.forEach(managerId => {
      UserManager.addManagerToProgram(managerId, newProgram.id);
    });

    return newProgram;
  }

  // Update a program
  static updateProgram(programId: string, updates: Partial<Program>): Program | null {
    const programs = this.getPrograms();
    const programIndex = programs.findIndex(p => p.id === programId);

    if (programIndex === -1) return null;

    // Update program
    programs[programIndex] = {
      ...programs[programIndex],
      ...updates,
      id: programId // Ensure ID doesn't change
    };

    // Update status based on dates
    if (updates.startDate || updates.endDate) {
      programs[programIndex].status = this.determineStatus(
        programs[programIndex].startDate,
        programs[programIndex].endDate
      );
    }

    this.savePrograms(programs);
    return programs[programIndex];
  }

  // Delete a program
  static deleteProgram(programId: string): boolean {
    const programs = this.getPrograms();
    const filteredPrograms = programs.filter(p => p.id !== programId);

    if (programs.length === filteredPrograms.length) return false;

    this.savePrograms(filteredPrograms);
    return true;
  }

  // Get program by ID
  static getProgramById(programId: string): Program | null {
    const programs = this.getPrograms();
    return programs.find(p => p.id === programId) || null;
  }

  // Get programs for a user
  static getProgramsForUser(userId: string): Program[] {
    const user = UserManager.getUserById(userId);
    if (!user) return [];

    const programs = this.getPrograms();

    // Admin sees all programs
    if (user.role === UserRole.ADMIN) {
      return programs;
    }

    // Manager sees programs they manage
    if (user.role === UserRole.PROGRAM_MANAGER) {
      return programs.filter(p => user.managedProgramIds?.includes(p.id));
    }

    // Participants see programs they're part of
    return programs.filter(p => user.programIds?.includes(p.id));
  }

  // Add participant to program
  static addParticipantToProgram(programId: string, participantId: string): boolean {
    const programs = this.getPrograms();
    const programIndex = programs.findIndex(p => p.id === programId);

    if (programIndex === -1) return false;

    if (!programs[programIndex].participantIds.includes(participantId)) {
      programs[programIndex].participantIds.push(participantId);
      this.savePrograms(programs);

      // Also update user's program list
      UserManager.addUserToProgram(participantId, programId);
    }

    return true;
  }

  // Remove participant from program
  static removeParticipantFromProgram(programId: string, participantId: string): boolean {
    const programs = this.getPrograms();
    const programIndex = programs.findIndex(p => p.id === programId);

    if (programIndex === -1) return false;

    programs[programIndex].participantIds = programs[programIndex].participantIds.filter(
      id => id !== participantId
    );
    this.savePrograms(programs);

    // TODO: Also update user's program list
    return true;
  }

  // Add manager to program
  static addManagerToProgram(programId: string, managerId: string): boolean {
    const programs = this.getPrograms();
    const programIndex = programs.findIndex(p => p.id === programId);

    if (programIndex === -1) return false;

    if (!programs[programIndex].managerIds.includes(managerId)) {
      programs[programIndex].managerIds.push(managerId);
      this.savePrograms(programs);

      // Also update user's managed programs list
      UserManager.addManagerToProgram(managerId, programId);
    }

    return true;
  }

  // Remove manager from program
  static removeManagerFromProgram(programId: string, managerId: string): boolean {
    const programs = this.getPrograms();
    const programIndex = programs.findIndex(p => p.id === programId);

    if (programIndex === -1) return false;

    programs[programIndex].managerIds = programs[programIndex].managerIds.filter(
      id => id !== managerId
    );
    this.savePrograms(programs);

    // TODO: Also update user's managed programs list
    return true;
  }

  // Get participants in a program
  static getParticipantsInProgram(programId: string): User[] {
    const program = this.getProgramById(programId);
    if (!program) return [];

    return program.participantIds
      .map(id => UserManager.getUserById(id))
      .filter((user): user is User => user !== null);
  }

  // Get managers of a program
  static getManagersOfProgram(programId: string): User[] {
    const program = this.getProgramById(programId);
    if (!program) return [];

    return program.managerIds
      .map(id => UserManager.getUserById(id))
      .filter((user): user is User => user !== null);
  }

  // Determine program status based on dates
  private static determineStatus(startDate: string, endDate: string): 'active' | 'completed' | 'upcoming' {
    const now = new Date();
    const start = new Date(startDate);
    const end = new Date(endDate);

    if (now < start) return 'upcoming';
    if (now > end) return 'completed';
    return 'active';
  }

  // Update all program statuses (should be called periodically)
  static updateAllProgramStatuses(): void {
    const programs = this.getPrograms();
    let updated = false;

    programs.forEach(program => {
      const newStatus = this.determineStatus(program.startDate, program.endDate);
      if (program.status !== newStatus) {
        program.status = newStatus;
        updated = true;
      }
    });

    if (updated) {
      this.savePrograms(programs);
    }
  }

  // Get program statistics
  static getProgramStatistics(programId: string): {
    totalParticipants: number;
    totalManagers: number;
    status: string;
    daysRemaining: number | null;
    completionPercentage: number;
  } {
    const program = this.getProgramById(programId);
    if (!program) {
      return {
        totalParticipants: 0,
        totalManagers: 0,
        status: 'unknown',
        daysRemaining: null,
        completionPercentage: 0
      };
    }

    const now = new Date();
    const start = new Date(program.startDate);
    const end = new Date(program.endDate);

    let daysRemaining = null;
    let completionPercentage = 0;

    if (program.status === 'active') {
      daysRemaining = Math.ceil((end.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
      const totalDays = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
      const daysPassed = Math.ceil((now.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
      completionPercentage = Math.min(100, Math.max(0, (daysPassed / totalDays) * 100));
    } else if (program.status === 'completed') {
      completionPercentage = 100;
    }

    return {
      totalParticipants: program.participantIds.length,
      totalManagers: program.managerIds.length,
      status: program.status,
      daysRemaining,
      completionPercentage
    };
  }
}

export default ProgramManager;