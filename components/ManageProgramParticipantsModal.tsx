import React, { useState, useEffect } from 'react';
import { addParticipantToProgram, removeParticipantFromProgram, getProgram } from '../src/lib/programs';

interface Participant {
  id: string;
  name: string;
  email: string;
  role?: string;
  enrolled_at?: string;
}

interface Program {
  id: string;
  name: string;
  description?: string;
}

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
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [loadingParticipants, setLoadingParticipants] = useState(true);
  const [message, setMessage] = useState<{ type: 'success' | 'error' | 'info'; text: string } | null>(null);
  const [inviteLink, setInviteLink] = useState<string | null>(null);

  useEffect(() => {
    loadParticipants();
  }, [program.id]);

  const loadParticipants = async () => {
    try {
      setLoadingParticipants(true);
      const data = await getProgram(program.id);

      // Extract participants from program_participants relation
      const enrolledParticipants = data?.program_participants?.map((pp: any) => ({
        id: pp.profiles.id,
        name: pp.profiles.name,
        email: pp.profiles.email,
        role: pp.profiles.role,
        enrolled_at: pp.enrolled_at
      })) || [];

      setParticipants(enrolledParticipants);
    } catch (error) {
      console.error('Error loading participants:', error);
      setMessage({
        type: 'error',
        text: 'Failed to load participants'
      });
    } finally {
      setLoadingParticipants(false);
    }
  };

  const handleAddParticipant = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!email.trim()) {
      setMessage({ type: 'error', text: 'Please enter an email address' });
      return;
    }

    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      setMessage({ type: 'error', text: 'Please enter a valid email address' });
      return;
    }

    setIsLoading(true);
    setMessage(null);
    setInviteLink(null);

    try {
      const result = await addParticipantToProgram(program.id, email);

      if (result.enrolled) {
        // Existing user was enrolled
        setMessage({
          type: 'success',
          text: `${result.participant.name} has been added to the program`
        });
        setEmail('');
        await loadParticipants();
        onUpdate();
      } else if (result.needsInvite) {
        // New user - invite created
        const inviteUrl = `${window.location.origin}/signup?invite=${result.inviteCode}`;
        setInviteLink(inviteUrl);
        setMessage({
          type: 'info',
          text: `Invitation sent to ${email}. They'll be enrolled once they sign up.`
        });
        setEmail('');
        onUpdate();
      }
    } catch (error: any) {
      console.error('Error adding participant:', error);
      setMessage({
        type: 'error',
        text: error.message || 'Failed to add participant'
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleRemoveParticipant = async (participantId: string, participantName: string) => {
    if (!confirm(`Remove ${participantName} from this program?`)) {
      return;
    }

    try {
      await removeParticipantFromProgram(program.id, participantId);
      setMessage({
        type: 'success',
        text: `${participantName} has been removed from the program`
      });
      await loadParticipants();
      onUpdate();
    } catch (error: any) {
      console.error('Error removing participant:', error);
      setMessage({
        type: 'error',
        text: error.message || 'Failed to remove participant'
      });
    }
  };

  const copyInviteLink = () => {
    if (inviteLink) {
      navigator.clipboard.writeText(inviteLink);
      setMessage({
        type: 'success',
        text: 'Invite link copied to clipboard!'
      });
      setTimeout(() => setMessage(null), 2000);
    }
  };

  return (
    <div className="fixed inset-0 bg-gray-500 bg-opacity-75 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] flex flex-col">
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

        {/* Message */}
        {message && (
          <div className={`mx-6 mt-4 p-3 rounded-md ${
            message.type === 'success' ? 'bg-green-50 border border-green-200' :
            message.type === 'error' ? 'bg-red-50 border border-red-200' :
            'bg-blue-50 border border-blue-200'
          }`}>
            <p className={`text-sm ${
              message.type === 'success' ? 'text-green-800' :
              message.type === 'error' ? 'text-red-800' :
              'text-blue-800'
            }`}>
              {message.text}
            </p>
          </div>
        )}

        {/* Invite Link Display */}
        {inviteLink && (
          <div className="mx-6 mt-4 p-4 bg-blue-50 border border-blue-200 rounded-md">
            <p className="text-sm font-medium text-blue-900 mb-2">
              Share this invite link:
            </p>
            <div className="flex gap-2">
              <input
                type="text"
                readOnly
                value={inviteLink}
                className="flex-1 px-3 py-2 bg-white border border-blue-300 rounded-md text-sm"
              />
              <button
                onClick={copyInviteLink}
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 text-sm font-medium"
              >
                Copy
              </button>
            </div>
          </div>
        )}

        {/* Add Participant Form */}
        <div className="px-6 py-4 border-b border-gray-200">
          <form onSubmit={handleAddParticipant} className="flex gap-2">
            <input
              type="email"
              placeholder="Enter participant email address..."
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={isLoading}
              className="flex-1 px-4 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100"
            />
            <button
              type="submit"
              disabled={isLoading}
              className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-blue-300 font-medium"
            >
              {isLoading ? 'Adding...' : 'Add'}
            </button>
          </form>
          <p className="mt-2 text-xs text-gray-500">
            If the participant doesn't have an account, we'll create an invite for them.
          </p>
        </div>

        {/* Participants List */}
        <div className="flex-1 overflow-y-auto px-6 py-4">
          <h4 className="text-sm font-medium text-gray-900 mb-3">
            Enrolled Participants ({participants.length})
          </h4>

          {loadingParticipants ? (
            <div className="text-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
              <p className="text-sm text-gray-500 mt-2">Loading participants...</p>
            </div>
          ) : participants.length === 0 ? (
            <div className="text-center py-8">
              <svg
                className="mx-auto h-12 w-12 text-gray-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z"
                />
              </svg>
              <p className="text-sm text-gray-500 mt-2">
                No participants enrolled yet
              </p>
              <p className="text-xs text-gray-400 mt-1">
                Add participants using their email address above
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {participants.map(participant => (
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
                    {participant.enrolled_at && (
                      <p className="text-xs text-gray-400 mt-1">
                        Enrolled: {new Date(participant.enrolled_at).toLocaleDateString()}
                      </p>
                    )}
                  </div>
                  <button
                    onClick={() => handleRemoveParticipant(participant.id, participant.name)}
                    className="ml-3 text-red-600 hover:text-red-800 text-sm font-medium"
                  >
                    Remove
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-200 bg-gray-50">
          <button
            onClick={onClose}
            className="w-full px-4 py-2 bg-white border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50 font-medium"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

export default ManageProgramParticipantsModal;
