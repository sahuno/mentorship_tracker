import React, { useState, useRef, useEffect } from 'react';
import CloseIcon from './icons/CloseIcon';

interface InviteUserModalProps {
  targetRole: 'program_manager' | 'admin' | 'participant';
  programId?: string;
  programName?: string;
  onClose: () => void;
  onSuccess: () => void;
  createInvite: (email: string, name: string, targetRole: string, programId?: string) => Promise<{
    success: boolean;
    inviteCode?: string;
    error?: string;
  }>;
}

const InviteUserModal: React.FC<InviteUserModalProps> = ({
  targetRole,
  programId,
  programName,
  onClose,
  onSuccess,
  createInvite,
}) => {
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [inviteLink, setInviteLink] = useState('');
  const [copied, setCopied] = useState(false);

  const modalRef = useRef<HTMLDivElement>(null);
  const firstInputRef = useRef<HTMLInputElement>(null);

  // Focus management and escape key
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    firstInputRef.current?.focus();

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [onClose]);

  // Format role for display
  const formatRole = (role: string): string => {
    switch (role) {
      case 'admin':
        return 'Administrator';
      case 'program_manager':
        return 'Program Manager';
      case 'participant':
        return 'Participant';
      default:
        return role;
    }
  };

  // Get role badge color
  const getRoleBadgeColor = (role: string): string => {
    switch (role) {
      case 'admin':
        return 'bg-purple-100 text-purple-800';
      case 'program_manager':
        return 'bg-blue-100 text-blue-800';
      case 'participant':
        return 'bg-green-100 text-green-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      if (!email.trim()) {
        throw new Error('Email is required');
      }

      // Basic email validation
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        throw new Error('Please enter a valid email address');
      }

      const result = await createInvite(
        email.toLowerCase().trim(),
        name.trim(),
        targetRole,
        programId
      );

      if (!result.success) {
        throw new Error(result.error || 'Failed to create invitation');
      }

      if (result.inviteCode) {
        // Generate the invite link
        const baseUrl = window.location.origin;
        const link = `${baseUrl}?invite=${result.inviteCode}`;
        setInviteLink(link);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(inviteLink);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  const handleDone = () => {
    onSuccess();
    onClose();
  };

  return (
    <div
      className="fixed inset-0 bg-black bg-opacity-50 z-50 flex justify-center items-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-title"
    >
      <div
        ref={modalRef}
        className="bg-white rounded-lg shadow-xl w-full max-w-md max-h-full overflow-y-auto"
      >
        {/* Header */}
        <div className="p-6 border-b flex justify-between items-center">
          <div>
            <h3 id="modal-title" className="text-xl font-bold text-gray-900">
              {inviteLink ? 'Invitation Created!' : `Invite ${formatRole(targetRole)}`}
            </h3>
            {programName && (
              <p className="text-sm text-gray-500 mt-1">
                Program: {programName}
              </p>
            )}
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors duration-200"
            aria-label="Close modal"
          >
            <CloseIcon className="h-6 w-6" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
          {!inviteLink ? (
            // Form
            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Role Badge */}
              <div className="flex items-center space-x-2">
                <span className="text-sm text-gray-600">Inviting as:</span>
                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getRoleBadgeColor(targetRole)}`}>
                  {formatRole(targetRole)}
                </span>
              </div>

              {/* Email Input */}
              <div>
                <label htmlFor="invite-email" className="block text-sm font-medium text-gray-700">
                  Email Address *
                </label>
                <input
                  ref={firstInputRef}
                  type="email"
                  id="invite-email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="user@example.com"
                  required
                  className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                />
              </div>

              {/* Name Input (Optional) */}
              <div>
                <label htmlFor="invite-name" className="block text-sm font-medium text-gray-700">
                  Name (Optional)
                </label>
                <input
                  type="text"
                  id="invite-name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="John Doe"
                  className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                />
                <p className="mt-1 text-xs text-gray-500">
                  Name will be shown in the invitation for reference
                </p>
              </div>

              {/* Error Message */}
              {error && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-md">
                  <p className="text-sm text-red-800">{error}</p>
                </div>
              )}

              {/* Info Box */}
              <div className="p-3 bg-blue-50 border border-blue-200 rounded-md">
                <p className="text-sm text-blue-800">
                  An invitation link will be generated. Share this link with the user to complete their registration.
                </p>
              </div>

              {/* Buttons */}
              <div className="flex justify-end gap-3 pt-4">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 transition-colors duration-200"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loading ? 'Creating...' : 'Create Invitation'}
                </button>
              </div>
            </form>
          ) : (
            // Success State - Show Invite Link
            <div className="space-y-4">
              {/* Success Icon */}
              <div className="flex justify-center">
                <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center">
                  <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
              </div>

              {/* Success Message */}
              <div className="text-center">
                <p className="text-gray-900 font-medium">
                  Invitation created for {email}
                </p>
                <p className="text-sm text-gray-500 mt-1">
                  Share the link below to complete registration
                </p>
              </div>

              {/* Invite Link Box */}
              <div className="bg-gray-50 border border-gray-200 rounded-md p-3">
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    readOnly
                    value={inviteLink}
                    className="flex-1 bg-white border border-gray-300 rounded px-3 py-2 text-sm text-gray-700 font-mono"
                  />
                  <button
                    onClick={copyToClipboard}
                    className={`px-3 py-2 text-sm font-medium rounded-md transition-colors duration-200 ${
                      copied
                        ? 'bg-green-100 text-green-800 border border-green-200'
                        : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'
                    }`}
                  >
                    {copied ? 'Copied!' : 'Copy'}
                  </button>
                </div>
              </div>

              {/* Expiry Note */}
              <div className="p-3 bg-amber-50 border border-amber-200 rounded-md">
                <p className="text-sm text-amber-800">
                  <strong>Note:</strong> This invitation expires in 30 days. The user must sign up using this link to receive their {formatRole(targetRole).toLowerCase()} role.
                </p>
              </div>

              {/* Done Button */}
              <div className="flex justify-end pt-4">
                <button
                  onClick={handleDone}
                  className="px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 transition-colors duration-200"
                >
                  Done
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default InviteUserModal;
