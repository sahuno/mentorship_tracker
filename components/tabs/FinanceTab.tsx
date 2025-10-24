import React, { useState, useMemo } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { User, BalanceSheetCycle, Expense } from '../../types';
import BalanceSheet from '../BalanceSheet';
import AddExpenseModal from '../AddExpenseModal';
import NewCycleModal from '../NewCycleModal';

interface FinanceTabProps {
  user: User;
  cycles: BalanceSheetCycle[];
  activeCycle: BalanceSheetCycle | undefined;
  onCyclesUpdate: (cycles: BalanceSheetCycle[]) => void;
}

const FinanceTab: React.FC<FinanceTabProps> = ({ user, cycles, activeCycle, onCyclesUpdate }) => {
  const [isAddExpenseModalOpen, setAddExpenseModalOpen] = useState(false);
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null);
  const [isNewCycleModalOpen, setNewCycleModalOpen] = useState(false);

  // Calculate statistics
  const stats = useMemo(() => {
    const allExpenses = cycles.flatMap(c => c.expenses);
    const totalExpenses = allExpenses.length;
    const totalSpentAllTime = allExpenses.reduce((sum, exp) => sum + exp.amount, 0);

    let currentMonthSpent = 0;
    let currentCycleBudget = 0;
    let currentCycleSpent = 0;
    let currentCycleRemaining = 0;

    if (activeCycle) {
      currentCycleBudget = activeCycle.budget;
      currentCycleSpent = activeCycle.expenses.reduce((sum, exp) => sum + exp.amount, 0);
      currentCycleRemaining = currentCycleBudget - currentCycleSpent;

      // Calculate current month spending
      const currentMonth = new Date().getMonth();
      const currentYear = new Date().getFullYear();
      currentMonthSpent = activeCycle.expenses
        .filter(exp => {
          const expDate = new Date(exp.date);
          return expDate.getMonth() === currentMonth && expDate.getFullYear() === currentYear;
        })
        .reduce((sum, exp) => sum + exp.amount, 0);
    }

    // Get recent expenses across all cycles
    const recentExpenses = allExpenses
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      .slice(0, 5);

    return {
      totalCycles: cycles.length,
      totalExpenses,
      totalSpentAllTime,
      currentMonthSpent,
      currentCycleBudget,
      currentCycleSpent,
      currentCycleRemaining,
      recentExpenses,
      hasActiveCycle: !!activeCycle
    };
  }, [cycles, activeCycle]);

  const formatCurrency = (amount: number) => {
    return `$${amount.toFixed(2)}`;
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  };

  const getSpendingPercentage = () => {
    if (stats.currentCycleBudget === 0) return 0;
    return Math.min((stats.currentCycleSpent / stats.currentCycleBudget) * 100, 100);
  };

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
    onCyclesUpdate([...newCycles, newCycle]);
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
    onCyclesUpdate(updatedCycles);
    handleCloseExpenseModal();
  };

  const handleDeleteExpense = (expenseId: string) => {
    if (!activeCycle || !window.confirm('Are you sure you want to delete this expense?')) return;

    const updatedCycles = cycles.map(c =>
      c.id === activeCycle.id
        ? { ...c, expenses: c.expenses.filter(e => e.id !== expenseId) }
        : c
    );
    onCyclesUpdate(updatedCycles);
  };

  return (
    <div className="space-y-6">
      {activeCycle ? (
        <>
          {/* Quick Stats Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Current Cycle Budget */}
            <div className="bg-white rounded-lg shadow p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Current Budget</p>
                  <p className="text-2xl font-bold text-gray-900">
                    {formatCurrency(stats.currentCycleBudget)}
                  </p>
                </div>
                <div className="p-3 bg-blue-100 rounded-full">
                  <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
              </div>
            </div>

            {/* Spent This Cycle */}
            <div className="bg-white rounded-lg shadow p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Spent This Cycle</p>
                  <p className="text-2xl font-bold text-gray-900">
                    {formatCurrency(stats.currentCycleSpent)}
                  </p>
                </div>
                <div className="p-3 bg-red-100 rounded-full">
                  <svg className="w-6 h-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
                  </svg>
                </div>
              </div>
            </div>

            {/* Remaining Budget */}
            <div className="bg-white rounded-lg shadow p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Remaining</p>
                  <p className={`text-2xl font-bold ${stats.currentCycleRemaining >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {formatCurrency(Math.abs(stats.currentCycleRemaining))}
                    {stats.currentCycleRemaining < 0 && ' over'}
                  </p>
                </div>
                <div className={`p-3 rounded-full ${stats.currentCycleRemaining >= 0 ? 'bg-green-100' : 'bg-red-100'}`}>
                  <svg className={`w-6 h-6 ${stats.currentCycleRemaining >= 0 ? 'text-green-600' : 'text-red-600'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                  </svg>
                </div>
              </div>
            </div>

            {/* Total Expenses Count */}
            <div className="bg-white rounded-lg shadow p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Total Transactions</p>
                  <p className="text-2xl font-bold text-gray-900">{stats.totalExpenses}</p>
                </div>
                <div className="p-3 bg-purple-100 rounded-full">
                  <svg className="w-6 h-6 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                </div>
              </div>
            </div>
          </div>

          {/* Budget Progress */}
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Current Cycle Progress</h3>
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Budget Usage</span>
                <span className="font-medium text-gray-900">{getSpendingPercentage().toFixed(1)}%</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden">
                <div
                  className={`h-3 rounded-full transition-all duration-500 ${
                    getSpendingPercentage() > 90 ? 'bg-red-500' :
                    getSpendingPercentage() > 75 ? 'bg-yellow-500' :
                    'bg-green-500'
                  }`}
                  style={{ width: `${getSpendingPercentage()}%` }}
                />
              </div>
              {activeCycle && (
                <p className="text-xs text-gray-500 mt-2">
                  Cycle Period: {formatDate(activeCycle.startDate)} - {formatDate(activeCycle.endDate)}
                </p>
              )}
            </div>
          </div>

          {/* Recent Transactions */}
          <div className="bg-white rounded-lg shadow">
            <div className="p-6 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900">Recent Transactions</h3>
            </div>
            <div className="divide-y divide-gray-200">
              {stats.recentExpenses.length > 0 ? (
                stats.recentExpenses.map((expense) => (
                  <div key={expense.id} className="p-4 hover:bg-gray-50 transition-colors">
                    <div className="flex justify-between items-start">
                      <div>
                        <p className="font-medium text-gray-900">{expense.item}</p>
                        <p className="text-sm text-gray-500">{formatDate(expense.date)}</p>
                      </div>
                      <span className="font-semibold text-gray-900">{formatCurrency(expense.amount)}</span>
                    </div>
                  </div>
                ))
              ) : (
                <div className="p-8 text-center text-gray-500">
                  <p>No transactions yet</p>
                  <p className="text-sm mt-1">Add your first expense to get started</p>
                </div>
              )}
            </div>
          </div>

          {/* Quick Stats */}
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Quick Stats</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="text-center">
                <p className="text-2xl font-bold text-indigo-600">{stats.totalCycles}</p>
                <p className="text-sm text-gray-600">Total Cycles</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold text-green-600">{formatCurrency(stats.totalSpentAllTime)}</p>
                <p className="text-sm text-gray-600">All-Time Spent</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold text-blue-600">{formatCurrency(stats.currentMonthSpent)}</p>
                <p className="text-sm text-gray-600">This Month</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold text-purple-600">
                  {stats.totalExpenses > 0 ? formatCurrency(stats.totalSpentAllTime / stats.totalExpenses) : '$0.00'}
                </p>
                <p className="text-sm text-gray-600">Avg. Transaction</p>
              </div>
            </div>
          </div>

          {/* Spending Balance Sheet */}
          <BalanceSheet
            cycle={activeCycle}
            onAddExpense={handleOpenAddModal}
            onNewCycle={() => setNewCycleModalOpen(true)}
            onEditExpense={handleOpenEditModal}
            onDeleteExpense={handleDeleteExpense}
          />
        </>
      ) : (
        <div className="text-center py-20 bg-white rounded-lg shadow-md">
          <svg className="mx-auto h-16 w-16 text-gray-400 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <h2 className="text-2xl font-bold text-gray-800">No Active Spending Cycle</h2>
          <p className="mt-2 text-gray-600">Start tracking your expenses by creating a new spending cycle.</p>
          <button
            onClick={() => setNewCycleModalOpen(true)}
            className="mt-6 inline-flex items-center px-6 py-3 border border-transparent text-base font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-colors duration-200"
          >
            <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Start New Spending Cycle
          </button>
        </div>
      )}

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
    </div>
  );
};

export default FinanceTab;