import React, { useState, useEffect } from 'react';
import { login, signUp } from '../src/lib/auth';
import { getInviteDetails, acceptInvite } from '../src/lib/programs';
import { UserRole } from '../types';

interface LoginProps {
  onLogin: (user: any) => void;
}

const LoginSupabase: React.FC<LoginProps> = ({ onLogin }) => {
  const [isSignUp, setIsSignUp] = useState(false);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [role, setRole] = useState<UserRole>(UserRole.PARTICIPANT);
  const [accessCode, setAccessCode] = useState('');
  const [phone, setPhone] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  // Invite handling
  const [inviteCode, setInviteCode] = useState<string | null>(null);
  const [inviteDetails, setInviteDetails] = useState<any>(null);
  const [loadingInvite, setLoadingInvite] = useState(false);

  // Check for invite code in URL on mount
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const invite = params.get('invite');

    if (invite) {
      setInviteCode(invite);
      setIsSignUp(true); // Auto-switch to signup mode
      loadInviteDetails(invite);
    }
  }, []);

  const loadInviteDetails = async (code: string) => {
    try {
      setLoadingInvite(true);
      const details = await getInviteDetails(code);

      if (details) {
        setInviteDetails(details);
        setEmail(details.email); // Pre-fill email from invite
        setRole(UserRole.PARTICIPANT); // Force participant role for invites
      } else {
        setError('Invalid or expired invite link');
      }
    } catch (err) {
      console.error('Error loading invite:', err);
      setError('Failed to load invite details');
    } finally {
      setLoadingInvite(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setIsLoading(true);

    try {
      if (isSignUp) {
        // Sign up flow
        if (!name.trim()) {
          throw new Error('Name is required');
        }
        if (password.length < 6) {
          throw new Error('Password must be at least 6 characters');
        }
        if (password !== confirmPassword) {
          throw new Error('Passwords do not match');
        }

        // Validate access codes for special roles
        if (role === UserRole.PROGRAM_MANAGER && accessCode !== 'MANAGER2024') {
          throw new Error('Invalid access code for Program Manager role');
        }
        if (role === UserRole.ADMIN && accessCode !== 'ADMIN2024') {
          throw new Error('Invalid access code for Admin role');
        }

        // Create user with Supabase
        const { user } = await signUp({
          email,
          password,
          name,
          role: inviteCode ? UserRole.PARTICIPANT : role, // Force participant for invites
          phone: phone || undefined,
        });

        if (user) {
          // If signing up with an invite, accept it
          if (inviteCode) {
            try {
              const accepted = await acceptInvite(inviteCode, user.id);
              if (accepted) {
                setSuccess(
                  `Account created and enrolled in ${inviteDetails?.program?.name}! ` +
                  'Please check your email to confirm your account.'
                );
              } else {
                setSuccess('Account created! Please check your email to confirm your account.');
              }
            } catch (inviteError) {
              console.error('Error accepting invite:', inviteError);
              // Don't fail signup if invite acceptance fails
              setSuccess('Account created! Please check your email to confirm your account.');
            }
          } else {
            setSuccess('Account created successfully! Please check your email to confirm your account.');
          }
          // Note: Supabase requires email confirmation by default
          // We'll need to handle this in production
        }
      } else {
        // Sign in flow with enhanced secure profile fetching
        const result = await login({ email, password });

        if (!result.user) {
          throw new Error('Invalid email or password');
        }

        // Call onLogin with combined user data
        // The login function already fetches the profile securely
        onLogin({
          id: result.user.id,
          email: result.user.email,
          name: result.profile?.name || '',
          role: result.profile?.role || UserRole.PARTICIPANT,
        });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setIsLoading(false);
    }
  };

  const toggleMode = () => {
    setIsSignUp(!isSignUp);
    setError('');
    setSuccess('');
    setName('');
    setEmail('');
    setPassword('');
    setConfirmPassword('');
    setRole(UserRole.PARTICIPANT);
    setAccessCode('');
    setPhone('');
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-indigo-100 via-purple-50 to-pink-100">
      <div className="w-full max-w-md p-8 space-y-8 bg-white rounded-lg shadow-xl">
        <div>
          <h1 className="text-3xl font-extrabold text-center text-gray-900">
            Golden Bridge Women
          </h1>
          <p className="mt-2 text-center text-sm text-gray-600">
            {isSignUp ? 'Create your account' : 'Sign in to your spending tracker'}
          </p>
          <div className="mt-2 flex items-center justify-center">
            <div className="flex items-center space-x-2 px-3 py-1 bg-green-50 border border-green-200 rounded-md">
              <svg className="w-4 h-4 text-green-600" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
              <span className="text-xs font-medium text-green-700">Supabase Auth</span>
            </div>
          </div>
        </div>

        {/* Invite Details Banner */}
        {loadingInvite && (
          <div className="p-4 bg-blue-50 border border-blue-200 rounded-md">
            <p className="text-sm text-blue-800 text-center">Loading invite details...</p>
          </div>
        )}

        {inviteDetails && isSignUp && (
          <div className="p-4 bg-blue-50 border border-blue-200 rounded-md">
            <div className="flex items-start">
              <svg
                className="w-5 h-5 text-blue-600 mt-0.5 mr-3 flex-shrink-0"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M3 19v-8.93a2 2 0 01.89-1.664l7-4.666a2 2 0 012.22 0l7 4.666A2 2 0 0121 10.07V19M3 19a2 2 0 002 2h14a2 2 0 002-2M3 19l6.75-4.5M21 19l-6.75-4.5M3 10l6.75 4.5M21 10l-6.75 4.5m0 0l-1.14.76a2 2 0 01-2.22 0l-1.14-.76"
                />
              </svg>
              <div className="flex-1">
                <p className="text-sm font-medium text-blue-900">You're invited to join:</p>
                <p className="text-base font-semibold text-blue-900 mt-1">
                  {inviteDetails.program?.name}
                </p>
                {inviteDetails.program?.description && (
                  <p className="text-sm text-blue-700 mt-1">
                    {inviteDetails.program.description}
                  </p>
                )}
              </div>
            </div>
          </div>
        )}

        <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
          <div className="space-y-4">
            {isSignUp && (
              <>
                <div>
                  <label htmlFor="name" className="block text-sm font-medium text-gray-700">
                    Full Name *
                  </label>
                  <input
                    id="name"
                    name="name"
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                    placeholder="Sarah Johnson"
                  />
                </div>

                <div>
                  <label htmlFor="phone" className="block text-sm font-medium text-gray-700">
                    Phone (Optional)
                  </label>
                  <input
                    id="phone"
                    name="phone"
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                    placeholder="+1 (555) 123-4567"
                  />
                </div>

                {!inviteCode && (
                  <div>
                    <label htmlFor="role" className="block text-sm font-medium text-gray-700">
                      Account Type *
                    </label>
                    <select
                      id="role"
                      name="role"
                      value={role}
                      onChange={(e) => setRole(e.target.value as UserRole)}
                      className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                    >
                      <option value={UserRole.PARTICIPANT}>Participant</option>
                      <option value={UserRole.PROGRAM_MANAGER}>Program Manager</option>
                      <option value={UserRole.ADMIN}>Admin</option>
                    </select>
                  </div>
                )}

                {(role === UserRole.PROGRAM_MANAGER || role === UserRole.ADMIN) && (
                  <div>
                    <label htmlFor="accessCode" className="block text-sm font-medium text-gray-700">
                      Access Code *
                    </label>
                    <input
                      id="accessCode"
                      name="accessCode"
                      type="password"
                      required
                      value={accessCode}
                      onChange={(e) => setAccessCode(e.target.value)}
                      className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                      placeholder={role === UserRole.ADMIN ? 'Admin access code' : 'Manager access code'}
                    />
                    <p className="mt-1 text-xs text-gray-500">
                      Contact your administrator for the access code
                    </p>
                  </div>
                )}
              </>
            )}

            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700">
                Email Address *
              </label>
              <input
                id="email"
                name="email"
                type="email"
                required
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={!!inviteCode} // Disable if from invite
                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
                placeholder="you@example.com"
              />
              {inviteCode && (
                <p className="mt-1 text-xs text-gray-500">
                  Email is pre-filled from your invitation
                </p>
              )}
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-700">
                Password *
              </label>
              <input
                id="password"
                name="password"
                type="password"
                required
                autoComplete={isSignUp ? 'new-password' : 'current-password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                placeholder="••••••••"
              />
              {isSignUp && (
                <p className="mt-1 text-xs text-gray-500">
                  Must be at least 6 characters
                </p>
              )}
            </div>

            {isSignUp && (
              <div>
                <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700">
                  Confirm Password *
                </label>
                <input
                  id="confirmPassword"
                  name="confirmPassword"
                  type="password"
                  required
                  autoComplete="new-password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                  placeholder="••••••••"
                />
              </div>
            )}
          </div>

          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-md">
              <p className="text-sm text-red-800">{error}</p>
            </div>
          )}

          {success && (
            <div className="p-3 bg-green-50 border border-green-200 rounded-md">
              <p className="text-sm text-green-800">{success}</p>
            </div>
          )}

          <div>
            <button
              type="submit"
              disabled={isLoading}
              className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? 'Processing...' : isSignUp ? 'Create Account' : 'Sign In'}
            </button>
          </div>

          <div className="text-center">
            <button
              type="button"
              onClick={toggleMode}
              className="text-sm text-indigo-600 hover:text-indigo-500"
            >
              {isSignUp ? 'Already have an account? Sign in' : 'Need an account? Sign up'}
            </button>
          </div>
        </form>

        {/* Test Credentials */}
        {!isSignUp && (
          <div className="mt-6 p-4 bg-gray-50 border border-gray-200 rounded-md">
            <p className="text-xs font-semibold text-gray-700 mb-2">Test Credentials:</p>
            <div className="space-y-1 text-xs text-gray-600">
              <p><strong>Admin:</strong> admin@goldenbridge.org / Admin123!</p>
              <p><strong>Manager:</strong> manager@goldenbridge.org / Manager123!</p>
              <p><strong>Participant:</strong> participant@goldenbridge.org / Participant123!</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default LoginSupabase;
