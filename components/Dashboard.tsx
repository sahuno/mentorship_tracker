import React, { useState, useMemo } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { User, BalanceSheetCycle, Expense } from '../types';
import useLocalStorage from '../hooks/useLocalStorage';
import UserManager from '../utils/userManager';
import Header from './Header';
import BalanceSheet from './BalanceSheet';
import AddExpenseModal from './AddExpenseModal';
import NewCycleModal from './NewCycleModal';

interface DashboardProps {
  user: User;
  onLogout: () => void;
}

const Dashboard: React.FC<DashboardProps> = ({ user, onLogout }) => {
  // Use user-specific storage key for cycles
  const userCyclesKey = UserManager.getUserCyclesKey(user.id);
  const [cycles, setCycles] = useLocalStorage<BalanceSheetCycle[]>(userCyclesKey, []);
  const [isAddExpenseModalOpen, setAddExpenseModalOpen] = useState(false);
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null);
  const [isNewCycleModalOpen, setNewCycleModalOpen] = useState(false);

  const activeCycle = useMemo(() => cycles.find(c => c.isActive), [cycles]);

  // Modal handlers
  const handleOpenAddModal = () => {
    setEditingExpense(null);
    setAddExpenseModalOpen(true);
  };

  const handleOpenEditModal = (expense: Expense) => {
    setEditingExpense(expense);
    setAddExpenseModalOpen(true);
  };

  const handleCloseExpenseModal = () => {
    setEditingExpense(null);
    setAddExpenseModalOpen(false);
  };

  // Data handlers
  const handleStartNewCycle = (budget: number, startDate: string, endDate: string) => {
    const newCycles = cycles.map(c => ({ ...c, isActive: false }));
    const newCycle: BalanceSheetCycle = {
      id: uuidv4(),
      startDate,
      endDate,
      budget,
      expenses: [],
      isActive: true,
    };
    setCycles([...newCycles, newCycle]);
    setNewCycleModalOpen(false);
  };
  
  const handleSaveExpense = (expenseData: Expense | Omit<Expense, 'id'>) => {
    if (!activeCycle) return;

    let updatedCycles;
    if ('id' in expenseData) { // Editing existing expense
      updatedCycles = cycles.map(c => 
        c.id === activeCycle.id 
          ? { ...c, expenses: c.expenses.map(e => e.id === expenseData.id ? expenseData : e) } 
          : c
      );
    } else { // Adding new expense
      const newExpense: Expense = { ...expenseData, id: uuidv4() };
      updatedCycles = cycles.map(c => 
        c.id === activeCycle.id 
          ? { ...c, expenses: [...c.expenses, newExpense] } 
          : c
      );
    }
    setCycles(updatedCycles);
    handleCloseExpenseModal();
  };
  
  const handleDeleteExpense = (expenseId: string) => {
    if (!activeCycle || !window.confirm('Are you sure you want to delete this expense?')) return;
    
    const updatedCycles = cycles.map(c => 
      c.id === activeCycle.id 
        ? { ...c, expenses: c.expenses.filter(e => e.id !== expenseId) } 
        : c
    );
    setCycles(updatedCycles);
  };

  return (
    <>
      <Header user={user} onLogout={onLogout} />
      <main className="p-4 sm:p-6 md:p-8 max-w-7xl mx-auto">
        {activeCycle ? (
          <BalanceSheet 
            cycle={activeCycle}
            onAddExpense={handleOpenAddModal}
            onNewCycle={() => setNewCycleModalOpen(true)}
            onEditExpense={handleOpenEditModal}
            onDeleteExpense={handleDeleteExpense}
          />
        ) : (
          <div className="text-center py-20 bg-white rounded-lg shadow-md">
            <h2 className="text-2xl font-bold text-gray-800">Welcome, {user.name}!</h2>
            <p className="mt-2 text-gray-600">You don't have an active spending cycle.</p>
            <button
              onClick={() => setNewCycleModalOpen(true)}
              className="mt-6 inline-flex items-center px-6 py-3 border border-transparent text-base font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-colors duration-200"
            >
              Start New Spending Cycle
            </button>
          </div>
        )}
      </main>
      
      {isAddExpenseModalOpen && (
        <AddExpenseModal
          onClose={handleCloseExpenseModal}
          onSave={handleSaveExpense}
          expenseToEdit={editingExpense}
        />
      )}

      {isNewCycleModalOpen && (
        <NewCycleModal
          onClose={() => setNewCycleModalOpen(false)}
          onStartCycle={handleStartNewCycle}
        />
      )}
    </>
  );
};

export default Dashboard;