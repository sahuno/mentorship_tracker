import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Milestone, ProgressReport } from '../types';
import CloseIcon from './icons/CloseIcon';

interface ProgressReportModalProps {
  milestone: Milestone;
  onClose: () => void;
  onSave: (report: Omit<ProgressReport, 'id'>) => void;
}

const ProgressReportModal: React.FC<ProgressReportModalProps> = ({ milestone, onClose, onSave }) => {
  const [content, setContent] = useState('');
  const [hoursSpent, setHoursSpent] = useState<string>('');
  const [completionPercentage, setCompletionPercentage] = useState<string>('');
  const [selectedWeek, setSelectedWeek] = useState<number>(0);
  const [viewMode, setViewMode] = useState<'add' | 'view'>('add');
  const [error, setError] = useState('');

  const modalRef = useRef<HTMLDivElement>(null);
  const firstFocusableElementRef = useRef<HTMLTextAreaElement>(null);

  // Calculate week information
  const weekInfo = useMemo(() => {
    const startDate = new Date(milestone.startDate);
    const today = new Date();
    const diffTime = Math.abs(today.getTime() - startDate.getTime());
    const currentWeek = Math.ceil(diffTime / (1000 * 60 * 60 * 24 * 7));

    // Get all weeks from start to end
    const endDate = new Date(milestone.endDate);
    const totalDuration = endDate.getTime() - startDate.getTime();
    const totalWeeks = Math.ceil(totalDuration / (1000 * 60 * 60 * 24 * 7));

    const weeks = [];
    for (let i = 1; i <= Math.max(totalWeeks, currentWeek); i++) {
      const weekStart = new Date(startDate);
      weekStart.setDate(weekStart.getDate() + (i - 1) * 7);
      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekEnd.getDate() + 6);

      weeks.push({
        number: i,
        start: weekStart,
        end: weekEnd,
        hasReport: milestone.progressReports.some(r => r.weekNumber === i)
      });
    }

    return { currentWeek, totalWeeks, weeks };
  }, [milestone]);

  useEffect(() => {
    setSelectedWeek(weekInfo.currentWeek);
  }, [weekInfo.currentWeek]);

  // Accessibility: Focus trapping and Escape key
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    firstFocusableElementRef.current?.focus();

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [onClose]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!content.trim()) {
      setError('Progress report content is required');
      return;
    }

    if (selectedWeek <= 0) {
      setError('Please select a valid week');
      return;
    }

    // Check if report already exists for this week
    if (milestone.progressReports.some(r => r.weekNumber === selectedWeek)) {
      setError(`A report already exists for Week ${selectedWeek}`);
      return;
    }

    const reportData: Omit<ProgressReport, 'id'> = {
      weekNumber: selectedWeek,
      date: new Date().toISOString(),
      content: content.trim(),
      hoursSpent: hoursSpent ? parseFloat(hoursSpent) : undefined,
      completionPercentage: completionPercentage ? Math.min(100, Math.max(0, parseFloat(completionPercentage))) : undefined
    };

    onSave(reportData);
  };

  const formatDate = (date: Date) => {
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric'
    });
  };

  const getReportForWeek = (weekNumber: number) => {
    return milestone.progressReports.find(r => r.weekNumber === weekNumber);
  };

  const selectedReport = selectedWeek > 0 ? getReportForWeek(selectedWeek) : null;

  return (
    <div
      className="fixed inset-0 bg-black bg-opacity-50 z-50 flex justify-center items-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-title"
    >
      <div ref={modalRef} className="bg-white rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="p-6 border-b">
          <div className="flex justify-between items-start">
            <div>
              <h3 id="modal-title" className="text-2xl font-bold text-gray-900">Progress Report</h3>
              <p className="mt-1 text-sm text-gray-600">{milestone.title}</p>
            </div>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 transition-colors duration-200"
              aria-label="Close modal"
            >
              <CloseIcon className="h-6 w-6" />
            </button>
          </div>
        </div>

        {/* Week Selection and View Toggle */}
        <div className="p-6 border-b bg-gray-50">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1">
              <label htmlFor="week" className="block text-sm font-medium text-gray-700 mb-1">
                Select Week
              </label>
              <select
                id="week"
                value={selectedWeek}
                onChange={(e) => {
                  const week = parseInt(e.target.value);
                  setSelectedWeek(week);
                  const report = getReportForWeek(week);
                  setViewMode(report ? 'view' : 'add');
                }}
                className="block w-full border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
              >
                {weekInfo.weeks.map(week => (
                  <option key={week.number} value={week.number}>
                    Week {week.number} ({formatDate(week.start)} - {formatDate(week.end)})
                    {week.hasReport && ' ✓'}
                    {week.number === weekInfo.currentWeek && ' (Current)'}
                  </option>
                ))}
              </select>
            </div>

            {selectedReport && (
              <div className="flex items-end gap-2">
                <button
                  type="button"
                  onClick={() => setViewMode(viewMode === 'add' ? 'view' : 'add')}
                  className="px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50"
                >
                  {viewMode === 'view' ? 'Add New Report' : 'View Report'}
                </button>
              </div>
            )}
          </div>

          {/* Previous Reports Summary */}
          {milestone.progressReports.length > 0 && (
            <div className="mt-4 p-3 bg-white rounded-md border border-gray-200">
              <p className="text-sm font-medium text-gray-700">Previous Reports:</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {milestone.progressReports
                  .sort((a, b) => b.weekNumber - a.weekNumber)
                  .slice(0, 5)
                  .map(report => (
                    <button
                      key={report.id}
                      onClick={() => {
                        setSelectedWeek(report.weekNumber);
                        setViewMode('view');
                      }}
                      className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-indigo-100 text-indigo-800 hover:bg-indigo-200"
                    >
                      Week {report.weekNumber}
                      {report.completionPercentage && ` (${report.completionPercentage}%)`}
                    </button>
                  ))}
              </div>
            </div>
          )}
        </div>

        {/* Report Content */}
        {viewMode === 'view' && selectedReport ? (
          // View Mode
          <div className="p-6">
            <div className="space-y-4">
              <div>
                <h4 className="text-sm font-medium text-gray-700">Week {selectedReport.weekNumber} Report</h4>
                <p className="text-xs text-gray-500 mt-1">
                  Submitted on {new Date(selectedReport.date).toLocaleDateString('en-US', {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric'
                  })}
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Progress Report</label>
                <div className="p-4 bg-gray-50 rounded-md">
                  <p className="text-gray-900 whitespace-pre-wrap">{selectedReport.content}</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                {selectedReport.hoursSpent !== undefined && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Hours Spent</label>
                    <p className="mt-1 text-lg font-semibold text-gray-900">{selectedReport.hoursSpent} hours</p>
                  </div>
                )}
                {selectedReport.completionPercentage !== undefined && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Completion</label>
                    <p className="mt-1 text-lg font-semibold text-gray-900">{selectedReport.completionPercentage}%</p>
                  </div>
                )}
              </div>
            </div>

            <div className="mt-6 flex justify-end">
              <button
                onClick={onClose}
                className="px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50"
              >
                Close
              </button>
            </div>
          </div>
        ) : (
          // Add Mode
          <form onSubmit={handleSubmit}>
            <div className="p-6 space-y-4">
              <div>
                <label htmlFor="content" className="block text-sm font-medium text-gray-700">
                  Week {selectedWeek} Progress Report <span className="text-red-500">*</span>
                </label>
                <textarea
                  ref={firstFocusableElementRef}
                  id="content"
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  rows={6}
                  placeholder="Describe what you accomplished this week, challenges faced, and lessons learned..."
                  className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                  required
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="hours" className="block text-sm font-medium text-gray-700">
                    Hours Spent (Optional)
                  </label>
                  <input
                    type="number"
                    id="hours"
                    value={hoursSpent}
                    onChange={(e) => setHoursSpent(e.target.value)}
                    min="0"
                    step="0.5"
                    placeholder="0"
                    className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                  />
                </div>

                <div>
                  <label htmlFor="completion" className="block text-sm font-medium text-gray-700">
                    Completion % (Optional)
                  </label>
                  <input
                    type="number"
                    id="completion"
                    value={completionPercentage}
                    onChange={(e) => setCompletionPercentage(e.target.value)}
                    min="0"
                    max="100"
                    placeholder="0"
                    className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                  />
                </div>
              </div>

              {/* Prompts for reflection */}
              <div className="bg-blue-50 border border-blue-200 rounded-md p-4">
                <h4 className="text-sm font-medium text-blue-900 mb-2">Reflection Prompts:</h4>
                <ul className="text-sm text-blue-700 space-y-1">
                  <li>• What specific progress did you make this week?</li>
                  <li>• What challenges did you encounter?</li>
                  <li>• What will you focus on next week?</li>
                  <li>• Any resources or support needed?</li>
                </ul>
              </div>

              {error && (
                <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-md text-sm">
                  {error}
                </div>
              )}
            </div>

            <div className="p-6 bg-gray-50 flex justify-end gap-3">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 transition-colors duration-200"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 transition-colors duration-200"
              >
                Submit Report
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};

export default ProgressReportModal;