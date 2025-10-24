import React, { useState, useEffect, useMemo } from 'react';
import { User, Program, Milestone, MilestoneStatus, BalanceSheetCycle, UserRole } from '../types';
import ProgramManager from '../utils/programManager';
import PermissionManager from '../utils/permissions';
import ExportManager from '../utils/exportManager';

interface ReportsAnalyticsProps {
  programId: string;
  managerId: string;
  user: User;
}

interface ProgramReport {
  programInfo: Program;
  participants: number;
  milestones: {
    total: number;
    completed: number;
    inProgress: number;
    notStarted: number;
    assigned: number;
    selfCreated: number;
  };
  progress: {
    overallCompletion: number;
    averageCompletion: number;
    topPerformers: { participant: User; completionRate: number }[];
    needsAttention: { participant: User; lastActivity: string | null }[];
  };
  financial: {
    totalBudget: number;
    totalSpent: number;
    averageUtilization: number;
    overBudget: number;
  };
  engagement: {
    totalReports: number;
    averageReportsPerParticipant: number;
    activeParticipants: number;
    inactiveParticipants: number;
  };
  timeline: {
    programProgress: number;
    daysRemaining: number;
    daysElapsed: number;
  };
}

const ReportsAnalytics: React.FC<ReportsAnalyticsProps> = ({ programId, managerId, user }) => {
  const [reportData, setReportData] = useState<ProgramReport | null>(null);
  const [selectedMetric, setSelectedMetric] = useState<'overview' | 'milestones' | 'financial' | 'engagement'>('overview');
  const [dateRange, setDateRange] = useState<'all' | 'month' | 'week'>('all');
  const [isGenerating, setIsGenerating] = useState(false);

  // Generate comprehensive report
  useEffect(() => {
    generateReport();
  }, [programId, dateRange]);

  const generateReport = () => {
    setIsGenerating(true);

    const program = ProgramManager.getProgramById(programId);
    if (!program) {
      setIsGenerating(false);
      return;
    }

    const participants = ProgramManager.getParticipantsInProgram(programId);

    // Collect all milestone data
    let allMilestones: Milestone[] = [];
    let allProgressReports = 0;
    let financialData: { budget: number; spent: number }[] = [];

    const participantMetrics = participants.map(participant => {
      const milestoneKey = `gbw_milestones_${participant.id}`;
      const milestonesData = localStorage.getItem(milestoneKey);
      const milestones = milestonesData ? JSON.parse(milestonesData).filter((m: Milestone) => m.programId === programId) : [];

      allMilestones = [...allMilestones, ...milestones];

      const reportsCount = milestones.reduce((sum: number, m: Milestone) => sum + m.progressReports.length, 0);
      allProgressReports += reportsCount;

      // Get financial data
      const cyclesKey = `gbw_cycles_${participant.id}`;
      const cyclesData = localStorage.getItem(cyclesKey);
      const cycles = cyclesData ? JSON.parse(cyclesData) : [];
      const activeCycle = cycles.find((c: BalanceSheetCycle) => c.isActive);

      if (activeCycle) {
        const spent = activeCycle.expenses.reduce((sum: number, e: any) => sum + e.amount, 0);
        financialData.push({ budget: activeCycle.budget, spent });
      }

      const completedMilestones = milestones.filter((m: Milestone) => m.status === MilestoneStatus.COMPLETED);
      const completionRate = milestones.length > 0 ? (completedMilestones.length / milestones.length) * 100 : 0;

      // Get last activity
      const allReports = milestones.flatMap((m: Milestone) => m.progressReports);
      const lastReport = allReports.sort((a, b) =>
        new Date(b.date).getTime() - new Date(a.date).getTime()
      )[0];

      return {
        participant,
        milestones,
        completionRate,
        reportsCount,
        lastActivity: lastReport ? lastReport.date : null
      };
    });

    // Calculate top performers
    const topPerformers = participantMetrics
      .filter(pm => pm.milestones.length > 0)
      .sort((a, b) => b.completionRate - a.completionRate)
      .slice(0, 5)
      .map(pm => ({ participant: pm.participant, completionRate: pm.completionRate }));

    // Identify participants needing attention (no activity in 7+ days)
    const needsAttention = participantMetrics
      .filter(pm => {
        if (!pm.lastActivity) return true;
        const daysSinceActivity = Math.floor((Date.now() - new Date(pm.lastActivity).getTime()) / (1000 * 60 * 60 * 24));
        return daysSinceActivity > 7;
      })
      .map(pm => ({ participant: pm.participant, lastActivity: pm.lastActivity }));

    // Calculate financial metrics
    const totalBudget = financialData.reduce((sum, fd) => sum + fd.budget, 0);
    const totalSpent = financialData.reduce((sum, fd) => sum + fd.spent, 0);
    const averageUtilization = totalBudget > 0 ? (totalSpent / totalBudget) * 100 : 0;
    const overBudget = financialData.filter(fd => fd.spent > fd.budget).length;

    // Calculate timeline metrics
    const now = new Date();
    const start = new Date(program.startDate);
    const end = new Date(program.endDate);
    const totalDays = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
    const daysElapsed = Math.ceil((now.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
    const daysRemaining = Math.max(0, Math.ceil((end.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)));
    const programProgress = totalDays > 0 ? Math.min(100, (daysElapsed / totalDays) * 100) : 0;

    // Active participants (activity within 7 days)
    const activeParticipants = participantMetrics.filter(pm => {
      if (!pm.lastActivity) return false;
      const daysSinceActivity = Math.floor((Date.now() - new Date(pm.lastActivity).getTime()) / (1000 * 60 * 60 * 24));
      return daysSinceActivity <= 7;
    }).length;

    const report: ProgramReport = {
      programInfo: program,
      participants: participants.length,
      milestones: {
        total: allMilestones.length,
        completed: allMilestones.filter(m => m.status === MilestoneStatus.COMPLETED).length,
        inProgress: allMilestones.filter(m => m.status === MilestoneStatus.IN_PROGRESS).length,
        notStarted: allMilestones.filter(m => m.status === MilestoneStatus.NOT_STARTED).length,
        assigned: allMilestones.filter(m => m.assignmentInfo).length,
        selfCreated: allMilestones.filter(m => !m.assignmentInfo).length
      },
      progress: {
        overallCompletion: allMilestones.length > 0
          ? Math.round((allMilestones.filter(m => m.status === MilestoneStatus.COMPLETED).length / allMilestones.length) * 100)
          : 0,
        averageCompletion: participantMetrics.length > 0
          ? Math.round(participantMetrics.reduce((sum, pm) => sum + pm.completionRate, 0) / participantMetrics.length)
          : 0,
        topPerformers,
        needsAttention
      },
      financial: {
        totalBudget,
        totalSpent,
        averageUtilization: Math.round(averageUtilization),
        overBudget
      },
      engagement: {
        totalReports: allProgressReports,
        averageReportsPerParticipant: participants.length > 0
          ? Math.round(allProgressReports / participants.length)
          : 0,
        activeParticipants,
        inactiveParticipants: participants.length - activeParticipants
      },
      timeline: {
        programProgress: Math.round(programProgress),
        daysRemaining,
        daysElapsed
      }
    };

    setReportData(report);
    setIsGenerating(false);

    // Log report generation
    PermissionManager.logAuditAction(
      managerId,
      'GENERATE_REPORT',
      programId,
      {
        reportType: 'comprehensive',
        dateRange,
        timestamp: new Date().toISOString()
      }
    );
  };

  const handleExportReport = (format: 'csv' | 'json' | 'print') => {
    if (!reportData) return;

    if (format === 'csv') {
      ExportManager.exportProgramReportCSV(reportData);
    } else if (format === 'json') {
      ExportManager.exportProgramReportJSON(reportData);
    } else if (format === 'print') {
      ExportManager.generatePrintableReport(reportData);
    }

    // Log export action
    PermissionManager.logAuditAction(
      managerId,
      'EXPORT_REPORT',
      programId,
      {
        format,
        timestamp: new Date().toISOString()
      }
    );
  };

  const formatCurrency = (amount: number) => `$${amount.toFixed(2)}`;

  const getProgressColor = (percentage: number) => {
    if (percentage >= 80) return 'text-green-600';
    if (percentage >= 60) return 'text-blue-600';
    if (percentage >= 40) return 'text-yellow-600';
    return 'text-red-600';
  };

  const getStatusBadgeColor = (status: string) => {
    switch (status) {
      case 'active': return 'bg-green-100 text-green-800';
      case 'completed': return 'bg-gray-100 text-gray-800';
      case 'upcoming': return 'bg-yellow-100 text-yellow-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  if (!reportData) {
    return (
      <div className="flex justify-center items-center py-12">
        <div className="text-gray-500">
          {isGenerating ? 'Generating report...' : 'No report data available'}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header with Export Options */}
      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex justify-between items-start">
          <div>
            <h3 className="text-xl font-bold text-gray-900">{reportData.programInfo.name} - Analytics Report</h3>
            <p className="text-sm text-gray-600 mt-1">
              Generated on {new Date().toLocaleDateString('en-US', {
                year: 'numeric',
                month: 'long',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
              })}
            </p>
          </div>
          <div className="flex space-x-2">
            <button
              onClick={() => handleExportReport('csv')}
              className="px-4 py-2 bg-green-600 text-white text-sm rounded-md hover:bg-green-700"
            >
              Export CSV
            </button>
            <button
              onClick={() => handleExportReport('json')}
              className="px-4 py-2 bg-blue-600 text-white text-sm rounded-md hover:bg-blue-700"
            >
              Export JSON
            </button>
            <button
              onClick={() => handleExportReport('print')}
              className="px-4 py-2 bg-gray-600 text-white text-sm rounded-md hover:bg-gray-700"
            >
              Print Report
            </button>
          </div>
        </div>

        {/* Program Status Badge */}
        <div className="mt-4">
          <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${getStatusBadgeColor(reportData.programInfo.status)}`}>
            {reportData.programInfo.status.toUpperCase()}
          </span>
        </div>
      </div>

      {/* Key Metrics Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Participants */}
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center">
            <div className="flex-shrink-0 bg-indigo-500 rounded-md p-3">
              <svg className="h-6 w-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
            </div>
            <div className="ml-5">
              <dl>
                <dt className="text-sm font-medium text-gray-500">Total Participants</dt>
                <dd className="mt-1 text-3xl font-semibold text-gray-900">{reportData.participants}</dd>
                <dd className="text-xs text-gray-500 mt-1">
                  {reportData.engagement.activeParticipants} active
                </dd>
              </dl>
            </div>
          </div>
        </div>

        {/* Overall Progress */}
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center">
            <div className="flex-shrink-0 bg-green-500 rounded-md p-3">
              <svg className="h-6 w-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div className="ml-5">
              <dl>
                <dt className="text-sm font-medium text-gray-500">Overall Completion</dt>
                <dd className={`mt-1 text-3xl font-semibold ${getProgressColor(reportData.progress.overallCompletion)}`}>
                  {reportData.progress.overallCompletion}%
                </dd>
                <dd className="text-xs text-gray-500 mt-1">
                  {reportData.milestones.completed}/{reportData.milestones.total} milestones
                </dd>
              </dl>
            </div>
          </div>
        </div>

        {/* Financial Utilization */}
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center">
            <div className="flex-shrink-0 bg-yellow-500 rounded-md p-3">
              <svg className="h-6 w-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div className="ml-5">
              <dl>
                <dt className="text-sm font-medium text-gray-500">Budget Utilization</dt>
                <dd className={`mt-1 text-3xl font-semibold ${getProgressColor(reportData.financial.averageUtilization)}`}>
                  {reportData.financial.averageUtilization}%
                </dd>
                <dd className="text-xs text-gray-500 mt-1">
                  {formatCurrency(reportData.financial.totalSpent)} of {formatCurrency(reportData.financial.totalBudget)}
                </dd>
              </dl>
            </div>
          </div>
        </div>

        {/* Program Timeline */}
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center">
            <div className="flex-shrink-0 bg-purple-500 rounded-md p-3">
              <svg className="h-6 w-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div className="ml-5">
              <dl>
                <dt className="text-sm font-medium text-gray-500">Days Remaining</dt>
                <dd className="mt-1 text-3xl font-semibold text-gray-900">{reportData.timeline.daysRemaining}</dd>
                <dd className="text-xs text-gray-500 mt-1">
                  {reportData.timeline.programProgress}% complete
                </dd>
              </dl>
            </div>
          </div>
        </div>
      </div>

      {/* Detailed Sections */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Milestone Breakdown */}
        <div className="bg-white rounded-lg shadow p-6">
          <h4 className="text-lg font-medium text-gray-900 mb-4">Milestone Breakdown</h4>
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-600">Completed</span>
              <div className="flex items-center">
                <div className="w-32 bg-gray-200 rounded-full h-2 mr-2">
                  <div
                    className="bg-green-500 h-2 rounded-full"
                    style={{ width: `${reportData.milestones.total > 0 ? (reportData.milestones.completed / reportData.milestones.total) * 100 : 0}%` }}
                  />
                </div>
                <span className="text-sm font-medium text-gray-900">{reportData.milestones.completed}</span>
              </div>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-600">In Progress</span>
              <div className="flex items-center">
                <div className="w-32 bg-gray-200 rounded-full h-2 mr-2">
                  <div
                    className="bg-blue-500 h-2 rounded-full"
                    style={{ width: `${reportData.milestones.total > 0 ? (reportData.milestones.inProgress / reportData.milestones.total) * 100 : 0}%` }}
                  />
                </div>
                <span className="text-sm font-medium text-gray-900">{reportData.milestones.inProgress}</span>
              </div>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-600">Not Started</span>
              <div className="flex items-center">
                <div className="w-32 bg-gray-200 rounded-full h-2 mr-2">
                  <div
                    className="bg-gray-400 h-2 rounded-full"
                    style={{ width: `${reportData.milestones.total > 0 ? (reportData.milestones.notStarted / reportData.milestones.total) * 100 : 0}%` }}
                  />
                </div>
                <span className="text-sm font-medium text-gray-900">{reportData.milestones.notStarted}</span>
              </div>
            </div>
            <div className="pt-3 border-t">
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Manager Assigned</span>
                <span className="font-medium text-gray-900">{reportData.milestones.assigned}</span>
              </div>
              <div className="flex justify-between text-sm mt-2">
                <span className="text-gray-600">Self-Created</span>
                <span className="font-medium text-gray-900">{reportData.milestones.selfCreated}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Engagement Metrics */}
        <div className="bg-white rounded-lg shadow p-6">
          <h4 className="text-lg font-medium text-gray-900 mb-4">Engagement Metrics</h4>
          <div className="space-y-3">
            <div className="flex justify-between">
              <span className="text-sm text-gray-600">Total Progress Reports</span>
              <span className="text-sm font-medium text-gray-900">{reportData.engagement.totalReports}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-gray-600">Avg Reports per Participant</span>
              <span className="text-sm font-medium text-gray-900">{reportData.engagement.averageReportsPerParticipant}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-gray-600">Active Participants</span>
              <span className="text-sm font-medium text-green-600">{reportData.engagement.activeParticipants}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-gray-600">Inactive Participants</span>
              <span className="text-sm font-medium text-red-600">{reportData.engagement.inactiveParticipants}</span>
            </div>
            <div className="pt-3 border-t">
              <p className="text-xs text-gray-500">
                Active = Activity within last 7 days
              </p>
            </div>
          </div>
        </div>

        {/* Top Performers */}
        <div className="bg-white rounded-lg shadow p-6">
          <h4 className="text-lg font-medium text-gray-900 mb-4">Top Performers</h4>
          {reportData.progress.topPerformers.length > 0 ? (
            <div className="space-y-2">
              {reportData.progress.topPerformers.map((performer, index) => (
                <div key={performer.participant.id} className="flex items-center justify-between">
                  <div className="flex items-center">
                    <span className="text-lg font-bold text-gray-400 w-6">{index + 1}</span>
                    <div className="ml-3">
                      <p className="text-sm font-medium text-gray-900">{performer.participant.name}</p>
                      <p className="text-xs text-gray-500">{performer.participant.email}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className={`text-sm font-semibold ${getProgressColor(performer.completionRate)}`}>
                      {Math.round(performer.completionRate)}%
                    </p>
                    <p className="text-xs text-gray-500">completion</p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-gray-500">No data available</p>
          )}
        </div>

        {/* Needs Attention */}
        <div className="bg-white rounded-lg shadow p-6">
          <h4 className="text-lg font-medium text-gray-900 mb-4">Needs Attention</h4>
          {reportData.progress.needsAttention.length > 0 ? (
            <div className="space-y-2">
              {reportData.progress.needsAttention.slice(0, 5).map(item => (
                <div key={item.participant.id} className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-900">{item.participant.name}</p>
                    <p className="text-xs text-gray-500">{item.participant.email}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-red-600">
                      {item.lastActivity
                        ? `${Math.floor((Date.now() - new Date(item.lastActivity).getTime()) / (1000 * 60 * 60 * 24))} days ago`
                        : 'No activity'
                      }
                    </p>
                  </div>
                </div>
              ))}
              {reportData.progress.needsAttention.length > 5 && (
                <p className="text-xs text-gray-500 text-center pt-2">
                  +{reportData.progress.needsAttention.length - 5} more
                </p>
              )}
            </div>
          ) : (
            <p className="text-sm text-gray-500">All participants are active!</p>
          )}
        </div>
      </div>

      {/* Financial Summary */}
      <div className="bg-white rounded-lg shadow p-6">
        <h4 className="text-lg font-medium text-gray-900 mb-4">Financial Summary</h4>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="text-center">
            <p className="text-2xl font-bold text-gray-900">{formatCurrency(reportData.financial.totalBudget)}</p>
            <p className="text-sm text-gray-500">Total Budget</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-bold text-gray-900">{formatCurrency(reportData.financial.totalSpent)}</p>
            <p className="text-sm text-gray-500">Total Spent</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-bold text-gray-900">
              {formatCurrency(reportData.financial.totalBudget - reportData.financial.totalSpent)}
            </p>
            <p className="text-sm text-gray-500">Remaining</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-bold text-red-600">{reportData.financial.overBudget}</p>
            <p className="text-sm text-gray-500">Over Budget</p>
          </div>
        </div>
      </div>

      {/* Report Footer */}
      <div className="bg-gray-50 rounded-lg p-4 text-center">
        <p className="text-xs text-gray-500">
          This report was generated by {user.name} on {new Date().toLocaleDateString()}.
          All data is current as of the generation time and may not reflect recent changes.
        </p>
      </div>
    </div>
  );
};

export default ReportsAnalytics;