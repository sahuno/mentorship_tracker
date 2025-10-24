
export interface User {
  id: string;
  name: string;
  email: string;
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
