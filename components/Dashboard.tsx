import React, { useState, useMemo, useEffect } from 'react';
import { User, BalanceSheetCycle, Milestone } from '../types';
import useLocalStorage from '../hooks/useLocalStorage';
import UserManager from '../utils/userManager';
import Header from './Header';
import TabNavigation from './TabNavigation';
import HomeTab from './tabs/HomeTab';
import FinanceTab from './tabs/FinanceTab';
import MilestoneTab from './tabs/MilestoneTab';
import AssignmentsTab from './tabs/AssignmentsTab';
import ProgramSelector from './ProgramSelector';
import { getMyPrograms } from '../src/lib/programs';

interface DashboardProps {
  user: User;
  onLogout: () => void;
}

const Dashboard: React.FC<DashboardProps> = ({ user, onLogout }) => {
  // Program state
  const [programs, setPrograms] = useState<any[]>([]);
  const [selectedProgram, setSelectedProgram] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Use user-specific storage keys
  const userCyclesKey = UserManager.getUserCyclesKey(user.id);
  const userMilestonesKey = `gbw_milestones_${user.id}`;

  const [cycles, setCycles] = useLocalStorage<BalanceSheetCycle[]>(userCyclesKey, []);
  const [milestones, setMilestones] = useLocalStorage<Milestone[]>(userMilestonesKey, []);
  const [activeTab, setActiveTab] = useState<string>('home');

  // Load programs on mount
  useEffect(() => {
    loadPrograms();
  }, []);

  // Load program data when a program is selected
  useEffect(() => {
    if (selectedProgram) {
      loadProgramData();
    }
  }, [selectedProgram]);

  const loadPrograms = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await getMyPrograms();
      setPrograms(data || []);

      // Auto-select if only one program
      if (data?.length === 1) {
        setSelectedProgram(data[0]);
      }
    } catch (err) {
      console.error('Failed to load programs:', err);
      setError(err instanceof Error ? err.message : 'Failed to load programs');
    } finally {
      setLoading(false);
    }
  };

  const loadProgramData = async () => {
    // For now, keep using localStorage
    // TODO: Load program-specific data from Supabase
    console.log('Loading data for program:', selectedProgram.name);
  };

  const handleProgramSwitch = () => {
    setSelectedProgram(null);
    setActiveTab('home');
  };

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

  // Show loading state
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading programs...</p>
        </div>
      </div>
    );
  }

  // Show error state
  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center p-8 max-w-md">
          <svg
            className="mx-auto h-12 w-12 text-red-500 mb-4"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
          <h2 className="text-xl font-bold text-gray-900 mb-2">Error Loading Programs</h2>
          <p className="text-gray-600 mb-4">{error}</p>
          <button
            onClick={loadPrograms}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  // Show program selector if no program is selected
  if (!selectedProgram) {
    return <ProgramSelector programs={programs} onSelect={setSelectedProgram} />;
  }

  return (
    <>
      <Header user={user} onLogout={onLogout} />

      {/* Program Context Header */}
      {selectedProgram && (
        <div className="bg-white shadow-sm border-b border-gray-200">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 md:px-8 py-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <svg
                  className="w-5 h-5 text-gray-400"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"
                  />
                </svg>
                <span className="text-sm text-gray-500">Current Program:</span>
                <span className="font-medium text-gray-900">{selectedProgram.name}</span>
                <span className={`ml-2 inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                  selectedProgram.status === 'active'
                    ? 'bg-green-100 text-green-800'
                    : 'bg-gray-100 text-gray-800'
                }`}>
                  {selectedProgram.status}
                </span>
              </div>
              {programs.length > 1 && (
                <button
                  onClick={handleProgramSwitch}
                  className="text-sm text-blue-600 hover:text-blue-800 font-medium"
                >
                  Switch Program
                </button>
              )}
            </div>
          </div>
        </div>
      )}

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