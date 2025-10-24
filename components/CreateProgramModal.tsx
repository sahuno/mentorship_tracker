import React, { useState, useEffect, useRef } from 'react';
import { Program, User, UserRole } from '../types';
import CloseIcon from './icons/CloseIcon';
import ProgramManager from '../utils/programManager';
import UserManager from '../utils/userManager';

interface CreateProgramModalProps {
  user: User;
  onClose: () => void;
  onSave: (program: Program) => void;
}

const CreateProgramModal: React.FC<CreateProgramModalProps> = ({ user, onClose, onSave }) => {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [startDate, setStartDate] = useState(new Date().toISOString().split('T')[0]);
  const [endDate, setEndDate] = useState('');
  const [selectedManagers, setSelectedManagers] = useState<string[]>([user.id]);
  const [error, setError] = useState('');

  const modalRef = useRef<HTMLDivElement>(null);
  const firstFocusableElementRef = useRef<HTMLInputElement>(null);

  // Get all program managers for selection
  const availableManagers = UserManager.getUsersByRole(UserRole.PROGRAM_MANAGER);

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
    if (!name.trim()) {
      setError('Program name is required');
      return;
    }

    if (!description.trim()) {
      setError('Description is required');
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

    if (selectedManagers.length === 0) {
      setError('At least one manager must be assigned');
      return;
    }

    // Create the program
    const newProgram = ProgramManager.createProgram(
      name.trim(),
      description.trim(),
      startDate,
      endDate,
      user.id,
      selectedManagers
    );

    onSave(newProgram);
  };

  const toggleManager = (managerId: string) => {
    setSelectedManagers(prev => {
      if (prev.includes(managerId)) {
        // Don't allow removing the last manager
        if (prev.length === 1) {
          setError('At least one manager is required');
          return prev;
        }
        return prev.filter(id => id !== managerId);
      } else {
        return [...prev, managerId];
      }
    });
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
            Create New Program
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
            {/* Program Name */}
            <div>
              <label htmlFor="name" className="block text-sm font-medium text-gray-700">
                Program Name <span className="text-red-500">*</span>
              </label>
              <input
                ref={firstFocusableElementRef}
                type="text"
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g., Summer Mentorship 2024"
                className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                required
              />
            </div>

            {/* Description */}
            <div>
              <label htmlFor="description" className="block text-sm font-medium text-gray-700">
                Description <span className="text-red-500">*</span>
              </label>
              <textarea
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
                placeholder="Describe the program objectives and goals..."
                className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                required
              />
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

            {/* Manager Selection */}
            {availableManagers.length > 1 && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Assign Managers <span className="text-red-500">*</span>
                </label>
                <div className="space-y-2 max-h-40 overflow-y-auto border border-gray-200 rounded-md p-2">
                  {availableManagers.map(manager => (
                    <label key={manager.id} className="flex items-center">
                      <input
                        type="checkbox"
                        checked={selectedManagers.includes(manager.id)}
                        onChange={() => toggleManager(manager.id)}
                        className="mr-2"
                      />
                      <span className="text-sm">
                        {manager.name} {manager.id === user.id && '(You)'}
                      </span>
                    </label>
                  ))}
                </div>
              </div>
            )}

            {/* Error Message */}
            {error && (
              <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-md text-sm">
                {error}
              </div>
            )}

            {/* Info */}
            <div className="bg-blue-50 border border-blue-200 rounded-md p-4">
              <h4 className="text-sm font-medium text-blue-900 mb-2">Program Setup:</h4>
              <ul className="text-sm text-blue-700 space-y-1">
                <li>• Programs help organize participants and milestones</li>
                <li>• You can assign multiple managers to share oversight</li>
                <li>• Participants will be added after program creation</li>
                <li>• Program status updates automatically based on dates</li>
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
              Create Program
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default CreateProgramModal;