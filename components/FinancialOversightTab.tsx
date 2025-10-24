import React, { useState, useEffect } from 'react';
import { User, BalanceSheetCycle, Expense, UserRole } from '../types';
import ProgramManager from '../utils/programManager';
import PermissionManager from '../utils/permissions';
import { v4 as uuidv4 } from 'uuid';

interface FinancialOversightTabProps {
  programId: string;
  managerId: string;
  managerUser: User;
}

interface ParticipantFinancials {
  participant: User;
  cycles: BalanceSheetCycle[];
  activeCycle: BalanceSheetCycle | null;
  totalSpent: number;
  totalBudget: number;
}

const FinancialOversightTab: React.FC<FinancialOversightTabProps> = ({
  programId,
  managerId,
  managerUser
}) => {
  const [participantFinancials, setParticipantFinancials] = useState<ParticipantFinancials[]>([]);
  const [selectedParticipant, setSelectedParticipant] = useState<string | null>(null);
  const [editingExpense, setEditingExpense] = useState<string | null>(null);
  const [editReason, setEditReason] = useState('');
  const [editAmount, setEditAmount] = useState('');
  const [showAddExpense, setShowAddExpense] = useState(false);
  const [newExpense, setNewExpense] = useState({ item: '', amount: '', date: new Date().toISOString().split('T')[0], contact: '', remarks: '' });

  // Load participant financial data
  useEffect(() => {
    const program = ProgramManager.getProgramById(programId);
    if (!program) return;

    const participants = ProgramManager.getParticipantsInProgram(programId);
    const financials: ParticipantFinancials[] = participants.map(participant => {
      const cyclesKey = `gbw_cycles_${participant.id}`;
      const cyclesData = localStorage.getItem(cyclesKey);
      const cycles = cyclesData ? JSON.parse(cyclesData) : [];
      const activeCycle = cycles.find((c: BalanceSheetCycle) => c.isActive) || null;
      const totalSpent = cycles.reduce((sum: number, cycle: BalanceSheetCycle) =>
        sum + cycle.expenses.reduce((expSum: number, exp: Expense) => expSum + exp.amount, 0), 0
      );
      const totalBudget = cycles.reduce((sum: number, cycle: BalanceSheetCycle) => sum + cycle.budget, 0);

      return {
        participant,
        cycles,
        activeCycle,
        totalSpent,
        totalBudget
      };
    });

    setParticipantFinancials(financials);
  }, [programId]);

  const handleEditExpense = (participantId: string, cycleId: string, expenseId: string, newAmount: number) => {
    if (!editReason.trim()) {
      alert('Please provide a reason for editing');
      return;
    }

    // Update the expense
    const cyclesKey = `gbw_cycles_${participantId}`;
    const cyclesData = localStorage.getItem(cyclesKey);
    if (!cyclesData) return;

    const cycles = JSON.parse(cyclesData);
    const cycleIndex = cycles.findIndex((c: BalanceSheetCycle) => c.id === cycleId);
    if (cycleIndex === -1) return;

    const expenseIndex = cycles[cycleIndex].expenses.findIndex((e: Expense) => e.id === expenseId);
    if (expenseIndex === -1) return;

    const oldAmount = cycles[cycleIndex].expenses[expenseIndex].amount;
    cycles[cycleIndex].expenses[expenseIndex].amount = newAmount;

    localStorage.setItem(cyclesKey, JSON.stringify(cycles));

    // Log the audit action
    PermissionManager.logAuditAction(
      managerId,
      'EDIT_EXPENSE',
      participantId,
      {
        cycleId,
        expenseId,
        oldAmount,
        newAmount,
        reason: editReason.trim()
      }
    );

    // Update state
    setParticipantFinancials(prev => prev.map(pf => {
      if (pf.participant.id === participantId) {
        return { ...pf, cycles };
      }
      return pf;
    }));

    setEditingExpense(null);
    setEditReason('');
    setEditAmount('');
    alert('Expense updated successfully');
  };

  const handleAddExpense = (participantId: string, cycleId: string) => {
    if (!newExpense.item.trim() || !newExpense.amount) {
      alert('Please provide item name and amount');
      return;
    }

    const cyclesKey = `gbw_cycles_${participantId}`;
    const cyclesData = localStorage.getItem(cyclesKey);
    if (!cyclesData) return;

    const cycles = JSON.parse(cyclesData);
    const cycleIndex = cycles.findIndex((c: BalanceSheetCycle) => c.id === cycleId);
    if (cycleIndex === -1) return;

    const expense: Expense = {
      id: uuidv4(),
      date: newExpense.date,
      item: newExpense.item.trim(),
      amount: parseFloat(newExpense.amount),
      contact: newExpense.contact.trim() || undefined,
      remarks: newExpense.remarks.trim() || undefined
    };

    cycles[cycleIndex].expenses.push(expense);
    localStorage.setItem(cyclesKey, JSON.stringify(cycles));

    // Log the audit action
    PermissionManager.logAuditAction(
      managerId,
      'ADD_EXPENSE',
      participantId,
      {
        cycleId,
        expense,
        addedBy: 'manager'
      }
    );

    // Update state
    setParticipantFinancials(prev => prev.map(pf => {
      if (pf.participant.id === participantId) {
        return { ...pf, cycles };
      }
      return pf;
    }));

    setShowAddExpense(false);
    setNewExpense({ item: '', amount: '', date: new Date().toISOString().split('T')[0], contact: '', remarks: '' });
    alert('Expense added successfully');
  };

  const handleDeleteExpense = (participantId: string, cycleId: string, expenseId: string) => {
    const reason = prompt('Please provide a reason for deleting this expense:');
    if (!reason) return;

    const cyclesKey = `gbw_cycles_${participantId}`;
    const cyclesData = localStorage.getItem(cyclesKey);
    if (!cyclesData) return;

    const cycles = JSON.parse(cyclesData);
    const cycleIndex = cycles.findIndex((c: BalanceSheetCycle) => c.id === cycleId);
    if (cycleIndex === -1) return;

    const expense = cycles[cycleIndex].expenses.find((e: Expense) => e.id === expenseId);
    cycles[cycleIndex].expenses = cycles[cycleIndex].expenses.filter((e: Expense) => e.id !== expenseId);

    localStorage.setItem(cyclesKey, JSON.stringify(cycles));

    // Log the audit action
    PermissionManager.logAuditAction(
      managerId,
      'DELETE_EXPENSE',
      participantId,
      {
        cycleId,
        expenseId,
        expense,
        reason
      }
    );

    // Update state
    setParticipantFinancials(prev => prev.map(pf => {
      if (pf.participant.id === participantId) {
        return { ...pf, cycles };
      }
      return pf;
    }));

    alert('Expense deleted successfully');
  };

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

  const calculateUtilization = (spent: number, budget: number) => {
    if (budget === 0) return 0;
    return Math.round((spent / budget) * 100);
  };

  const getUtilizationColor = (percentage: number) => {
    if (percentage >= 100) return 'text-red-600 bg-red-50';
    if (percentage >= 80) return 'text-orange-600 bg-orange-50';
    if (percentage >= 60) return 'text-yellow-600 bg-yellow-50';
    return 'text-green-600 bg-green-50';
  };

  const selectedParticipantData = selectedParticipant
    ? participantFinancials.find(pf => pf.participant.id === selectedParticipant)
    : null;

  return (
    <div className="space-y-6">
      <div className="bg-white shadow rounded-lg">
        <div className="p-6">
          <h3 className="text-lg font-medium text-gray-900 mb-4">Financial Overview</h3>

          {participantFinancials.length === 0 ? (
            <p className="text-gray-500">No participants enrolled in this program.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Participant
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Total Budget
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Total Spent
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Remaining
                    </th>
                    <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Utilization
                    </th>
                    <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Active Cycle
                    </th>
                    <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {participantFinancials.map(({ participant, cycles, activeCycle, totalSpent, totalBudget }) => {
                    const utilization = calculateUtilization(totalSpent, totalBudget);
                    return (
                      <tr key={participant.id}>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div>
                            <div className="text-sm font-medium text-gray-900">{participant.name}</div>
                            <div className="text-sm text-gray-500">{participant.email}</div>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm text-gray-900">
                          {formatCurrency(totalBudget)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm text-gray-900">
                          {formatCurrency(totalSpent)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm text-gray-900">
                          {formatCurrency(totalBudget - totalSpent)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-center">
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getUtilizationColor(utilization)}`}>
                            {utilization}%
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-center text-sm text-gray-500">
                          {activeCycle ? 'Yes' : 'No'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-center text-sm font-medium">
                          <button
                            onClick={() => setSelectedParticipant(participant.id)}
                            className="text-indigo-600 hover:text-indigo-900"
                          >
                            View Details
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Detailed View */}
      {selectedParticipantData && (
        <div className="bg-white shadow rounded-lg">
          <div className="p-6">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-medium text-gray-900">
                Financial Details - {selectedParticipantData.participant.name}
              </h3>
              <button
                onClick={() => setSelectedParticipant(null)}
                className="text-sm text-gray-500 hover:text-gray-700"
              >
                Close
              </button>
            </div>

            {selectedParticipantData.activeCycle ? (
              <div className="space-y-4">
                {/* Cycle Summary */}
                <div className="bg-gray-50 rounded-lg p-4">
                  <h4 className="text-sm font-medium text-gray-900 mb-2">Active Cycle</h4>
                  <div className="grid grid-cols-4 gap-4">
                    <div>
                      <dt className="text-xs text-gray-500">Period</dt>
                      <dd className="text-sm font-medium text-gray-900">
                        {formatDate(selectedParticipantData.activeCycle.startDate)} - {formatDate(selectedParticipantData.activeCycle.endDate)}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-xs text-gray-500">Budget</dt>
                      <dd className="text-sm font-medium text-gray-900">
                        {formatCurrency(selectedParticipantData.activeCycle.budget)}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-xs text-gray-500">Spent</dt>
                      <dd className="text-sm font-medium text-gray-900">
                        {formatCurrency(
                          selectedParticipantData.activeCycle.expenses.reduce((sum, exp) => sum + exp.amount, 0)
                        )}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-xs text-gray-500">Remaining</dt>
                      <dd className="text-sm font-medium text-gray-900">
                        {formatCurrency(
                          selectedParticipantData.activeCycle.budget -
                          selectedParticipantData.activeCycle.expenses.reduce((sum, exp) => sum + exp.amount, 0)
                        )}
                      </dd>
                    </div>
                  </div>
                </div>

                {/* Add Expense Button */}
                {managerUser.role === UserRole.ADMIN || managerUser.role === UserRole.PROGRAM_MANAGER ? (
                  <div className="flex justify-end">
                    <button
                      onClick={() => setShowAddExpense(true)}
                      className="px-4 py-2 bg-indigo-600 text-white text-sm rounded-md hover:bg-indigo-700"
                    >
                      Add Expense
                    </button>
                  </div>
                ) : null}

                {/* Add Expense Form */}
                {showAddExpense && (
                  <div className="bg-blue-50 border border-blue-200 rounded-md p-4">
                    <h4 className="text-sm font-medium text-blue-900 mb-3">Add New Expense</h4>
                    <div className="grid grid-cols-2 gap-3">
                      <input
                        type="text"
                        placeholder="Item name"
                        value={newExpense.item}
                        onChange={(e) => setNewExpense({ ...newExpense, item: e.target.value })}
                        className="px-3 py-2 border rounded-md text-sm"
                      />
                      <input
                        type="number"
                        placeholder="Amount"
                        value={newExpense.amount}
                        onChange={(e) => setNewExpense({ ...newExpense, amount: e.target.value })}
                        className="px-3 py-2 border rounded-md text-sm"
                      />
                      <input
                        type="date"
                        value={newExpense.date}
                        onChange={(e) => setNewExpense({ ...newExpense, date: e.target.value })}
                        className="px-3 py-2 border rounded-md text-sm"
                      />
                      <input
                        type="text"
                        placeholder="Contact (optional)"
                        value={newExpense.contact}
                        onChange={(e) => setNewExpense({ ...newExpense, contact: e.target.value })}
                        className="px-3 py-2 border rounded-md text-sm"
                      />
                      <input
                        type="text"
                        placeholder="Remarks (optional)"
                        value={newExpense.remarks}
                        onChange={(e) => setNewExpense({ ...newExpense, remarks: e.target.value })}
                        className="px-3 py-2 border rounded-md text-sm col-span-2"
                      />
                    </div>
                    <div className="flex justify-end space-x-2 mt-3">
                      <button
                        onClick={() => {
                          setShowAddExpense(false);
                          setNewExpense({ item: '', amount: '', date: new Date().toISOString().split('T')[0], contact: '', remarks: '' });
                        }}
                        className="px-3 py-1 bg-gray-300 text-gray-700 text-sm rounded hover:bg-gray-400"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={() => handleAddExpense(
                          selectedParticipantData.participant.id,
                          selectedParticipantData.activeCycle!.id
                        )}
                        className="px-3 py-1 bg-indigo-600 text-white text-sm rounded hover:bg-indigo-700"
                      >
                        Add Expense
                      </button>
                    </div>
                  </div>
                )}

                {/* Expenses Table */}
                <div>
                  <h4 className="text-sm font-medium text-gray-900 mb-2">Expenses</h4>
                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                          <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Item</th>
                          <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">Amount</th>
                          <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Contact</th>
                          <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Remarks</th>
                          <th className="px-4 py-2 text-center text-xs font-medium text-gray-500 uppercase">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {selectedParticipantData.activeCycle.expenses.map((expense) => (
                          <tr key={expense.id}>
                            <td className="px-4 py-2 text-sm text-gray-900">{formatDate(expense.date)}</td>
                            <td className="px-4 py-2 text-sm text-gray-900">{expense.item}</td>
                            <td className="px-4 py-2 text-sm text-gray-900 text-right">
                              {editingExpense === expense.id ? (
                                <input
                                  type="number"
                                  value={editAmount}
                                  onChange={(e) => setEditAmount(e.target.value)}
                                  className="w-20 px-2 py-1 border rounded text-sm"
                                />
                              ) : (
                                formatCurrency(expense.amount)
                              )}
                            </td>
                            <td className="px-4 py-2 text-sm text-gray-500">{expense.contact || '-'}</td>
                            <td className="px-4 py-2 text-sm text-gray-500">{expense.remarks || '-'}</td>
                            <td className="px-4 py-2 text-sm text-center">
                              {editingExpense === expense.id ? (
                                <div className="space-y-1">
                                  <input
                                    type="text"
                                    placeholder="Reason for edit..."
                                    value={editReason}
                                    onChange={(e) => setEditReason(e.target.value)}
                                    className="w-full px-2 py-1 border rounded text-xs"
                                  />
                                  <div className="flex justify-center space-x-1">
                                    <button
                                      onClick={() => handleEditExpense(
                                        selectedParticipantData.participant.id,
                                        selectedParticipantData.activeCycle!.id,
                                        expense.id,
                                        parseFloat(editAmount)
                                      )}
                                      className="text-green-600 hover:text-green-900"
                                    >
                                      Save
                                    </button>
                                    <button
                                      onClick={() => {
                                        setEditingExpense(null);
                                        setEditReason('');
                                        setEditAmount('');
                                      }}
                                      className="text-gray-600 hover:text-gray-900"
                                    >
                                      Cancel
                                    </button>
                                  </div>
                                </div>
                              ) : (
                                <div className="flex justify-center space-x-2">
                                  <button
                                    onClick={() => {
                                      setEditingExpense(expense.id);
                                      setEditAmount(expense.amount.toString());
                                    }}
                                    className="text-indigo-600 hover:text-indigo-900"
                                  >
                                    Edit
                                  </button>
                                  <button
                                    onClick={() => handleDeleteExpense(
                                      selectedParticipantData.participant.id,
                                      selectedParticipantData.activeCycle!.id,
                                      expense.id
                                    )}
                                    className="text-red-600 hover:text-red-900"
                                  >
                                    Delete
                                  </button>
                                </div>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Warning Notice */}
                <div className="bg-yellow-50 border border-yellow-200 rounded-md p-3">
                  <p className="text-sm text-yellow-800">
                    <strong>Note:</strong> All financial edits are logged in the audit trail for compliance and transparency.
                  </p>
                </div>
              </div>
            ) : (
              <p className="text-gray-500">No active financial cycle for this participant.</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default FinancialOversightTab;