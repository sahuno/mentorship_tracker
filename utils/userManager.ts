import { User, StoredUser, UserRole } from '../types';
import { v4 as uuidv4 } from 'uuid';

const USERS_STORAGE_KEY = 'gbw_users_v2'; // Updated for role support
const CURRENT_USER_KEY = 'gbw_current_user';

// Simple hash function for passwords (Note: In production, use proper crypto library)
async function hashPassword(password: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(password);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashHex = hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
  return hashHex;
}

export class UserManager {
  // Get all stored users
  private static getUsers(): StoredUser[] {
    const usersJson = localStorage.getItem(USERS_STORAGE_KEY);
    return usersJson ? JSON.parse(usersJson) : [];
  }

  // Save users to localStorage
  private static saveUsers(users: StoredUser[]): void {
    localStorage.setItem(USERS_STORAGE_KEY, JSON.stringify(users));
  }

  // Check if email is already registered
  static isEmailRegistered(email: string): boolean {
    const users = this.getUsers();
    return users.some(user => user.email.toLowerCase() === email.toLowerCase());
  }

  // Create a new user account with role
  static async createUser(
    name: string,
    email: string,
    password: string,
    role: UserRole = UserRole.PARTICIPANT,
    programIds: string[] = [],
    managedProgramIds: string[] = []
  ): Promise<User> {
    if (this.isEmailRegistered(email)) {
      throw new Error('Email is already registered');
    }

    const passwordHash = await hashPassword(password);
    const newUser: StoredUser = {
      id: uuidv4(),
      name,
      email: email.toLowerCase(),
      role,
      programIds,
      managedProgramIds: role === UserRole.PROGRAM_MANAGER ? managedProgramIds : undefined,
      passwordHash,
      createdAt: new Date().toISOString(),
    };

    const users = this.getUsers();
    users.push(newUser);
    this.saveUsers(users);

    // Return user without sensitive data
    const { passwordHash: _, ...userWithoutPassword } = newUser;
    return userWithoutPassword;
  }

  // Authenticate a user
  static async authenticateUser(email: string, password: string): Promise<User | null> {
    const users = this.getUsers();
    const user = users.find(u => u.email.toLowerCase() === email.toLowerCase());

    if (!user) {
      return null;
    }

    const passwordHash = await hashPassword(password);
    if (passwordHash !== user.passwordHash) {
      return null;
    }

    // Return user without sensitive data
    const { passwordHash: _, ...userWithoutPassword } = user;
    return userWithoutPassword;
  }

  // Save current session
  static saveSession(user: User): void {
    sessionStorage.setItem(CURRENT_USER_KEY, JSON.stringify(user));
  }

  // Get current session
  static getSession(): User | null {
    const userJson = sessionStorage.getItem(CURRENT_USER_KEY);
    return userJson ? JSON.parse(userJson) : null;
  }

  // Clear current session
  static clearSession(): void {
    sessionStorage.removeItem(CURRENT_USER_KEY);
  }

  // Update user profile
  static async updateUser(userId: string, updates: { name?: string; email?: string; password?: string }): Promise<User> {
    const users = this.getUsers();
    const userIndex = users.findIndex(u => u.id === userId);

    if (userIndex === -1) {
      throw new Error('User not found');
    }

    // Check if new email is already taken
    if (updates.email && updates.email !== users[userIndex].email) {
      if (this.isEmailRegistered(updates.email)) {
        throw new Error('Email is already registered');
      }
    }

    // Update user data
    if (updates.name) users[userIndex].name = updates.name;
    if (updates.email) users[userIndex].email = updates.email.toLowerCase();
    if (updates.password) {
      users[userIndex].passwordHash = await hashPassword(updates.password);
    }

    this.saveUsers(users);

    const { passwordHash: _, ...userWithoutPassword } = users[userIndex];
    return userWithoutPassword;
  }

  // Get user's spending cycles (stored separately per user)
  static getUserCyclesKey(userId: string): string {
    return `gbw_cycles_${userId}`;
  }

  // Migrate existing cycles to a user (for backward compatibility)
  static migrateExistingCycles(userId: string): void {
    const oldCyclesKey = 'spendingCycles';
    const existingCycles = localStorage.getItem(oldCyclesKey);

    if (existingCycles) {
      const userCyclesKey = this.getUserCyclesKey(userId);
      const userCycles = localStorage.getItem(userCyclesKey);

      // Only migrate if user doesn't have cycles yet
      if (!userCycles) {
        localStorage.setItem(userCyclesKey, existingCycles);
      }

      // Optional: Remove old cycles after migration
      // localStorage.removeItem(oldCyclesKey);
    }
  }

  // Migrate existing users to new role-based structure
  static migrateExistingUsers(): void {
    const oldUsersKey = 'gbw_users';
    const oldUsers = localStorage.getItem(oldUsersKey);

    if (oldUsers) {
      const parsedUsers = JSON.parse(oldUsers) as StoredUser[];
      const migratedUsers = parsedUsers.map(user => ({
        ...user,
        role: user.role || UserRole.PARTICIPANT, // Default to participant
        programIds: user.programIds || [],
        managedProgramIds: user.managedProgramIds || []
      }));

      localStorage.setItem(USERS_STORAGE_KEY, JSON.stringify(migratedUsers));
    }
  }

  // Get user by ID
  static getUserById(userId: string): User | null {
    const users = this.getUsers();
    const user = users.find(u => u.id === userId);

    if (!user) return null;

    const { passwordHash: _, ...userWithoutPassword } = user;
    return userWithoutPassword;
  }

  // Get users by role
  static getUsersByRole(role: UserRole): User[] {
    const users = this.getUsers();
    return users
      .filter(u => u.role === role)
      .map(({ passwordHash: _, ...user }) => user);
  }

  // Get users in a specific program
  static getUsersInProgram(programId: string): User[] {
    const users = this.getUsers();
    return users
      .filter(u => u.programIds?.includes(programId))
      .map(({ passwordHash: _, ...user }) => user);
  }

  // Check if user has permission for a program
  static userHasAccessToProgram(userId: string, programId: string): boolean {
    const user = this.getUserById(userId);
    if (!user) return false;

    // Admins have access to all programs
    if (user.role === UserRole.ADMIN) return true;

    // Managers have access to programs they manage
    if (user.role === UserRole.PROGRAM_MANAGER) {
      return user.managedProgramIds?.includes(programId) || false;
    }

    // Participants have access to programs they're part of
    return user.programIds?.includes(programId) || false;
  }

  // Add user to program
  static async addUserToProgram(userId: string, programId: string): Promise<void> {
    const users = this.getUsers();
    const userIndex = users.findIndex(u => u.id === userId);

    if (userIndex === -1) throw new Error('User not found');

    if (!users[userIndex].programIds) {
      users[userIndex].programIds = [];
    }

    if (!users[userIndex].programIds!.includes(programId)) {
      users[userIndex].programIds!.push(programId);
      this.saveUsers(users);
    }
  }

  // Add manager to program
  static async addManagerToProgram(userId: string, programId: string): Promise<void> {
    const users = this.getUsers();
    const userIndex = users.findIndex(u => u.id === userId);

    if (userIndex === -1) throw new Error('User not found');
    if (users[userIndex].role !== UserRole.PROGRAM_MANAGER) {
      throw new Error('User is not a program manager');
    }

    if (!users[userIndex].managedProgramIds) {
      users[userIndex].managedProgramIds = [];
    }

    if (!users[userIndex].managedProgramIds!.includes(programId)) {
      users[userIndex].managedProgramIds!.push(programId);
      this.saveUsers(users);
    }
  }
}

export default UserManager;