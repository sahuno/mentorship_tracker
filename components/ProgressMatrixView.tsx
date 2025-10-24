import React, { useState, useMemo } from 'react';
import { User, Milestone, MilestoneStatus, Program } from '../types';
import ProgramManager from '../utils/programManager';

interface ProgressMatrixViewProps {
  programId: string;
  managerId: string;
}

interface ParticipantProgress {
  participant: User;
  milestones: Milestone[];
  stats: {
    total: number;
    completed: number;
    inProgress: number;
    notStarted: number;
    completionRate: number;
    reportsSubmitted: number;
    lastActivity: string | null;
  };
}

const ProgressMatrixView: React.FC<ProgressMatrixViewProps> = ({ programId, managerId }) => {
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [sortBy, setSortBy] = useState<'name' | 'completion' | 'activity'>('name');
  const [filterStatus, setFilterStatus] = useState<'all' | 'active' | 'inactive'>('all');

  // Get program and participants
  const program = ProgramManager.getProgramById(programId);
  const participants = program ? ProgramManager.getParticipantsInProgram(programId) : [];

  // Build progress data for each participant
  const participantProgress: ParticipantProgress[] = useMemo(() => {
    return participants.map(participant => {
      const milestoneKey = `gbw_milestones_${participant.id}`;
      const milestonesData = localStorage.getItem(milestoneKey);
      const allMilestones = milestonesData ? JSON.parse(milestonesData) : [];
      const programMilestones = allMilestones.filter((m: Milestone) => m.programId === programId);

      // Calculate statistics
      const stats = {
        total: programMilestones.length,
        completed: programMilestones.filter((m: Milestone) => m.status === MilestoneStatus.COMPLETED).length,
        inProgress: programMilestones.filter((m: Milestone) => m.status === MilestoneStatus.IN_PROGRESS).length,
        notStarted: programMilestones.filter((m: Milestone) => m.status === MilestoneStatus.NOT_STARTED).length,
        completionRate: programMilestones.length > 0
          ? Math.round((programMilestones.filter((m: Milestone) => m.status === MilestoneStatus.COMPLETED).length / programMilestones.length) * 100)
          : 0,
        reportsSubmitted: programMilestones.reduce((sum: number, m: Milestone) => sum + m.progressReports.length, 0),
        lastActivity: getLastActivity(programMilestones)
      };

      return {
        participant,
        milestones: programMilestones,
        stats
      };
    });
  }, [participants, programId]);

  // Get last activity date
  function getLastActivity(milestones: Milestone[]): string | null {
    const allReports = milestones.flatMap(m => m.progressReports);
    if (allReports.length === 0) return null;

    const lastReport = allReports.sort((a, b) =>
      new Date(b.date).getTime() - new Date(a.date).getTime()
    )[0];

    return lastReport ? lastReport.date : null;
  }

  // Sort participants
  const sortedParticipants = useMemo(() => {
    let sorted = [...participantProgress];

    switch (sortBy) {
      case 'completion':
        sorted.sort((a, b) => b.stats.completionRate - a.stats.completionRate);
        break;
      case 'activity':
        sorted.sort((a, b) => {
          if (!a.stats.lastActivity && !b.stats.lastActivity) return 0;
          if (!a.stats.lastActivity) return 1;
          if (!b.stats.lastActivity) return -1;
          return new Date(b.stats.lastActivity).getTime() - new Date(a.stats.lastActivity).getTime();
        });
        break;
      default:
        sorted.sort((a, b) => a.participant.name.localeCompare(b.participant.name));
    }

    // Apply filter
    if (filterStatus === 'active') {
      sorted = sorted.filter(p => p.stats.lastActivity &&
        (Date.now() - new Date(p.stats.lastActivity).getTime()) < 7 * 24 * 60 * 60 * 1000
      );
    } else if (filterStatus === 'inactive') {
      sorted = sorted.filter(p => !p.stats.lastActivity ||
        (Date.now() - new Date(p.stats.lastActivity).getTime()) >= 7 * 24 * 60 * 60 * 1000
      );
    }

    return sorted;
  }, [participantProgress, sortBy, filterStatus]);

  const formatDate = (dateString: string | null) => {
    if (!dateString) return 'No activity';
    const date = new Date(dateString);
    const now = new Date();
    const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays} days ago`;
    if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`;
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  const getProgressColor = (rate: number) => {
    if (rate >= 80) return 'bg-green-500';
    if (rate >= 60) return 'bg-blue-500';
    if (rate >= 40) return 'bg-yellow-500';
    if (rate >= 20) return 'bg-orange-500';
    return 'bg-red-500';
  };

  const getActivityStatus = (lastActivity: string | null) => {
    if (!lastActivity) return { color: 'bg-gray-100 text-gray-800', label: 'Inactive' };
    const daysSince = Math.floor((Date.now() - new Date(lastActivity).getTime()) / (1000 * 60 * 60 * 24));
    if (daysSince <= 3) return { color: 'bg-green-100 text-green-800', label: 'Active' };
    if (daysSince <= 7) return { color: 'bg-yellow-100 text-yellow-800', label: 'Recent' };
    return { color: 'bg-red-100 text-red-800', label: 'Inactive' };
  };

  if (!program) {
    return <div className="text-gray-500">Program not found</div>;
  }

  return (
    <div className="space-y-6">
      {/* Controls */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center space-y-4 sm:space-y-0">
        <div className="flex items-center space-x-4">
          {/* View Mode Toggle */}
          <div className="flex items-center space-x-2">
            <button
              onClick={() => setViewMode('grid')}
              className={`p-2 rounded ${viewMode === 'grid' ? 'bg-indigo-100 text-indigo-700' : 'text-gray-500 hover:bg-gray-100'}`}
              title="Grid View"
            >
              <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
              </svg>
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={`p-2 rounded ${viewMode === 'list' ? 'bg-indigo-100 text-indigo-700' : 'text-gray-500 hover:bg-gray-100'}`}
              title="List View"
            >
              <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
          </div>

          {/* Sort Options */}
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as any)}
            className="text-sm border-gray-300 rounded-md focus:ring-indigo-500 focus:border-indigo-500"
          >
            <option value="name">Sort by Name</option>
            <option value="completion">Sort by Completion</option>
            <option value="activity">Sort by Activity</option>
          </select>

          {/* Filter Options */}
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value as any)}
            className="text-sm border-gray-300 rounded-md focus:ring-indigo-500 focus:border-indigo-500"
          >
            <option value="all">All Participants</option>
            <option value="active">Active Only</option>
            <option value="inactive">Inactive Only</option>
          </select>
        </div>

        <div className="text-sm text-gray-600">
          {sortedParticipants.length} participant{sortedParticipants.length !== 1 ? 's' : ''}
        </div>
      </div>

      {/* Progress Matrix */}
      {sortedParticipants.length === 0 ? (
        <div className="text-center py-12 bg-gray-50 rounded-lg">
          <p className="text-gray-500">No participants match the selected criteria</p>
        </div>
      ) : viewMode === 'grid' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {sortedParticipants.map(({ participant, stats }) => {
            const activityStatus = getActivityStatus(stats.lastActivity);
            return (
              <div key={participant.id} className="bg-white rounded-lg shadow p-4">
                <div className="flex justify-between items-start mb-3">
                  <div>
                    <h4 className="font-medium text-gray-900">{participant.name}</h4>
                    <p className="text-sm text-gray-500">{participant.email}</p>
                  </div>
                  <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${activityStatus.color}`}>
                    {activityStatus.label}
                  </span>
                </div>

                {/* Progress Bar */}
                <div className="mb-3">
                  <div className="flex justify-between text-xs text-gray-600 mb-1">
                    <span>Progress</span>
                    <span>{stats.completionRate}%</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div
                      className={`h-2 rounded-full ${getProgressColor(stats.completionRate)}`}
                      style={{ width: `${stats.completionRate}%` }}
                    />
                  </div>
                </div>

                {/* Stats Grid */}
                <div className="grid grid-cols-3 gap-2 text-center">
                  <div className="bg-gray-50 rounded p-2">
                    <div className="text-lg font-semibold text-gray-900">{stats.total}</div>
                    <div className="text-xs text-gray-500">Total</div>
                  </div>
                  <div className="bg-green-50 rounded p-2">
                    <div className="text-lg font-semibold text-green-900">{stats.completed}</div>
                    <div className="text-xs text-gray-500">Done</div>
                  </div>
                  <div className="bg-blue-50 rounded p-2">
                    <div className="text-lg font-semibold text-blue-900">{stats.inProgress}</div>
                    <div className="text-xs text-gray-500">Active</div>
                  </div>
                </div>

                <div className="mt-3 pt-3 border-t text-xs text-gray-500">
                  <div className="flex justify-between">
                    <span>Reports: {stats.reportsSubmitted}</span>
                    <span>{formatDate(stats.lastActivity)}</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="bg-white shadow rounded-lg overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Participant
                </th>
                <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Progress
                </th>
                <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Milestones
                </th>
                <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Reports
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Last Activity
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {sortedParticipants.map(({ participant, stats }) => {
                const activityStatus = getActivityStatus(stats.lastActivity);
                return (
                  <tr key={participant.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div>
                        <div className="text-sm font-medium text-gray-900">{participant.name}</div>
                        <div className="text-sm text-gray-500">{participant.email}</div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-center">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${activityStatus.color}`}>
                        {activityStatus.label}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <div className="flex-1 mr-2">
                          <div className="w-full bg-gray-200 rounded-full h-2">
                            <div
                              className={`h-2 rounded-full ${getProgressColor(stats.completionRate)}`}
                              style={{ width: `${stats.completionRate}%` }}
                            />
                          </div>
                        </div>
                        <span className="text-sm font-medium text-gray-900">{stats.completionRate}%</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-center">
                      <div className="text-sm">
                        <span className="font-medium text-gray-900">{stats.completed}</span>
                        <span className="text-gray-500">/{stats.total}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-center">
                      <div className="text-sm text-gray-900">{stats.reportsSubmitted}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-500">{formatDate(stats.lastActivity)}</div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default ProgressMatrixView;