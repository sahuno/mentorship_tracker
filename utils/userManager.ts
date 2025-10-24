import { User, StoredUser } from '../types';
import { v4 as uuidv4 } from 'uuid';

const USERS_STORAGE_KEY = 'gbw_users';
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

  // Create a new user account
  static async createUser(name: string, email: string, password: string): Promise<User> {
    if (this.isEmailRegistered(email)) {
      throw new Error('Email is already registered');
    }

    const passwordHash = await hashPassword(password);
    const newUser: StoredUser = {
      id: uuidv4(),
      name,
      email: email.toLowerCase(),
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
}

export default UserManager;