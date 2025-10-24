import React, { useState, useEffect } from 'react';
import { User, Milestone, AssignmentType, MilestoneStatus } from '../../types';
import NotificationManager, { Notification } from '../../utils/notificationManager';
import UserManager from '../../utils/userManager';
import ProgramManager from '../../utils/programManager';
import NotificationBadge from '../NotificationBadge';

interface AssignmentsTabProps {
  user: User;
  milestones: Milestone[];
  onMilestonesUpdate: (milestones: Milestone[]) => void;
}

const AssignmentsTab: React.FC<AssignmentsTabProps> = ({ user, milestones, onMilestonesUpdate }) => {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [showNotifications, setShowNotifications] = useState(false);
  const [declineReason, setDeclineReason] = useState('');
  const [decliningMilestoneId, setDecliningMilestoneId] = useState<string | null>(null);

  // Load notifications
  useEffect(() => {
    const loadNotifications = () => {
      const userNotifications = NotificationManager.getNotifications(user.id);
      setNotifications(userNotifications);
    };

    loadNotifications();
    // Refresh every 30 seconds
    const interval = setInterval(loadNotifications, 30000);
    return () => clearInterval(interval);
  }, [user.id]);

  // Filter assigned milestones
  const assignedMilestones = milestones.filter(m =>
    m.assignmentInfo &&
    m.assignmentInfo.assignmentType !== AssignmentType.SELF_CREATED
  );

  const pendingAssignments = assignedMilestones.filter(m =>
    m.assignmentInfo?.canDecline &&
    !m.assignmentInfo.declinedAt &&
    !m.assignmentInfo.managerResponse &&
    m.status === MilestoneStatus.NOT_STARTED
  );

  const acceptedAssignments = assignedMilestones.filter(m =>
    (!m.assignmentInfo?.canDecline || m.assignmentInfo?.managerResponse?.accepted) &&
    !m.assignmentInfo?.declinedAt
  );

  const declinedAssignments = assignedMilestones.filter(m =>
    m.assignmentInfo?.declinedAt ||
    m.assignmentInfo?.managerResponse?.accepted === false
  );

  const handleAcceptAssignment = (milestoneId: string) => {
    const updatedMilestones = milestones.map(m => {
      if (m.id === milestoneId && m.assignmentInfo) {
        return {
          ...m,
          assignmentInfo: {
            ...m.assignmentInfo,
            managerResponse: {
              accepted: true,
              comment: 'Assignment accepted by participant',
              respondedAt: new Date().toISOString()
            }
          },
          status: MilestoneStatus.IN_PROGRESS
        };
      }
      return m;
    });

    onMilestonesUpdate(updatedMilestones);
  };

  const handleDeclineAssignment = (milestoneId: string) => {
    if (!declineReason.trim()) {
      alert('Please provide a reason for declining');
      return;
    }

    const milestone = milestones.find(m => m.id === milestoneId);
    if (!milestone || !milestone.assignmentInfo) return;

    // Update the milestone
    const updatedMilestones = milestones.map(m => {
      if (m.id === milestoneId && m.assignmentInfo) {
        return {
          ...m,
          assignmentInfo: {
            ...m.assignmentInfo,
            declineReason: declineReason.trim(),
            declinedAt: new Date().toISOString()
          }
        };
      }
      return m;
    });

    onMilestonesUpdate(updatedMilestones);

    // Notify the manager
    if (milestone.programId) {
      const program = ProgramManager.getProgramById(milestone.programId);
      if (program) {
        program.managerIds.forEach(managerId => {
          const manager = UserManager.getUserById(managerId);
          if (manager) {
            NotificationManager.notifyDecline(
              managerId,
              user.name,
              milestone.title,
              declineReason.trim(),
              milestoneId,
              user.id
            );
          }
        });
      }
    }

    setDeclineReason('');
    setDecliningMilestoneId(null);
  };

  const markNotificationAsRead = (notificationId: string) => {
    NotificationManager.markAsRead(user.id, notificationId);
    setNotifications(NotificationManager.getNotifications(user.id));
  };

  const markAllAsRead = () => {
    NotificationManager.markAllAsRead(user.id);
    setNotifications(NotificationManager.getNotifications(user.id));
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

  return (
    <div className="space-y-6">
      {/* Header with Notifications */}
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-gray-900">My Assignments</h2>
        <div className="flex items-center space-x-4">
          <button
            onClick={() => setShowNotifications(!showNotifications)}
            className="relative p-2 text-gray-600 hover:text-gray-900 transition-colors"
          >
            <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
            </svg>
            <div className="absolute -top-1 -right-1">
              <NotificationBadge userId={user.id} />
            </div>
          </button>
        </div>
      </div>

      {/* Notifications Panel */}
      {showNotifications && (
        <div className="bg-white rounded-lg shadow-lg p-6">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-medium text-gray-900">Notifications</h3>
            {notifications.some(n => !n.read) && (
              <button
                onClick={markAllAsRead}
                className="text-sm text-indigo-600 hover:text-indigo-500"
              >
                Mark all as read
              </button>
            )}
          </div>

          {notifications.length === 0 ? (
            <p className="text-gray-500 text-sm">No notifications</p>
          ) : (
            <div className="space-y-3 max-h-96 overflow-y-auto">
              {notifications.slice(0, 10).map(notification => (
                <div
                  key={notification.id}
                  className={`p-3 rounded-md border ${
                    notification.read ? 'bg-gray-50 border-gray-200' : 'bg-blue-50 border-blue-200'
                  }`}
                >
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <p className={`text-sm font-medium ${
                        notification.read ? 'text-gray-900' : 'text-blue-900'
                      }`}>
                        {notification.title}
                      </p>
                      <p className={`text-sm mt-1 ${
                        notification.read ? 'text-gray-600' : 'text-blue-700'
                      }`}>
                        {notification.message}
                      </p>
                      <p className="text-xs text-gray-500 mt-1">
                        {formatDate(notification.createdAt)}
                      </p>
                    </div>
                    {!notification.read && (
                      <button
                        onClick={() => markNotificationAsRead(notification.id)}
                        className="ml-2 text-xs text-indigo-600 hover:text-indigo-500"
                      >
                        Mark read
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Pending Assignments */}
      {pendingAssignments.length > 0 && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6">
          <h3 className="text-lg font-medium text-gray-900 mb-4">
            Pending Assignments ({pendingAssignments.length})
          </h3>
          <div className="space-y-4">
            {pendingAssignments.map(milestone => (
              <div key={milestone.id} className="bg-white rounded-md p-4 shadow-sm">
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <h4 className="text-sm font-medium text-gray-900">{milestone.title}</h4>
                    {milestone.description && (
                      <p className="text-sm text-gray-600 mt-1">{milestone.description}</p>
                    )}
                    <div className="mt-2 text-xs text-gray-500">
                      <span>Assigned by: {
                        milestone.assignmentInfo && UserManager.getUserById(milestone.assignmentInfo.assignedBy)?.name
                      }</span>
                      <span className="mx-2">•</span>
                      <span>Due: {formatDate(milestone.endDate)}</span>
                      {milestone.assignmentInfo?.isRequired && (
                        <>
                          <span className="mx-2">•</span>
                          <span className="text-red-600 font-medium">Required</span>
                        </>
                      )}
                    </div>
                  </div>
                  <div className="ml-4 flex flex-col space-y-2">
                    <button
                      onClick={() => handleAcceptAssignment(milestone.id)}
                      className="px-3 py-1 bg-green-600 text-white text-sm rounded-md hover:bg-green-700"
                    >
                      Accept
                    </button>
                    {milestone.assignmentInfo?.canDecline && (
                      <>
                        {decliningMilestoneId === milestone.id ? (
                          <div className="space-y-2">
                            <input
                              type="text"
                              value={declineReason}
                              onChange={(e) => setDeclineReason(e.target.value)}
                              placeholder="Reason for declining..."
                              className="px-2 py-1 text-sm border rounded"
                              autoFocus
                            />
                            <div className="flex space-x-2">
                              <button
                                onClick={() => handleDeclineAssignment(milestone.id)}
                                className="px-2 py-1 bg-red-600 text-white text-xs rounded hover:bg-red-700"
                              >
                                Confirm
                              </button>
                              <button
                                onClick={() => {
                                  setDecliningMilestoneId(null);
                                  setDeclineReason('');
                                }}
                                className="px-2 py-1 bg-gray-300 text-gray-700 text-xs rounded hover:bg-gray-400"
                              >
                                Cancel
                              </button>
                            </div>
                          </div>
                        ) : (
                          <button
                            onClick={() => setDecliningMilestoneId(milestone.id)}
                            className="px-3 py-1 bg-red-600 text-white text-sm rounded-md hover:bg-red-700"
                          >
                            Decline
                          </button>
                        )}
                      </>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Accepted Assignments */}
      <div className="bg-white rounded-lg shadow">
        <div className="p-6">
          <h3 className="text-lg font-medium text-gray-900 mb-4">
            Active Assignments ({acceptedAssignments.length})
          </h3>

          {acceptedAssignments.length === 0 ? (
            <p className="text-gray-500 text-sm">No active assignments</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Milestone
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Program
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Due Date
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Type
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {acceptedAssignments.map(milestone => {
                    const program = milestone.programId ? ProgramManager.getProgramById(milestone.programId) : null;
                    return (
                      <tr key={milestone.id}>
                        <td className="px-6 py-4">
                          <div>
                            <div className="text-sm font-medium text-gray-900">{milestone.title}</div>
                            {milestone.description && (
                              <div className="text-sm text-gray-500">{milestone.description}</div>
                            )}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm text-gray-900">{program?.name || 'N/A'}</div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm text-gray-900">{formatDate(milestone.endDate)}</div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(milestone.status)}`}>
                            {milestone.status.replace('_', ' ')}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm text-gray-500">
                            {milestone.assignmentInfo?.isRequired ? 'Required' : 'Optional'}
                          </div>
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

      {/* Declined Assignments */}
      {declinedAssignments.length > 0 && (
        <div className="bg-gray-50 rounded-lg p-6">
          <h3 className="text-lg font-medium text-gray-900 mb-4">
            Declined Assignments ({declinedAssignments.length})
          </h3>
          <div className="space-y-3">
            {declinedAssignments.map(milestone => (
              <div key={milestone.id} className="bg-white rounded-md p-3 text-sm">
                <div className="flex justify-between">
                  <span className="font-medium text-gray-900">{milestone.title}</span>
                  <span className="text-gray-500">
                    Declined on {milestone.assignmentInfo?.declinedAt && formatDate(milestone.assignmentInfo.declinedAt)}
                  </span>
                </div>
                {milestone.assignmentInfo?.declineReason && (
                  <p className="text-gray-600 mt-1">Reason: {milestone.assignmentInfo.declineReason}</p>
                )}
                {milestone.assignmentInfo?.managerResponse && (
                  <p className="text-indigo-600 mt-1">
                    Manager response: {milestone.assignmentInfo.managerResponse.comment}
                  </p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default AssignmentsTab;