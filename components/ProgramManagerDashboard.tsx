import React, { useState, useMemo } from 'react';
import { User, Program, UserRole, Milestone } from '../types';
import useLocalStorage from '../hooks/useLocalStorage';
import Header from './Header';
import TabNavigation from './TabNavigation';
import CreateProgramModal from './CreateProgramModal';
import AssignMilestoneModal from './AssignMilestoneModal';
import ParticipantDetailsModal from './ParticipantDetailsModal';
import ProgressMatrixView from './ProgressMatrixView';
import FinancialOversightTab from './FinancialOversightTab';
import ManageProgramParticipantsModal from './ManageProgramParticipantsModal';
import ProgramManager from '../utils/programManager';
import UserManager from '../utils/userManager';
import PermissionManager from '../utils/permissions';
import NotificationManager from '../utils/notificationManager';
import { v4 as uuidv4 } from 'uuid';

interface ProgramManagerDashboardProps {
  user: User;
  onLogout: () => void;
}

const ProgramManagerDashboard: React.FC<ProgramManagerDashboardProps> = ({ user, onLogout }) => {
  const [activeTab, setActiveTab] = useState<string>('overview');
  const [selectedProgramId, setSelectedProgramId] = useState<string | null>(null);
  const [showCreateProgramModal, setShowCreateProgramModal] = useState(false);
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [selectedParticipantId, setSelectedParticipantId] = useState<string | null>(null);
  const [showProgressMatrix, setShowProgressMatrix] = useState(false);
  const [programs, setPrograms] = useState<Program[]>([]);
  const [showManageParticipantsModal, setShowManageParticipantsModal] = useState(false);
  const [programToManage, setProgramToManage] = useState<Program | null>(null);

  // Get programs managed by this user
  const managedPrograms = useMemo(() => {
    return ProgramManager.getProgramsForUser(user.id);
  }, [user.id, programs]); // Re-fetch when programs change

  const handleCreateProgram = (newProgram: Program) => {
    setPrograms([...programs, newProgram]);
    setSelectedProgramId(newProgram.id);
    setShowCreateProgramModal(false);
    // Refresh the page to update program list
    window.location.reload();
  };

  const handleAssignMilestone = (assignments: any[]) => {
    // Process each assignment
    assignments.forEach(({ participantId, milestone }) => {
      const milestoneKey = `gbw_milestones_${participantId}`;
      const existingMilestones = localStorage.getItem(milestoneKey);
      const milestones = existingMilestones ? JSON.parse(existingMilestones) : [];

      // Create the milestone with unique ID
      const newMilestone: Milestone = {
        ...milestone,
        id: uuidv4(),
        userId: participantId,
        createdAt: new Date().toISOString(),
        progressReports: []
      };

      milestones.push(newMilestone);
      localStorage.setItem(milestoneKey, JSON.stringify(milestones));

      // Create notification for participant
      const participant = UserManager.getUserById(participantId);
      if (participant && selectedProgram) {
        NotificationManager.notifyAssignment(
          participantId,
          user.name,
          milestone.title,
          selectedProgram.name,
          newMilestone.id,
          selectedProgram.id,
          milestone.assignmentInfo?.isRequired || false,
          milestone.assignmentInfo?.canDecline || false
        );
      }

      // Log the assignment
      PermissionManager.logAuditAction(
        user.id,
        'ASSIGN_MILESTONE',
        participantId,
        {
          milestoneId: newMilestone.id,
          milestoneTitle: milestone.title,
          programId: selectedProgramId
        }
      );
    });

    setShowAssignModal(false);
    // Optionally show success message
    alert(`Successfully assigned milestone to ${assignments.length} participant(s)`);
  };

  // Set initial selected program
  React.useEffect(() => {
    if (managedPrograms.length > 0 && !selectedProgramId) {
      setSelectedProgramId(managedPrograms[0].id);
    }
  }, [managedPrograms, selectedProgramId]);

  const selectedProgram = selectedProgramId
    ? ProgramManager.getProgramById(selectedProgramId)
    : null;

  // Get participants in selected program
  const participants = selectedProgram
    ? ProgramManager.getParticipantsInProgram(selectedProgram.id)
    : [];

  // Tab configuration for Program Manager
  const tabs = [
    {
      id: 'overview',
      label: 'Overview',
      icon: (
        <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
        </svg>
      )
    },
    {
      id: 'programs',
      label: 'Programs',
      icon: (
        <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
        </svg>
      )
    },
    {
      id: 'participants',
      label: 'Participants',
      icon: (
        <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
        </svg>
      )
    },
    {
      id: 'milestones',
      label: 'Milestone Management',
      icon: (
        <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
        </svg>
      )
    },
    {
      id: 'financial',
      label: 'Financial Oversight',
      icon: (
        <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      )
    },
    {
      id: 'reports',
      label: 'Reports & Analytics',
      icon: (
        <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17v1a1 1 0 001 1h4a1 1 0 001-1v-1m3-2V8a1 1 0 00-1-1H4a1 1 0 00-1 1v6h18zm-3-3a1 1 0 11-2 0 1 1 0 012 0zm-7 0a1 1 0 11-2 0 1 1 0 012 0z" />
        </svg>
      )
    }
  ];

  // Calculate overview statistics
  const overviewStats = useMemo(() => {
    if (!selectedProgram) return null;

    const stats = ProgramManager.getProgramStatistics(selectedProgram.id);

    // Get milestone completion rates
    const participantMilestones = participants.map(p => {
      const milestoneKey = `gbw_milestones_${p.id}`;
      const milestonesData = localStorage.getItem(milestoneKey);
      const milestones = milestonesData ? JSON.parse(milestonesData) : [];

      const total = milestones.filter((m: any) => m.programId === selectedProgram.id).length;
      const completed = milestones.filter((m: any) =>
        m.programId === selectedProgram.id && m.status === 'completed'
      ).length;

      return { total, completed };
    });

    const totalMilestones = participantMilestones.reduce((sum, p) => sum + p.total, 0);
    const completedMilestones = participantMilestones.reduce((sum, p) => sum + p.completed, 0);
    const milestoneCompletionRate = totalMilestones > 0
      ? Math.round((completedMilestones / totalMilestones) * 100)
      : 0;

    return {
      ...stats,
      totalMilestones,
      completedMilestones,
      milestoneCompletionRate,
      activeParticipants: participants.filter(p => {
        // Check if participant has recent activity
        const milestoneKey = `gbw_milestones_${p.id}`;
        const milestonesData = localStorage.getItem(milestoneKey);
        const milestones = milestonesData ? JSON.parse(milestonesData) : [];

        const recentActivity = milestones.some((m: any) => {
          if (!m.progressReports || m.progressReports.length === 0) return false;
          const lastReport = m.progressReports[m.progressReports.length - 1];
          const daysSinceReport = Math.floor(
            (Date.now() - new Date(lastReport.date).getTime()) / (1000 * 60 * 60 * 24)
          );
          return daysSinceReport < 7;
        });

        return recentActivity;
      }).length
    };
  }, [selectedProgram, participants]);

  return (
    <>
      <Header user={user} onLogout={onLogout} />

      {/* Program Selector */}
      <div className="bg-white border-b px-4 sm:px-6 md:px-8">
        <div className="max-w-7xl mx-auto py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <label htmlFor="program-select" className="text-sm font-medium text-gray-700">
                Current Program:
              </label>
              <select
                id="program-select"
                value={selectedProgramId || ''}
                onChange={(e) => setSelectedProgramId(e.target.value)}
                className="block w-64 px-3 py-2 text-sm border-gray-300 rounded-md focus:ring-indigo-500 focus:border-indigo-500"
              >
                {managedPrograms.length === 0 ? (
                  <option value="">No programs assigned</option>
                ) : (
                  managedPrograms.map(program => (
                    <option key={program.id} value={program.id}>
                      {program.name} ({program.status})
                    </option>
                  ))
                )}
              </select>
            </div>
            <div className="text-sm text-gray-500">
              Role: <span className="font-medium text-gray-900">Program Manager</span>
            </div>
          </div>
        </div>
      </div>

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
        {activeTab === 'overview' && selectedProgram && overviewStats && (
          <div className="space-y-6">
            <h2 className="text-2xl font-bold text-gray-900">{selectedProgram.name} Overview</h2>

            {/* Statistics Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <div className="bg-white rounded-lg shadow p-6">
                <div className="flex items-center">
                  <div className="flex-shrink-0 bg-indigo-500 rounded-md p-3">
                    <svg className="h-6 w-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                    </svg>
                  </div>
                  <div className="ml-5">
                    <dl>
                      <dt className="text-sm font-medium text-gray-500 truncate">Total Participants</dt>
                      <dd className="text-3xl font-semibold text-gray-900">{overviewStats.totalParticipants}</dd>
                    </dl>
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-lg shadow p-6">
                <div className="flex items-center">
                  <div className="flex-shrink-0 bg-green-500 rounded-md p-3">
                    <svg className="h-6 w-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                    </svg>
                  </div>
                  <div className="ml-5">
                    <dl>
                      <dt className="text-sm font-medium text-gray-500 truncate">Active Participants</dt>
                      <dd className="text-3xl font-semibold text-gray-900">{overviewStats.activeParticipants}</dd>
                    </dl>
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-lg shadow p-6">
                <div className="flex items-center">
                  <div className="flex-shrink-0 bg-yellow-500 rounded-md p-3">
                    <svg className="h-6 w-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                  <div className="ml-5">
                    <dl>
                      <dt className="text-sm font-medium text-gray-500 truncate">Milestone Completion</dt>
                      <dd className="text-3xl font-semibold text-gray-900">{overviewStats.milestoneCompletionRate}%</dd>
                    </dl>
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-lg shadow p-6">
                <div className="flex items-center">
                  <div className="flex-shrink-0 bg-purple-500 rounded-md p-3">
                    <svg className="h-6 w-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                  <div className="ml-5">
                    <dl>
                      <dt className="text-sm font-medium text-gray-500 truncate">Days Remaining</dt>
                      <dd className="text-3xl font-semibold text-gray-900">
                        {overviewStats.daysRemaining !== null ? overviewStats.daysRemaining : 'N/A'}
                      </dd>
                    </dl>
                  </div>
                </div>
              </div>
            </div>

            {/* Program Details */}
            <div className="bg-white shadow rounded-lg p-6">
              <h3 className="text-lg font-medium text-gray-900 mb-4">Program Details</h3>
              <dl className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <dt className="text-sm font-medium text-gray-500">Description</dt>
                  <dd className="mt-1 text-sm text-gray-900">{selectedProgram.description}</dd>
                </div>
                <div>
                  <dt className="text-sm font-medium text-gray-500">Status</dt>
                  <dd className="mt-1">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                      selectedProgram.status === 'active' ? 'bg-green-100 text-green-800' :
                      selectedProgram.status === 'completed' ? 'bg-gray-100 text-gray-800' :
                      'bg-yellow-100 text-yellow-800'
                    }`}>
                      {selectedProgram.status}
                    </span>
                  </dd>
                </div>
                <div>
                  <dt className="text-sm font-medium text-gray-500">Start Date</dt>
                  <dd className="mt-1 text-sm text-gray-900">
                    {new Date(selectedProgram.startDate).toLocaleDateString()}
                  </dd>
                </div>
                <div>
                  <dt className="text-sm font-medium text-gray-500">End Date</dt>
                  <dd className="mt-1 text-sm text-gray-900">
                    {new Date(selectedProgram.endDate).toLocaleDateString()}
                  </dd>
                </div>
              </dl>
            </div>

            {/* Quick Actions */}
            <div className="bg-white shadow rounded-lg p-6">
              <h3 className="text-lg font-medium text-gray-900 mb-4">Quick Actions</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                <button
                  onClick={() => setActiveTab('milestones')}
                  className="p-4 border border-gray-200 rounded-lg hover:border-indigo-500 hover:shadow-md transition-all"
                >
                  <svg className="h-8 w-8 text-indigo-600 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
                  </svg>
                  <p className="text-sm font-medium text-gray-900">Assign Milestones</p>
                </button>
                <button
                  onClick={() => setActiveTab('participants')}
                  className="p-4 border border-gray-200 rounded-lg hover:border-indigo-500 hover:shadow-md transition-all"
                >
                  <svg className="h-8 w-8 text-indigo-600 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                  </svg>
                  <p className="text-sm font-medium text-gray-900">View Participants</p>
                </button>
                <button
                  onClick={() => setActiveTab('reports')}
                  className="p-4 border border-gray-200 rounded-lg hover:border-indigo-500 hover:shadow-md transition-all"
                >
                  <svg className="h-8 w-8 text-indigo-600 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17v1a1 1 0 001 1h4a1 1 0 001-1v-1m3-2V8a1 1 0 00-1-1H4a1 1 0 00-1 1v6h18zm-3-3a1 1 0 11-2 0 1 1 0 012 0zm-7 0a1 1 0 11-2 0 1 1 0 012 0z" />
                  </svg>
                  <p className="text-sm font-medium text-gray-900">Generate Reports</p>
                </button>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'programs' && (
          <div className="space-y-6">
            <div className="flex justify-between items-center">
              <h2 className="text-2xl font-bold text-gray-900">Managed Programs</h2>
              {user.role === UserRole.ADMIN && (
                <button
                  onClick={() => setShowCreateProgramModal(true)}
                  className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 transition-colors"
                >
                  Create Program
                </button>
              )}
            </div>
            <div className="bg-white shadow rounded-lg">
              <div className="p-6">
                <div className="space-y-4">
                  {managedPrograms.length === 0 ? (
                    <p className="text-gray-500 text-center py-8">No programs assigned yet.</p>
                  ) : (
                    managedPrograms.map(program => {
                      const stats = ProgramManager.getProgramStatistics(program.id);
                      return (
                        <div key={program.id} className="border rounded-lg p-4 hover:bg-gray-50">
                          <div className="flex justify-between items-start mb-3">
                            <div className="flex-1">
                              <h3 className="text-lg font-medium text-gray-900">{program.name}</h3>
                              <p className="text-sm text-gray-500 mt-1">{program.description}</p>
                              <div className="mt-2 flex items-center space-x-4 text-sm">
                                <span className="text-gray-500">
                                  {stats.totalParticipants} participants
                                </span>
                                <span className="text-gray-500">•</span>
                                <span className="text-gray-500">
                                  {new Date(program.startDate).toLocaleDateString()} - {new Date(program.endDate).toLocaleDateString()}
                                </span>
                              </div>
                            </div>
                            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                              program.status === 'active' ? 'bg-green-100 text-green-800' :
                              program.status === 'completed' ? 'bg-gray-100 text-gray-800' :
                              'bg-yellow-100 text-yellow-800'
                            }`}>
                              {program.status}
                            </span>
                          </div>
                          <div className="flex items-center space-x-2">
                            <button
                              onClick={() => {
                                setProgramToManage(program);
                                setShowManageParticipantsModal(true);
                              }}
                              className="flex-1 px-3 py-2 bg-indigo-600 text-white text-sm rounded-md hover:bg-indigo-700 transition-colors"
                            >
                              Manage Participants
                            </button>
                            <button
                              onClick={() => setSelectedProgramId(program.id)}
                              className="flex-1 px-3 py-2 bg-gray-100 text-gray-700 text-sm rounded-md hover:bg-gray-200 transition-colors"
                            >
                              View Details
                            </button>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'participants' && (
          <div className="space-y-6">
            <div className="flex justify-between items-center">
              <h2 className="text-2xl font-bold text-gray-900">Participants</h2>
              {selectedProgram && participants.length > 0 && (
                <button
                  onClick={() => setShowProgressMatrix(!showProgressMatrix)}
                  className="px-4 py-2 bg-indigo-600 text-white text-sm rounded-md hover:bg-indigo-700 transition-colors"
                >
                  {showProgressMatrix ? 'Show Table' : 'Show Progress Matrix'}
                </button>
              )}
            </div>
            {selectedProgram ? (
              showProgressMatrix ? (
                <div className="bg-white shadow rounded-lg p-6">
                  <ProgressMatrixView programId={selectedProgram.id} managerId={user.id} />
                </div>
              ) : (
                <div className="bg-white shadow rounded-lg">
                  <div className="p-6">
                  {participants.length === 0 ? (
                    <p className="text-gray-500 text-center py-8">No participants enrolled yet.</p>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                          <tr>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                              Name
                            </th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                              Email
                            </th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                              Milestones
                            </th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                              Last Activity
                            </th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                              Actions
                            </th>
                          </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                          {participants.map(participant => {
                            // Get participant's milestones
                            const milestoneKey = `gbw_milestones_${participant.id}`;
                            const milestonesData = localStorage.getItem(milestoneKey);
                            const milestones = milestonesData ? JSON.parse(milestonesData) : [];
                            const programMilestones = milestones.filter((m: any) => m.programId === selectedProgram.id);

                            return (
                              <tr key={participant.id}>
                                <td className="px-6 py-4 whitespace-nowrap">
                                  <div className="text-sm font-medium text-gray-900">{participant.name}</div>
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap">
                                  <div className="text-sm text-gray-500">{participant.email}</div>
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap">
                                  <div className="text-sm text-gray-900">{programMilestones.length} milestones</div>
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap">
                                  <div className="text-sm text-gray-500">Recently active</div>
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                                  <button
                                    onClick={() => setSelectedParticipantId(participant.id)}
                                    className="text-indigo-600 hover:text-indigo-900 mr-4"
                                  >
                                    View Details
                                  </button>
                                  <button
                                    onClick={() => setShowAssignModal(true)}
                                    className="text-indigo-600 hover:text-indigo-900"
                                  >
                                    Assign Milestone
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
              )
            ) : (
              <p className="text-gray-500 text-center py-8">Please select a program to view participants.</p>
            )}
          </div>
        )}

        {/* Placeholder for other tabs */}
        {activeTab === 'milestones' && (
          <div className="space-y-6">
            <div className="flex justify-between items-center">
              <h2 className="text-2xl font-bold text-gray-900">Milestone Management</h2>
              {selectedProgram && (
                <button
                  onClick={() => setShowAssignModal(true)}
                  className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 transition-colors"
                >
                  Assign New Milestone
                </button>
              )}
            </div>

            {selectedProgram ? (
              <div className="bg-white shadow rounded-lg p-6">
                <p className="text-gray-600">
                  Manage milestone assignments for participants in {selectedProgram.name}.
                </p>
                <div className="mt-4">
                  <button
                    onClick={() => setShowAssignModal(true)}
                    className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700"
                  >
                    <svg className="mr-2 h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                    </svg>
                    Bulk Assign Milestones
                  </button>
                </div>
              </div>
            ) : (
              <p className="text-gray-500">Please select a program to manage milestones.</p>
            )}
          </div>
        )}

        {activeTab === 'financial' && (
          <div className="space-y-6">
            <h2 className="text-2xl font-bold text-gray-900">Financial Oversight</h2>
            {selectedProgram ? (
              <FinancialOversightTab
                programId={selectedProgram.id}
                managerId={user.id}
                managerUser={user}
              />
            ) : (
              <p className="text-gray-500">Please select a program to view financial data.</p>
            )}
          </div>
        )}

        {activeTab === 'reports' && (
          <div className="space-y-6">
            <h2 className="text-2xl font-bold text-gray-900">Reports & Analytics</h2>
            <p className="text-gray-500">Advanced reporting and analytics features coming soon...</p>
          </div>
        )}
      </main>

      {/* Create Program Modal */}
      {showCreateProgramModal && (
        <CreateProgramModal
          user={user}
          onClose={() => setShowCreateProgramModal(false)}
          onSave={handleCreateProgram}
        />
      )}

      {/* Assign Milestone Modal */}
      {showAssignModal && selectedProgramId && (
        <AssignMilestoneModal
          user={user}
          programId={selectedProgramId}
          onClose={() => setShowAssignModal(false)}
          onAssign={handleAssignMilestone}
        />
      )}

      {/* Participant Details Modal */}
      {selectedParticipantId && selectedProgramId && (
        <ParticipantDetailsModal
          participantId={selectedParticipantId}
          programId={selectedProgramId}
          managerId={user.id}
          onClose={() => setSelectedParticipantId(null)}
        />
      )}

      {showManageParticipantsModal && programToManage && (
        <ManageProgramParticipantsModal
          program={programToManage}
          onClose={() => {
            setShowManageParticipantsModal(false);
            setProgramToManage(null);
          }}
          onUpdate={() => {
            // Refresh the programs list
            setPrograms([...programs]);
          }}
        />
      )}
    </>
  );
};

export default ProgramManagerDashboard;