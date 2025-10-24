import React from 'react';
import { User, BalanceSheetCycle } from '../../types';

interface HomeTabProps {
  user: User;
  cycles: BalanceSheetCycle[];
}

const HomeTab: React.FC<HomeTabProps> = ({ user, cycles }) => {
  const hasActiveCycle = cycles.some(c => c.isActive);

  return (
    <div className="space-y-6">
      {/* Welcome Section - Only this remains */}
      <div className="bg-gradient-to-r from-indigo-500 to-purple-600 rounded-lg shadow-lg p-8 text-white">
        <h1 className="text-3xl font-bold">Welcome back, {user.name}!</h1>
        <p className="mt-3 text-indigo-100 text-lg">
          {hasActiveCycle
            ? `You're doing great with your budget management.`
            : `Start a new spending cycle to track your expenses.`}
        </p>
      </div>
    </div>
  );
};

export default HomeTab;