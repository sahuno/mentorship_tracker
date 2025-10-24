import React, { useMemo } from 'react';
import { Milestone, MilestoneStatus, MilestoneCategory } from '../types';

interface MilestoneCardProps {
  milestone: Milestone;
  onEdit: (milestone: Milestone) => void;
  onDelete: (milestoneId: string) => void;
  onAddReport: (milestone: Milestone) => void;
  onUpdateStatus: (milestoneId: string, status: MilestoneStatus) => void;
}

const MilestoneCard: React.FC<MilestoneCardProps> = ({
  milestone,
  onEdit,
  onDelete,
  onAddReport,
  onUpdateStatus
}) => {
  // Calculate progress
  const progress = useMemo(() => {
    const startDate = new Date(milestone.startDate);
    const endDate = new Date(milestone.endDate);
    const today = new Date();

    // Time-based progress
    const totalDuration = endDate.getTime() - startDate.getTime();
    const elapsedDuration = today.getTime() - startDate.getTime();
    const timeProgress = Math.min(Math.max((elapsedDuration / totalDuration) * 100, 0), 100);

    // Report-based progress (if reports have completion percentage)
    const reportProgress = milestone.progressReports.length > 0
      ? milestone.progressReports[milestone.progressReports.length - 1].completionPercentage || 0
      : 0;

    // Days remaining
    const daysRemaining = Math.ceil((endDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

    return {
      timeProgress,
      reportProgress,
      daysRemaining,
      isOverdue: daysRemaining < 0 && milestone.status !== MilestoneStatus.COMPLETED
    };
  }, [milestone]);

  // Get category styles
  const getCategoryStyles = (category: MilestoneCategory) => {
    switch (category) {
      case MilestoneCategory.EDUCATION:
        return 'bg-blue-100 text-blue-800 border-blue-200';
      case MilestoneCategory.SKILL:
        return 'bg-purple-100 text-purple-800 border-purple-200';
      case MilestoneCategory.PROJECT:
        return 'bg-green-100 text-green-800 border-green-200';
      case MilestoneCategory.FITNESS:
        return 'bg-orange-100 text-orange-800 border-orange-200';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  // Get status styles
  const getStatusStyles = (status: MilestoneStatus) => {
    switch (status) {
      case MilestoneStatus.NOT_STARTED:
        return 'bg-gray-100 text-gray-800';
      case MilestoneStatus.IN_PROGRESS:
        return 'bg-blue-100 text-blue-800';
      case MilestoneStatus.COMPLETED:
        return 'bg-green-100 text-green-800';
      case MilestoneStatus.PAUSED:
        return 'bg-yellow-100 text-yellow-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  };

  const getWeekNumber = () => {
    const startDate = new Date(milestone.startDate);
    const today = new Date();
    const diffTime = Math.abs(today.getTime() - startDate.getTime());
    const diffWeeks = Math.ceil(diffTime / (1000 * 60 * 60 * 24 * 7));
    return diffWeeks;
  };

  return (
    <div className="bg-white rounded-lg shadow-md hover:shadow-lg transition-shadow duration-200">
      <div className="p-6">
        {/* Header */}
        <div className="flex justify-between items-start mb-4">
          <div className="flex-1">
            <h3 className="text-lg font-semibold text-gray-900 mb-1">{milestone.title}</h3>
            <div className="flex flex-wrap gap-2">
              <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getCategoryStyles(milestone.category)}`}>
                {milestone.category}
              </span>
              <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusStyles(milestone.status)}`}>
                {milestone.status.replace('_', ' ')}
              </span>
            </div>
          </div>
          <div className="flex space-x-1">
            <button
              onClick={() => onEdit(milestone)}
              className="p-1 text-gray-400 hover:text-gray-600"
              aria-label="Edit milestone"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
              </svg>
            </button>
            <button
              onClick={() => onDelete(milestone.id)}
              className="p-1 text-gray-400 hover:text-red-600"
              aria-label="Delete milestone"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
            </button>
          </div>
        </div>

        {/* Description */}
        {milestone.description && (
          <p className="text-sm text-gray-600 mb-4 line-clamp-2">{milestone.description}</p>
        )}

        {/* Date Range */}
        <div className="text-sm text-gray-500 mb-4">
          <div className="flex items-center">
            <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            {formatDate(milestone.startDate)} - {formatDate(milestone.endDate)}
          </div>
          {progress.isOverdue ? (
            <span className="text-red-600 font-medium">Overdue by {Math.abs(progress.daysRemaining)} days</span>
          ) : (
            <span className={progress.daysRemaining <= 7 ? 'text-orange-600 font-medium' : ''}>
              {progress.daysRemaining} days remaining
            </span>
          )}
        </div>

        {/* Progress Bar */}
        <div className="mb-4">
          <div className="flex justify-between text-sm mb-1">
            <span className="text-gray-600">Progress</span>
            <span className="font-medium text-gray-900">
              {milestone.progressReports.length > 0 && milestone.progressReports[milestone.progressReports.length - 1].completionPercentage
                ? `${milestone.progressReports[milestone.progressReports.length - 1].completionPercentage}%`
                : `${Math.round(progress.timeProgress)}% (time)`}
            </span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2 overflow-hidden">
            <div
              className={`h-2 rounded-full transition-all duration-500 ${
                progress.reportProgress > 0
                  ? progress.reportProgress >= 100 ? 'bg-green-500'
                    : progress.reportProgress >= 70 ? 'bg-blue-500'
                    : progress.reportProgress >= 40 ? 'bg-yellow-500'
                    : 'bg-orange-500'
                  : 'bg-gray-400'
              }`}
              style={{ width: `${progress.reportProgress || progress.timeProgress}%` }}
            />
          </div>
        </div>

        {/* Reports Info */}
        <div className="flex items-center justify-between text-sm text-gray-600 mb-4">
          <div className="flex items-center">
            <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            {milestone.progressReports.length} reports
          </div>
          <span>Week {getWeekNumber()}</span>
        </div>

        {/* Actions */}
        <div className="flex gap-2">
          <button
            onClick={() => onAddReport(milestone)}
            className="flex-1 px-3 py-2 border border-indigo-600 text-sm font-medium rounded-md text-indigo-600 bg-white hover:bg-indigo-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-colors duration-200"
          >
            Add Report
          </button>
          {milestone.status !== MilestoneStatus.COMPLETED && (
            <select
              value={milestone.status}
              onChange={(e) => onUpdateStatus(milestone.id, e.target.value as MilestoneStatus)}
              className="px-3 py-2 border border-gray-300 text-sm font-medium rounded-md focus:ring-indigo-500 focus:border-indigo-500"
            >
              <option value={MilestoneStatus.NOT_STARTED}>Not Started</option>
              <option value={MilestoneStatus.IN_PROGRESS}>In Progress</option>
              <option value={MilestoneStatus.PAUSED}>Paused</option>
              <option value={MilestoneStatus.COMPLETED}>Completed</option>
            </select>
          )}
        </div>
      </div>
    </div>
  );
};

export default MilestoneCard;