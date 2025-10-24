import React, { useState, useEffect } from 'react';
import { Program, User, UserRole } from '../types';
import UserManager from '../utils/userManager';
import ProgramManager from '../utils/programManager';

interface ManageProgramParticipantsModalProps {
  program: Program;
  onClose: () => void;
  onUpdate: () => void;
}

const ManageProgramParticipantsModal: React.FC<ManageProgramParticipantsModalProps> = ({
  program,
  onClose,
  onUpdate
}) => {
  const [allParticipants, setAllParticipants] = useState<User[]>([]);
  const [enrolledParticipantIds, setEnrolledParticipantIds] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');

  useEffect(() => {
    loadParticipants();
  }, [program.id]);

  const loadParticipants = () => {
    // Get all users with participant role
    const allUsers = UserManager.getAllUsers();
    const participants = allUsers.filter(u => u.role === UserRole.PARTICIPANT);
    setAllParticipants(participants);
    setEnrolledParticipantIds(program.participantIds);
  };

  const filteredParticipants = allParticipants.filter(p =>
    p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    p.email.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const enrolledParticipants = filteredParticipants.filter(p =>
    enrolledParticipantIds.includes(p.id)
  );

  const availableParticipants = filteredParticipants.filter(p =>
    !enrolledParticipantIds.includes(p.id)
  );

  const handleAddParticipant = (participantId: string) => {
    setIsLoading(true);
    try {
      const success = ProgramManager.addParticipantToProgram(program.id, participantId);
      if (success) {
        setEnrolledParticipantIds([...enrolledParticipantIds, participantId]);
        setSuccessMessage('Participant added successfully');
        setTimeout(() => setSuccessMessage(''), 3000);
        onUpdate();
      }
    } catch (error) {
      console.error('Error adding participant:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleRemoveParticipant = (participantId: string) => {
    setIsLoading(true);
    try {
      const success = ProgramManager.removeParticipantFromProgram(program.id, participantId);
      if (success) {
        setEnrolledParticipantIds(enrolledParticipantIds.filter(id => id !== participantId));
        setSuccessMessage('Participant removed successfully');
        setTimeout(() => setSuccessMessage(''), 3000);
        onUpdate();
      }
    } catch (error) {
      console.error('Error removing participant:', error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-gray-500 bg-opacity-75 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200">
          <div className="flex justify-between items-start">
            <div>
              <h3 className="text-lg font-medium text-gray-900">
                Manage Participants
              </h3>
              <p className="mt-1 text-sm text-gray-500">
                {program.name}
              </p>
            </div>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-500"
            >
              <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Success Message */}
        {successMessage && (
          <div className="mx-6 mt-4 p-3 bg-green-50 border border-green-200 rounded-md">
            <p className="text-sm text-green-800">{successMessage}</p>
          </div>
        )}

        {/* Search */}
        <div className="px-6 py-4 border-b border-gray-200">
          <input
            type="text"
            placeholder="Search participants by name or email..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-indigo-500 focus:border-indigo-500"
          />
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-6 py-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Enrolled Participants */}
            <div>
              <h4 className="text-sm font-medium text-gray-900 mb-3">
                Enrolled ({enrolledParticipants.length})
              </h4>
              <div className="space-y-2">
                {enrolledParticipants.length === 0 ? (
                  <p className="text-sm text-gray-500 text-center py-8">
                    No participants enrolled yet
                  </p>
                ) : (
                  enrolledParticipants.map(participant => (
                    <div
                      key={participant.id}
                      className="flex items-center justify-between p-3 bg-green-50 border border-green-200 rounded-lg"
                    >
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900 truncate">
                          {participant.name}
                        </p>
                        <p className="text-xs text-gray-500 truncate">
                          {participant.email}
                        </p>
                      </div>
                      <button
                        onClick={() => handleRemoveParticipant(participant.id)}
                        disabled={isLoading}
                        className="ml-3 p-1 text-red-600 hover:text-red-800 disabled:opacity-50"
                        title="Remove from program"
                      >
                        <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Available Participants */}
            <div>
              <h4 className="text-sm font-medium text-gray-900 mb-3">
                Available ({availableParticipants.length})
              </h4>
              <div className="space-y-2">
                {availableParticipants.length === 0 ? (
                  <p className="text-sm text-gray-500 text-center py-8">
                    {searchQuery ? 'No participants found' : 'All participants are enrolled'}
                  </p>
                ) : (
                  availableParticipants.map(participant => (
                    <div
                      key={participant.id}
                      className="flex items-center justify-between p-3 bg-gray-50 border border-gray-200 rounded-lg hover:bg-gray-100"
                    >
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900 truncate">
                          {participant.name}
                        </p>
                        <p className="text-xs text-gray-500 truncate">
                          {participant.email}
                        </p>
                      </div>
                      <button
                        onClick={() => handleAddParticipant(participant.id)}
                        disabled={isLoading}
                        className="ml-3 p-1 text-green-600 hover:text-green-800 disabled:opacity-50"
                        title="Add to program"
                      >
                        <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                        </svg>
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-200 bg-gray-50">
          <div className="flex justify-between items-center">
            <p className="text-sm text-gray-600">
              {enrolledParticipantIds.length} participant{enrolledParticipantIds.length !== 1 ? 's' : ''} enrolled
            </p>
            <button
              onClick={onClose}
              className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 transition-colors"
            >
              Done
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ManageProgramParticipantsModal;
