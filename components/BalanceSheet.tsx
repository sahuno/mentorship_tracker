import React from 'react';
import { BalanceSheetCycle, Expense } from '../types';
import PlusIcon from './icons/PlusIcon';
import EditIcon from './icons/EditIcon';
import DeleteIcon from './icons/DeleteIcon';

interface BalanceSheetProps {
  cycle: BalanceSheetCycle;
  onAddExpense: () => void;
  onNewCycle: () => void;
  onEditExpense: (expense: Expense) => void;
  onDeleteExpense: (expenseId: string) => void;
}

const BalanceSheet: React.FC<BalanceSheetProps> = ({ cycle, onAddExpense, onNewCycle, onEditExpense, onDeleteExpense }) => {
  const totalSpent = cycle.expenses.reduce((sum, expense) => sum + expense.amount, 0);
  const remainingBudget = cycle.budget - totalSpent;
  const isOverBudget = remainingBudget < 0;

  const formatDate = (dateString: string) => new Date(dateString).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });

  return (
    <div className="bg-white rounded-lg shadow-lg overflow-hidden">
      <div className="p-6 border-b border-gray-200">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h2 className="text-3xl font-extrabold text-gray-900">Spending Balance Sheet</h2>
            <p className="mt-1 text-gray-500 font-medium">
              Cycle: {formatDate(cycle.startDate)} - {formatDate(cycle.endDate)}
            </p>
          </div>
          <div className="flex items-center gap-4">
             <button
              onClick={onNewCycle}
              className="px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-colors duration-200"
            >
              Close & Start New Cycle
            </button>
            <button
              onClick={onAddExpense}
              className="inline-flex items-center gap-2 px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-colors duration-200"
            >
              <PlusIcon className="h-5 w-5" />
              Add New Entry
            </button>
          </div>
        </div>

        <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-6 text-center">
          <div className="bg-gray-100 p-4 rounded-lg">
            <p className="text-sm font-medium text-gray-500">Allowable Budget</p>
            <p className="mt-1 text-2xl font-semibold text-gray-900">${cycle.budget.toFixed(2)}</p>
          </div>
          <div className="bg-green-50 p-4 rounded-lg">
            <p className="text-sm font-medium text-green-700">Total Spent</p>
            <p className="mt-1 text-2xl font-semibold text-green-800">${totalSpent.toFixed(2)}</p>
          </div>
          <div className={`${isOverBudget ? 'bg-red-50' : 'bg-blue-50'} p-4 rounded-lg`}>
            <p className={`text-sm font-medium ${isOverBudget ? 'text-red-700' : 'text-blue-700'}`}>Remaining</p>
            <p className={`mt-1 text-2xl font-semibold ${isOverBudget ? 'text-red-800' : 'text-blue-800'}`}>
              ${remainingBudget.toFixed(2)}
            </p>
          </div>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th scope="col" className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Date</th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Item/Description</th>
              <th scope="col" className="px-6 py-3 text-right text-xs font-bold text-gray-500 uppercase tracking-wider">Amount</th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Contact</th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Remarks</th>
              <th scope="col" className="px-6 py-3 text-center text-xs font-bold text-gray-500 uppercase tracking-wider">Receipt</th>
              <th scope="col" className="px-6 py-3 text-right text-xs font-bold text-gray-500 uppercase tracking-wider">Actions</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {cycle.expenses.length > 0 ? cycle.expenses.map(expense => (
              <tr key={expense.id} className="hover:bg-gray-50 transition-colors duration-200">
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{formatDate(expense.date)}</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{expense.item}</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 text-right">${expense.amount.toFixed(2)}</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{expense.contact || '-'}</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 max-w-xs truncate">{expense.remarks || '-'}</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 text-center">
                  {expense.receiptUrl ? <a href={expense.receiptUrl} target="_blank" rel="noopener noreferrer" className="text-indigo-600 hover:text-indigo-900">View</a> : 'N/A'}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-right">
                   <button onClick={() => onEditExpense(expense)} className="text-indigo-600 hover:text-indigo-900 p-1" aria-label={`Edit expense ${expense.item}`}>
                     <EditIcon className="h-5 w-5"/>
                   </button>
                   <button onClick={() => onDeleteExpense(expense.id)} className="text-red-600 hover:text-red-900 ml-2 p-1" aria-label={`Delete expense ${expense.item}`}>
                     <DeleteIcon className="h-5 w-5"/>
                   </button>
                </td>
              </tr>
            )) : (
              <tr>
                <td colSpan={7} className="px-6 py-12 text-center text-gray-500">No expenses recorded for this cycle.</td>
              </tr>
            )}
            <tr className="bg-gray-50 font-bold">
              <td colSpan={2} className="px-6 py-4 text-right text-gray-700">Total:</td>
              <td className="px-6 py-4 text-right text-gray-900">${totalSpent.toFixed(2)}</td>
              <td colSpan={4}></td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default BalanceSheet;
