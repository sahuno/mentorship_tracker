import React, { useState, useEffect, useRef } from 'react';
import { User, Milestone, MilestoneCategory, MilestoneStatus, AssignmentType, Program } from '../types';
import CloseIcon from './icons/CloseIcon';
import ProgramManager from '../utils/programManager';
import { v4 as uuidv4 } from 'uuid';

interface AssignMilestoneModalProps {
  user: User; // The manager assigning
  programId: string;
  onClose: () => void;
  onAssign: (assignments: MilestoneAssignment[]) => void;
}

interface MilestoneAssignment {
  participantId: string;
  milestone: Omit<Milestone, 'id' | 'userId' | 'createdAt' | 'progressReports'>;
}

const AssignMilestoneModal: React.FC<AssignMilestoneModalProps> = ({
  user,
  programId,
  onClose,
  onAssign
}) => {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState<MilestoneCategory>(MilestoneCategory.SKILL);
  const [startDate, setStartDate] = useState(new Date().toISOString().split('T')[0]);
  const [endDate, setEndDate] = useState('');
  const [isRequired, setIsRequired] = useState(true);
  const [canDecline, setCanDecline] = useState(false);
  const [selectedParticipants, setSelectedParticipants] = useState<string[]>([]);
  const [selectAll, setSelectAll] = useState(false);
  const [error, setError] = useState('');
  const [assignmentType, setAssignmentType] = useState<'individual' | 'bulk'>('individual');

  const modalRef = useRef<HTMLDivElement>(null);
  const firstFocusableElementRef = useRef<HTMLInputElement>(null);

  // Get participants in the program
  const participants = ProgramManager.getParticipantsInProgram(programId);
  const program = ProgramManager.getProgramById(programId);

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

  const handleSelectAll = () => {
    if (selectAll) {
      setSelectedParticipants([]);
    } else {
      setSelectedParticipants(participants.map(p => p.id));
    }
    setSelectAll(!selectAll);
  };

  const toggleParticipant = (participantId: string) => {
    setSelectedParticipants(prev => {
      if (prev.includes(participantId)) {
        return prev.filter(id => id !== participantId);
      } else {
        return [...prev, participantId];
      }
    });
    setSelectAll(false);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    // Validation
    if (!title.trim()) {
      setError('Milestone title is required');
      return;
    }

    if (!endDate) {
      setError('End date is required');
      return;
    }

    const start = new Date(startDate);
    const end = new Date(endDate);

    if (end <= start) {
      setError('End date must be after start date');
      return;
    }

    if (selectedParticipants.length === 0) {
      setError('Please select at least one participant');
      return;
    }

    // Create assignments for each selected participant
    const assignments: MilestoneAssignment[] = selectedParticipants.map(participantId => ({
      participantId,
      milestone: {
        title: title.trim(),
        description: description.trim() || undefined,
        category,
        startDate,
        endDate,
        status: MilestoneStatus.NOT_STARTED,
        programId,
        assignmentInfo: {
          assignedBy: user.id,
          assignedAt: new Date().toISOString(),
          assignmentType: selectedParticipants.length > 1
            ? AssignmentType.BULK_ASSIGNED
            : AssignmentType.MANAGER_ASSIGNED,
          isRequired,
          canDecline,
        }
      }
    }));

    onAssign(assignments);
  };

  const getCategoryLabel = (cat: MilestoneCategory) => {
    switch (cat) {
      case MilestoneCategory.EDUCATION: return 'Education (Books, Courses)';
      case MilestoneCategory.SKILL: return 'Skill (Piano, Driving)';
      case MilestoneCategory.PROJECT: return 'Project (AI Agents, Apps)';
      case MilestoneCategory.FITNESS: return 'Fitness';
      case MilestoneCategory.OTHER: return 'Other';
      default: return cat;
    }
  };

  return (
    <div
      className="fixed inset-0 bg-black bg-opacity-50 z-50 flex justify-center items-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-title"
    >
      <div ref={modalRef} className="bg-white rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="p-6 border-b flex justify-between items-center">
          <div>
            <h3 id="modal-title" className="text-2xl font-bold text-gray-900">
              Assign Milestone
            </h3>
            <p className="mt-1 text-sm text-gray-600">
              {program?.name || 'Program'}
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

        <form onSubmit={handleSubmit}>
          {/* Assignment Type Toggle */}
          <div className="p-6 bg-gray-50 border-b">
            <div className="flex space-x-4">
              <button
                type="button"
                onClick={() => setAssignmentType('individual')}
                className={`px-4 py-2 rounded-md font-medium transition-colors ${
                  assignmentType === 'individual'
                    ? 'bg-indigo-600 text-white'
                    : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'
                }`}
              >
                Individual Assignment
              </button>
              <button
                type="button"
                onClick={() => setAssignmentType('bulk')}
                className={`px-4 py-2 rounded-md font-medium transition-colors ${
                  assignmentType === 'bulk'
                    ? 'bg-indigo-600 text-white'
                    : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'
                }`}
              >
                Bulk Assignment
              </button>
            </div>
          </div>

          <div className="p-6 space-y-4">
            {/* Milestone Details */}
            <div className="space-y-4 pb-4 border-b">
              <h4 className="font-medium text-gray-900">Milestone Details</h4>

              {/* Title */}
              <div>
                <label htmlFor="title" className="block text-sm font-medium text-gray-700">
                  Title <span className="text-red-500">*</span>
                </label>
                <input
                  ref={firstFocusableElementRef}
                  type="text"
                  id="title"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g., Complete Chapter 1-3 of Python Course"
                  className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                  required
                />
              </div>

              {/* Description */}
              <div>
                <label htmlFor="description" className="block text-sm font-medium text-gray-700">
                  Description (Optional)
                </label>
                <textarea
                  id="description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={3}
                  placeholder="Provide detailed instructions or objectives..."
                  className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                />
              </div>

              {/* Category */}
              <div>
                <label htmlFor="category" className="block text-sm font-medium text-gray-700">
                  Category
                </label>
                <select
                  id="category"
                  value={category}
                  onChange={(e) => setCategory(e.target.value as MilestoneCategory)}
                  className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                >
                  {Object.values(MilestoneCategory).map(cat => (
                    <option key={cat} value={cat}>
                      {getCategoryLabel(cat)}
                    </option>
                  ))}
                </select>
              </div>

              {/* Date Range */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="startDate" className="block text-sm font-medium text-gray-700">
                    Start Date <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="date"
                    id="startDate"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    required
                    className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                  />
                </div>
                <div>
                  <label htmlFor="endDate" className="block text-sm font-medium text-gray-700">
                    End Date <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="date"
                    id="endDate"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    required
                    min={startDate}
                    className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                  />
                </div>
              </div>

              {/* Assignment Options */}
              <div className="space-y-2">
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={isRequired}
                    onChange={(e) => setIsRequired(e.target.checked)}
                    className="mr-2"
                  />
                  <span className="text-sm font-medium text-gray-700">Required milestone</span>
                </label>
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={canDecline}
                    onChange={(e) => setCanDecline(e.target.checked)}
                    className="mr-2"
                  />
                  <span className="text-sm font-medium text-gray-700">
                    Allow participants to decline (with reason)
                  </span>
                </label>
              </div>
            </div>

            {/* Participant Selection */}
            <div>
              <div className="flex justify-between items-center mb-2">
                <h4 className="font-medium text-gray-900">Select Participants</h4>
                {assignmentType === 'bulk' && participants.length > 0 && (
                  <button
                    type="button"
                    onClick={handleSelectAll}
                    className="text-sm text-indigo-600 hover:text-indigo-500"
                  >
                    {selectAll ? 'Deselect All' : 'Select All'}
                  </button>
                )}
              </div>

              {participants.length === 0 ? (
                <p className="text-gray-500 text-sm py-4">No participants enrolled in this program yet.</p>
              ) : assignmentType === 'individual' ? (
                <select
                  value={selectedParticipants[0] || ''}
                  onChange={(e) => setSelectedParticipants(e.target.value ? [e.target.value] : [])}
                  className="block w-full border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                  required
                >
                  <option value="">Select a participant</option>
                  {participants.map(participant => (
                    <option key={participant.id} value={participant.id}>
                      {participant.name} ({participant.email})
                    </option>
                  ))}
                </select>
              ) : (
                <div className="space-y-2 max-h-48 overflow-y-auto border border-gray-200 rounded-md p-3">
                  {participants.map(participant => {
                    // Get existing milestones for this participant
                    const milestoneKey = `gbw_milestones_${participant.id}`;
                    const existingMilestones = localStorage.getItem(milestoneKey);
                    const milestoneCount = existingMilestones
                      ? JSON.parse(existingMilestones).filter((m: any) => m.programId === programId).length
                      : 0;

                    return (
                      <label key={participant.id} className="flex items-start">
                        <input
                          type="checkbox"
                          checked={selectedParticipants.includes(participant.id)}
                          onChange={() => toggleParticipant(participant.id)}
                          className="mt-1 mr-3"
                        />
                        <div className="flex-1">
                          <div className="text-sm font-medium text-gray-900">{participant.name}</div>
                          <div className="text-xs text-gray-500">
                            {participant.email} • {milestoneCount} existing milestones
                          </div>
                        </div>
                      </label>
                    );
                  })}
                </div>
              )}

              {selectedParticipants.length > 0 && (
                <p className="mt-2 text-sm text-gray-600">
                  {selectedParticipants.length} participant{selectedParticipants.length !== 1 ? 's' : ''} selected
                </p>
              )}
            </div>

            {/* Error Message */}
            {error && (
              <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-md text-sm">
                {error}
              </div>
            )}

            {/* Info */}
            <div className="bg-blue-50 border border-blue-200 rounded-md p-4">
              <h4 className="text-sm font-medium text-blue-900 mb-2">Assignment Notes:</h4>
              <ul className="text-sm text-blue-700 space-y-1">
                <li>• Participants will be notified of new assignments</li>
                <li>• Required milestones must be completed by the deadline</li>
                <li>• You can track progress through the dashboard</li>
                <li>• Bulk assignments save time for common milestones</li>
              </ul>
            </div>
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
              Assign Milestone{selectedParticipants.length > 1 ? 's' : ''}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default AssignMilestoneModal;