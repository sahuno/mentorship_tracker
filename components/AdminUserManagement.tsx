import React, { useState, useEffect } from 'react';
import { User, UserRole } from '../types';
import InviteUserModal from './InviteUserModal';
import {
  getAllUsers,
  getPendingInvites,
  createRoleInvite,
  cancelInvite,
  updateUserRole
} from '../src/lib/programs';

interface AdminUserManagementProps {
  currentUser: User;
}

interface UserWithEmail {
  id: string;
  name: string;
  email?: string;
  role: string;
  created_at: string;
}

interface PendingInvite {
  id: string;
  email: string;
  target_role: string;
  invitee_name?: string;
  created_at: string;
  expires_at: string;
  program?: {
    name: string;
  };
}

const AdminUserManagement: React.FC<AdminUserManagementProps> = ({ currentUser }) => {
  const [users, setUsers] = useState<UserWithEmail[]>([]);
  const [pendingInvites, setPendingInvites] = useState<PendingInvite[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState<'users' | 'invites'>('users');

  // Modal state
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [inviteRole, setInviteRole] = useState<'program_manager' | 'admin' | 'participant'>('program_manager');

  // Load data
  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      setError('');

      const [usersData, invitesData] = await Promise.all([
        getAllUsers(),
        getPendingInvites()
      ]);

      setUsers(usersData || []);
      setPendingInvites(invitesData || []);
    } catch (err) {
      console.error('Error loading data:', err);
      setError('Failed to load user data');
    } finally {
      setLoading(false);
    }
  };

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

  // Handle opening invite modal
  const handleInvite = (role: 'program_manager' | 'admin' | 'participant') => {
    setInviteRole(role);
    setShowInviteModal(true);
  };

  // Handle creating invite
  const handleCreateInvite = async (
    email: string,
    name: string,
    targetRole: string,
    programId?: string
  ) => {
    try {
      const result = await createRoleInvite(email, name, targetRole as any, programId);
      return result;
    } catch (err) {
      console.error('Error creating invite:', err);
      return {
        success: false,
        error: err instanceof Error ? err.message : 'Failed to create invite'
      };
    }
  };

  // Handle canceling invite
  const handleCancelInvite = async (inviteId: string) => {
    if (!confirm('Are you sure you want to cancel this invitation?')) {
      return;
    }

    try {
      await cancelInvite(inviteId);
      await loadData();
    } catch (err) {
      console.error('Error canceling invite:', err);
      setError('Failed to cancel invitation');
    }
  };

  // Handle role change
  const handleRoleChange = async (userId: string, newRole: UserRole) => {
    if (userId === currentUser.id) {
      setError("You cannot change your own role");
      return;
    }

    const confirmMsg = `Are you sure you want to change this user's role to ${formatRole(newRole)}?`;
    if (!confirm(confirmMsg)) {
      return;
    }

    try {
      await updateUserRole(userId, newRole);
      await loadData();
    } catch (err) {
      console.error('Error updating role:', err);
      setError('Failed to update user role');
    }
  };

  // Format date
  const formatDate = (dateString: string): string => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  // Check if invite is expiring soon (within 7 days)
  const isExpiringSoon = (expiresAt: string): boolean => {
    const expires = new Date(expiresAt);
    const now = new Date();
    const daysUntilExpiry = (expires.getTime() - now.getTime()) / (1000 * 60 * 60 * 24);
    return daysUntilExpiry <= 7;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow">
      {/* Header */}
      <div className="px-6 py-4 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-bold text-gray-900">User Management</h2>
          <div className="flex gap-2">
            <button
              onClick={() => handleInvite('program_manager')}
              className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 transition-colors"
            >
              Invite Manager
            </button>
            <button
              onClick={() => handleInvite('admin')}
              className="px-4 py-2 text-sm font-medium text-white bg-purple-600 rounded-md hover:bg-purple-700 transition-colors"
            >
              Invite Admin
            </button>
          </div>
        </div>
      </div>

      {/* Error Message */}
      {error && (
        <div className="mx-6 mt-4 p-3 bg-red-50 border border-red-200 rounded-md">
          <p className="text-sm text-red-800">{error}</p>
        </div>
      )}

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <nav className="flex -mb-px">
          <button
            onClick={() => setActiveTab('users')}
            className={`px-6 py-3 text-sm font-medium border-b-2 transition-colors ${
              activeTab === 'users'
                ? 'border-indigo-500 text-indigo-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            Users ({users.length})
          </button>
          <button
            onClick={() => setActiveTab('invites')}
            className={`px-6 py-3 text-sm font-medium border-b-2 transition-colors ${
              activeTab === 'invites'
                ? 'border-indigo-500 text-indigo-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            Pending Invites ({pendingInvites.length})
          </button>
        </nav>
      </div>

      {/* Content */}
      <div className="p-6">
        {activeTab === 'users' ? (
          // Users Table
          <div className="overflow-x-auto">
            {users.length === 0 ? (
              <p className="text-gray-500 text-center py-8">No users found</p>
            ) : (
              <table className="min-w-full divide-y divide-gray-200">
                <thead>
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Name
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Email
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Role
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Joined
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {users.map((user) => (
                    <tr key={user.id} className={user.id === currentUser.id ? 'bg-indigo-50' : ''}>
                      <td className="px-4 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          <div className="h-8 w-8 rounded-full bg-gray-200 flex items-center justify-center">
                            <span className="text-sm font-medium text-gray-600">
                              {user.name?.charAt(0)?.toUpperCase() || '?'}
                            </span>
                          </div>
                          <div className="ml-3">
                            <p className="text-sm font-medium text-gray-900">
                              {user.name}
                              {user.id === currentUser.id && (
                                <span className="ml-2 text-xs text-indigo-600">(You)</span>
                              )}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-500">
                        {user.email || 'N/A'}
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getRoleBadgeColor(user.role)}`}>
                          {formatRole(user.role)}
                        </span>
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-500">
                        {formatDate(user.created_at)}
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap text-sm">
                        {user.id !== currentUser.id && (
                          <select
                            value={user.role}
                            onChange={(e) => handleRoleChange(user.id, e.target.value as UserRole)}
                            className="text-sm border border-gray-300 rounded-md px-2 py-1 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                          >
                            <option value="participant">Participant</option>
                            <option value="program_manager">Program Manager</option>
                            <option value="admin">Admin</option>
                          </select>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        ) : (
          // Pending Invites Table
          <div className="overflow-x-auto">
            {pendingInvites.length === 0 ? (
              <p className="text-gray-500 text-center py-8">No pending invitations</p>
            ) : (
              <table className="min-w-full divide-y divide-gray-200">
                <thead>
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Email
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Name
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Role
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Program
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Expires
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {pendingInvites.map((invite) => (
                    <tr key={invite.id}>
                      <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-900">
                        {invite.email}
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-500">
                        {invite.invitee_name || '-'}
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getRoleBadgeColor(invite.target_role)}`}>
                          {formatRole(invite.target_role)}
                        </span>
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-500">
                        {invite.program?.name || '-'}
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap text-sm">
                        <span className={isExpiringSoon(invite.expires_at) ? 'text-amber-600 font-medium' : 'text-gray-500'}>
                          {formatDate(invite.expires_at)}
                          {isExpiringSoon(invite.expires_at) && ' (soon)'}
                        </span>
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap text-sm">
                        <button
                          onClick={() => handleCancelInvite(invite.id)}
                          className="text-red-600 hover:text-red-800 font-medium"
                        >
                          Cancel
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}
      </div>

      {/* Invite Modal */}
      {showInviteModal && (
        <InviteUserModal
          targetRole={inviteRole}
          onClose={() => setShowInviteModal(false)}
          onSuccess={loadData}
          createInvite={handleCreateInvite}
        />
      )}
    </div>
  );
};

export default AdminUserManagement;
