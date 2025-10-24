import React, { useState, useEffect, useRef } from 'react';
import { Milestone, MilestoneCategory, MilestoneStatus } from '../types';
import CloseIcon from './icons/CloseIcon';

interface AddMilestoneModalProps {
  onClose: () => void;
  onSave: (milestone: Omit<Milestone, 'id' | 'userId' | 'createdAt' | 'progressReports'>) => void;
  milestoneToEdit?: Milestone | null;
}

const AddMilestoneModal: React.FC<AddMilestoneModalProps> = ({ onClose, onSave, milestoneToEdit }) => {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState<MilestoneCategory>(MilestoneCategory.SKILL);
  const [startDate, setStartDate] = useState(new Date().toISOString().split('T')[0]);
  const [endDate, setEndDate] = useState('');
  const [status, setStatus] = useState<MilestoneStatus>(MilestoneStatus.NOT_STARTED);
  const [error, setError] = useState('');

  const isEditing = !!milestoneToEdit;
  const modalRef = useRef<HTMLDivElement>(null);
  const firstFocusableElementRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (milestoneToEdit) {
      setTitle(milestoneToEdit.title);
      setDescription(milestoneToEdit.description || '');
      setCategory(milestoneToEdit.category);
      setStartDate(milestoneToEdit.startDate.split('T')[0]);
      setEndDate(milestoneToEdit.endDate.split('T')[0]);
      setStatus(milestoneToEdit.status);
    }
  }, [milestoneToEdit]);

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

    // Validation
    if (!title.trim()) {
      setError('Title is required');
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

    const milestoneData: Omit<Milestone, 'id' | 'userId' | 'createdAt' | 'progressReports'> = {
      title: title.trim(),
      description: description.trim() || undefined,
      category,
      startDate,
      endDate,
      status
    };

    onSave(milestoneData);
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
      <div ref={modalRef} className="bg-white rounded-lg shadow-xl w-full max-w-lg max-h-full overflow-y-auto">
        <div className="p-6 border-b flex justify-between items-center">
          <h3 id="modal-title" className="text-2xl font-bold text-gray-900">
            {isEditing ? 'Edit Milestone' : 'Add New Milestone'}
          </h3>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors duration-200"
            aria-label="Close modal"
          >
            <CloseIcon className="h-6 w-6" />
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="p-6 space-y-4">
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
                placeholder="e.g., Learn Piano, Complete Driving Course"
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
                placeholder="Describe your milestone goals and objectives..."
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

            {/* Status (only for editing) */}
            {isEditing && (
              <div>
                <label htmlFor="status" className="block text-sm font-medium text-gray-700">
                  Status
                </label>
                <select
                  id="status"
                  value={status}
                  onChange={(e) => setStatus(e.target.value as MilestoneStatus)}
                  className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                >
                  <option value={MilestoneStatus.NOT_STARTED}>Not Started</option>
                  <option value={MilestoneStatus.IN_PROGRESS}>In Progress</option>
                  <option value={MilestoneStatus.PAUSED}>Paused</option>
                  <option value={MilestoneStatus.COMPLETED}>Completed</option>
                </select>
              </div>
            )}

            {/* Error Message */}
            {error && (
              <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-md text-sm">
                {error}
              </div>
            )}

            {/* Tips */}
            <div className="bg-blue-50 border border-blue-200 rounded-md p-4">
              <h4 className="text-sm font-medium text-blue-900 mb-2">Tips for Success:</h4>
              <ul className="text-sm text-blue-700 space-y-1">
                <li>• Set realistic timeframes for your milestones</li>
                <li>• Break down large goals into smaller milestones</li>
                <li>• Add weekly progress reports to track your journey</li>
                <li>• Update status regularly to stay motivated</li>
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
              {isEditing ? 'Save Changes' : 'Add Milestone'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default AddMilestoneModal;