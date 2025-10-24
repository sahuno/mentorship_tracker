import React, { useState, useEffect, useRef } from 'react';
import { User, Milestone, MilestoneStatus, BalanceSheetCycle, Expense } from '../types';
import CloseIcon from './icons/CloseIcon';
import ProgramManager from '../utils/programManager';
import PermissionManager from '../utils/permissions';
import NotificationManager from '../utils/notificationManager';

interface ParticipantDetailsModalProps {
  participantId: string;
  programId: string;
  managerId: string;
  onClose: () => void;
}

const ParticipantDetailsModal: React.FC<ParticipantDetailsModalProps> = ({
  participantId,
  programId,
  managerId,
  onClose
}) => {
  const [participant, setParticipant] = useState<User | null>(null);
  const [milestones, setMilestones] = useState<Milestone[]>([]);
  const [cycles, setCycles] = useState<BalanceSheetCycle[]>([]);
  const [activeTab, setActiveTab] = useState<'overview' | 'milestones' | 'progress' | 'finance'>('overview');
  const [feedback, setFeedback] = useState('');
  const [selectedReportId, setSelectedReportId] = useState<string | null>(null);

  const modalRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Load participant data
    const participantData = localStorage.getItem(`gbw_users_v2`);
    if (participantData) {
      const users = JSON.parse(participantData);
      const user = users.find((u: any) => u.id === participantId);
      if (user) {
        const { passwordHash, ...userWithoutPassword } = user;
        setParticipant(userWithoutPassword);
      }
    }

    // Load milestones
    const milestoneKey = `gbw_milestones_${participantId}`;
    const milestonesData = localStorage.getItem(milestoneKey);
    if (milestonesData) {
      const allMilestones = JSON.parse(milestonesData);
      const programMilestones = allMilestones.filter((m: Milestone) => m.programId === programId);
      setMilestones(programMilestones);
    }

    // Load financial data
    const cyclesKey = `gbw_cycles_${participantId}`;
    const cyclesData = localStorage.getItem(cyclesKey);
    if (cyclesData) {
      setCycles(JSON.parse(cyclesData));
    }
  }, [participantId, programId]);

  // Accessibility: Escape key
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [onClose]);

  const handleProvideFeedback = (milestoneId: string, reportId: string) => {
    if (!feedback.trim()) {
      alert('Please enter feedback');
      return;
    }

    // Update milestone with feedback
    const updatedMilestones = milestones.map(m => {
      if (m.id === milestoneId) {
        const updatedReports = m.progressReports.map(r => {
          if (r.id === reportId) {
            const managerFeedback = r.managerFeedback || [];
            managerFeedback.push({
              managerId,
              feedback: feedback.trim(),
              feedbackDate: new Date().toISOString()
            });
            return { ...r, managerFeedback };
          }
          return r;
        });
        return { ...m, progressReports: updatedReports };
      }
      return m;
    });

    // Save updated milestones
    const milestoneKey = `gbw_milestones_${participantId}`;
    const allMilestones = localStorage.getItem(milestoneKey);
    if (allMilestones) {
      const parsedMilestones = JSON.parse(allMilestones);
      const otherMilestones = parsedMilestones.filter((m: Milestone) => m.programId !== programId);
      const combinedMilestones = [...otherMilestones, ...updatedMilestones];
      localStorage.setItem(milestoneKey, JSON.stringify(combinedMilestones));
    }

    // Notify participant
    const milestone = milestones.find(m => m.id === milestoneId);
    if (participant && milestone) {
      NotificationManager.notifyFeedback(
        participantId,
        'Manager',
        milestone.title,
        feedback.trim(),
        milestoneId,
        reportId
      );
    }

    // Log the action
    PermissionManager.logAuditAction(
      managerId,
      'PROVIDE_FEEDBACK',
      participantId,
      {
        milestoneId,
        reportId,
        feedback: feedback.trim()
      }
    );

    setMilestones(updatedMilestones);
    setFeedback('');
    setSelectedReportId(null);
    alert('Feedback provided successfully');
  };

  // Calculate statistics
  const stats = {
    totalMilestones: milestones.length,
    completedMilestones: milestones.filter(m => m.status === MilestoneStatus.COMPLETED).length,
    inProgressMilestones: milestones.filter(m => m.status === MilestoneStatus.IN_PROGRESS).length,
    assignedMilestones: milestones.filter(m => m.assignmentInfo).length,
    totalProgressReports: milestones.reduce((sum, m) => sum + m.progressReports.length, 0),
    completionRate: milestones.length > 0
      ? Math.round((milestones.filter(m => m.status === MilestoneStatus.COMPLETED).length / milestones.length) * 100)
      : 0,
    totalSpent: cycles.reduce((sum, cycle) =>
      sum + cycle.expenses.reduce((expSum, exp) => expSum + exp.amount, 0), 0
    ),
    activeCycle: cycles.find(c => c.isActive)
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  const getStatusColor = (status: MilestoneStatus) => {
    switch (status) {
      case MilestoneStatus.COMPLETED:
        return 'bg-green-100 text-green-800';
      case MilestoneStatus.IN_PROGRESS:
        return 'bg-blue-100 text-blue-800';
      case MilestoneStatus.PAUSED:
        return 'bg-yellow-100 text-yellow-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  if (!participant) {
    return null;
  }

  return (
    <div
      className="fixed inset-0 bg-black bg-opacity-50 z-50 flex justify-center items-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-title"
    >
      <div ref={modalRef} className="bg-white rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        <div className="p-6 border-b flex justify-between items-center">
          <div>
            <h3 id="modal-title" className="text-2xl font-bold text-gray-900">
              Participant Details
            </h3>
            <p className="mt-1 text-sm text-gray-600">
              {participant.name} • {participant.email}
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors duration-200"
            aria-label="Close modal"
          >
            <CloseIcon className="h-6 w-6" />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="border-b bg-gray-50">
          <nav className="flex space-x-8 px-6" aria-label="Tabs">
            {['overview', 'milestones', 'progress', 'finance'].map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab as any)}
                className={`py-3 px-1 border-b-2 font-medium text-sm capitalize ${
                  activeTab === tab
                    ? 'border-indigo-500 text-indigo-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                {tab}
              </button>
            ))}
          </nav>
        </div>

        {/* Tab Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {activeTab === 'overview' && (
            <div className="space-y-6">
              {/* Statistics Grid */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-gray-50 rounded-lg p-4">
                  <dt className="text-sm font-medium text-gray-500">Total Milestones</dt>
                  <dd className="mt-1 text-2xl font-semibold text-gray-900">{stats.totalMilestones}</dd>
                </div>
                <div className="bg-green-50 rounded-lg p-4">
                  <dt className="text-sm font-medium text-gray-500">Completed</dt>
                  <dd className="mt-1 text-2xl font-semibold text-green-900">{stats.completedMilestones}</dd>
                </div>
                <div className="bg-blue-50 rounded-lg p-4">
                  <dt className="text-sm font-medium text-gray-500">In Progress</dt>
                  <dd className="mt-1 text-2xl font-semibold text-blue-900">{stats.inProgressMilestones}</dd>
                </div>
                <div className="bg-purple-50 rounded-lg p-4">
                  <dt className="text-sm font-medium text-gray-500">Completion Rate</dt>
                  <dd className="mt-1 text-2xl font-semibold text-purple-900">{stats.completionRate}%</dd>
                </div>
              </div>

              {/* Progress Overview */}
              <div className="bg-white border rounded-lg p-4">
                <h4 className="font-medium text-gray-900 mb-3">Progress Overview</h4>
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span>Total Progress Reports</span>
                    <span className="font-medium">{stats.totalProgressReports}</span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span>Assigned Milestones</span>
                    <span className="font-medium">{stats.assignedMilestones}</span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span>Self-Created Milestones</span>
                    <span className="font-medium">{stats.totalMilestones - stats.assignedMilestones}</span>
                  </div>
                </div>
              </div>

              {/* Recent Activity */}
              <div className="bg-white border rounded-lg p-4">
                <h4 className="font-medium text-gray-900 mb-3">Recent Progress Reports</h4>
                <div className="space-y-2">
                  {milestones
                    .flatMap(m => m.progressReports.map(r => ({ ...r, milestoneTitle: m.title, milestoneId: m.id })))
                    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
                    .slice(0, 5)
                    .map((report: any) => (
                      <div key={report.id} className="text-sm">
                        <div className="flex justify-between">
                          <span className="font-medium">{report.milestoneTitle}</span>
                          <span className="text-gray-500">Week {report.weekNumber}</span>
                        </div>
                        <p className="text-gray-600 truncate">{report.content}</p>
                        <p className="text-xs text-gray-400">{formatDate(report.date)}</p>
                      </div>
                    ))}
                </div>
              </div>
            </div>
          )}

          {activeTab === 'milestones' && (
            <div className="space-y-4">
              <h4 className="font-medium text-gray-900">Milestones ({milestones.length})</h4>
              {milestones.length === 0 ? (
                <p className="text-gray-500">No milestones for this program yet.</p>
              ) : (
                <div className="space-y-3">
                  {milestones.map(milestone => (
                    <div key={milestone.id} className="border rounded-lg p-4">
                      <div className="flex justify-between items-start">
                        <div className="flex-1">
                          <h5 className="font-medium text-gray-900">{milestone.title}</h5>
                          {milestone.description && (
                            <p className="text-sm text-gray-600 mt-1">{milestone.description}</p>
                          )}
                          <div className="mt-2 flex items-center space-x-4 text-xs text-gray-500">
                            <span>{formatDate(milestone.startDate)} - {formatDate(milestone.endDate)}</span>
                            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(milestone.status)}`}>
                              {milestone.status.replace('_', ' ')}
                            </span>
                            {milestone.assignmentInfo && (
                              <span className="text-indigo-600">
                                {milestone.assignmentInfo.assignmentType.replace('_', ' ')}
                              </span>
                            )}
                          </div>
                          <div className="mt-2 text-sm text-gray-600">
                            Progress Reports: {milestone.progressReports.length}
                            {milestone.progressReports.length > 0 && (
                              <span className="ml-2">
                                • Last: Week {milestone.progressReports[milestone.progressReports.length - 1].weekNumber}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {activeTab === 'progress' && (
            <div className="space-y-4">
              <h4 className="font-medium text-gray-900">Progress Reports</h4>
              {milestones.filter(m => m.progressReports.length > 0).length === 0 ? (
                <p className="text-gray-500">No progress reports submitted yet.</p>
              ) : (
                <div className="space-y-4">
                  {milestones
                    .filter(m => m.progressReports.length > 0)
                    .map(milestone => (
                      <div key={milestone.id} className="border rounded-lg p-4">
                        <h5 className="font-medium text-gray-900 mb-3">{milestone.title}</h5>
                        <div className="space-y-3">
                          {milestone.progressReports.map(report => (
                            <div key={report.id} className="bg-gray-50 rounded-md p-3">
                              <div className="flex justify-between items-start">
                                <div className="flex-1">
                                  <div className="flex items-center space-x-2 text-sm text-gray-600 mb-1">
                                    <span>Week {report.weekNumber}</span>
                                    <span>•</span>
                                    <span>{formatDate(report.date)}</span>
                                    {report.completionPercentage !== undefined && (
                                      <>
                                        <span>•</span>
                                        <span>{report.completionPercentage}% complete</span>
                                      </>
                                    )}
                                  </div>
                                  <p className="text-sm text-gray-800">{report.content}</p>

                                  {/* Show existing feedback */}
                                  {report.managerFeedback && report.managerFeedback.length > 0 && (
                                    <div className="mt-2 p-2 bg-blue-50 rounded text-sm">
                                      <p className="font-medium text-blue-900">Manager Feedback:</p>
                                      {report.managerFeedback.map((fb, idx) => (
                                        <p key={idx} className="text-blue-800 mt-1">
                                          {fb.feedback} - <span className="text-xs">{formatDate(fb.feedbackDate)}</span>
                                        </p>
                                      ))}
                                    </div>
                                  )}

                                  {/* Feedback form */}
                                  {selectedReportId === report.id ? (
                                    <div className="mt-3 space-y-2">
                                      <textarea
                                        value={feedback}
                                        onChange={(e) => setFeedback(e.target.value)}
                                        placeholder="Provide feedback..."
                                        className="w-full px-3 py-2 text-sm border rounded-md focus:ring-indigo-500 focus:border-indigo-500"
                                        rows={3}
                                        autoFocus
                                      />
                                      <div className="flex space-x-2">
                                        <button
                                          onClick={() => handleProvideFeedback(milestone.id, report.id)}
                                          className="px-3 py-1 bg-indigo-600 text-white text-sm rounded hover:bg-indigo-700"
                                        >
                                          Submit Feedback
                                        </button>
                                        <button
                                          onClick={() => {
                                            setSelectedReportId(null);
                                            setFeedback('');
                                          }}
                                          className="px-3 py-1 bg-gray-300 text-gray-700 text-sm rounded hover:bg-gray-400"
                                        >
                                          Cancel
                                        </button>
                                      </div>
                                    </div>
                                  ) : (
                                    <button
                                      onClick={() => setSelectedReportId(report.id)}
                                      className="mt-2 text-sm text-indigo-600 hover:text-indigo-500"
                                    >
                                      Provide Feedback
                                    </button>
                                  )}
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                </div>
              )}
            </div>
          )}

          {activeTab === 'finance' && (
            <div className="space-y-4">
              <h4 className="font-medium text-gray-900">Financial Overview</h4>
              {stats.activeCycle ? (
                <div className="space-y-4">
                  <div className="bg-gray-50 rounded-lg p-4">
                    <div className="grid grid-cols-3 gap-4">
                      <div>
                        <dt className="text-sm font-medium text-gray-500">Budget</dt>
                        <dd className="mt-1 text-xl font-semibold text-gray-900">${stats.activeCycle.budget}</dd>
                      </div>
                      <div>
                        <dt className="text-sm font-medium text-gray-500">Spent</dt>
                        <dd className="mt-1 text-xl font-semibold text-gray-900">
                          ${stats.activeCycle.expenses.reduce((sum, exp) => sum + exp.amount, 0).toFixed(2)}
                        </dd>
                      </div>
                      <div>
                        <dt className="text-sm font-medium text-gray-500">Remaining</dt>
                        <dd className="mt-1 text-xl font-semibold text-gray-900">
                          ${(stats.activeCycle.budget - stats.activeCycle.expenses.reduce((sum, exp) => sum + exp.amount, 0)).toFixed(2)}
                        </dd>
                      </div>
                    </div>
                  </div>

                  <div>
                    <h5 className="font-medium text-gray-900 mb-2">Recent Expenses</h5>
                    <div className="space-y-2">
                      {stats.activeCycle.expenses.slice(-10).reverse().map((expense: Expense) => (
                        <div key={expense.id} className="flex justify-between text-sm">
                          <div>
                            <span className="font-medium">{expense.item}</span>
                            <span className="text-gray-500 ml-2">{formatDate(expense.date)}</span>
                          </div>
                          <span className="font-medium">${expense.amount.toFixed(2)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              ) : (
                <p className="text-gray-500">No active financial cycle.</p>
              )}

              <div className="bg-yellow-50 border border-yellow-200 rounded-md p-3 text-sm text-yellow-800">
                Note: Financial data can be edited from the Financial Oversight tab with proper audit logging.
              </div>
            </div>
          )}
        </div>

        <div className="p-6 bg-gray-50 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 transition-colors duration-200"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

export default ParticipantDetailsModal;