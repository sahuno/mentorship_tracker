import React, { useState, useMemo } from 'react';
import { User, BalanceSheetCycle, Milestone } from '../types';
import useLocalStorage from '../hooks/useLocalStorage';
import UserManager from '../utils/userManager';
import Header from './Header';
import TabNavigation from './TabNavigation';
import HomeTab from './tabs/HomeTab';
import FinanceTab from './tabs/FinanceTab';
import MilestoneTab from './tabs/MilestoneTab';
import AssignmentsTab from './tabs/AssignmentsTab';

interface DashboardProps {
  user: User;
  onLogout: () => void;
}

const Dashboard: React.FC<DashboardProps> = ({ user, onLogout }) => {
  // Use user-specific storage keys
  const userCyclesKey = UserManager.getUserCyclesKey(user.id);
  const userMilestonesKey = `gbw_milestones_${user.id}`;

  const [cycles, setCycles] = useLocalStorage<BalanceSheetCycle[]>(userCyclesKey, []);
  const [milestones, setMilestones] = useLocalStorage<Milestone[]>(userMilestonesKey, []);
  const [activeTab, setActiveTab] = useState<string>('home');

  const activeCycle = useMemo(() => cycles.find(c => c.isActive), [cycles]);

  // Check if user has any assignments
  const hasAssignments = milestones.some(m =>
    m.assignmentInfo && m.assignmentInfo.assignmentType !== 'self_created'
  );

  // Tab configuration
  const tabs = [
    {
      id: 'home',
      label: 'Home',
      icon: (
        <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
        </svg>
      )
    },
    {
      id: 'finance',
      label: 'Finance',
      icon: (
        <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      )
    },
    {
      id: 'milestones',
      label: 'Milestones',
      icon: (
        <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      )
    }
  ];

  // Add Assignments tab if user has assignments
  if (hasAssignments) {
    tabs.push({
      id: 'assignments',
      label: 'Assignments',
      icon: (
        <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
        </svg>
      )
    });
  }

  const handleCyclesUpdate = (updatedCycles: BalanceSheetCycle[]) => {
    setCycles(updatedCycles);
  };

  return (
    <>
      <Header user={user} onLogout={onLogout} />

      {/* Tab Navigation */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 md:px-8">
        <TabNavigation
          tabs={tabs}
          activeTab={activeTab}
          onTabChange={setActiveTab}
        />
      </div>

      {/* Tab Content */}
      <main className="p-4 sm:p-6 md:p-8 max-w-7xl mx-auto">
        {activeTab === 'home' && (
          <HomeTab user={user} cycles={cycles} />
        )}

        {activeTab === 'finance' && (
          <FinanceTab
            user={user}
            cycles={cycles}
            activeCycle={activeCycle}
            onCyclesUpdate={handleCyclesUpdate}
          />
        )}

        {activeTab === 'milestones' && (
          <MilestoneTab
            user={user}
            milestones={milestones}
            onMilestonesUpdate={setMilestones}
          />
        )}

        {activeTab === 'assignments' && (
          <AssignmentsTab
            user={user}
            milestones={milestones}
            onMilestonesUpdate={setMilestones}
          />
        )}
      </main>
    </>
  );
};

export default Dashboard;