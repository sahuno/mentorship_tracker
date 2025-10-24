
import React, { useState, useEffect } from 'react';
import { User, UserRole } from '../types';
import UserManager from '../utils/userManager';

interface LoginProps {
  onLogin: (user: User) => void;
}

const Login: React.FC<LoginProps> = ({ onLogin }) => {
  const [isSignUp, setIsSignUp] = useState(false);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [role, setRole] = useState<UserRole>(UserRole.PARTICIPANT);
  const [accessCode, setAccessCode] = useState(''); // For manager/admin roles
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  // Run migration on component mount
  useEffect(() => {
    UserManager.migrateExistingUsers();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
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

        const newUser = await UserManager.createUser(name, email, password, role);
        UserManager.saveSession(newUser);
        UserManager.migrateExistingCycles(newUser.id);
        onLogin(newUser);
      } else {
        // Sign in flow
        const user = await UserManager.authenticateUser(email, password);
        if (!user) {
          throw new Error('Invalid email or password');
        }
        UserManager.saveSession(user);
        onLogin(user);
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
    setName('');
    setEmail('');
    setPassword('');
    setConfirmPassword('');
    setRole(UserRole.PARTICIPANT);
    setAccessCode('');
  };

  return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="w-full max-w-md p-8 space-y-8 bg-white rounded-lg shadow-lg">
        <div>
          <h1 className="text-3xl font-extrabold text-center text-gray-900">
            Golden Bridge Women
          </h1>
          <p className="mt-2 text-center text-sm text-gray-600">
            {isSignUp ? 'Create your account' : 'Sign in to your spending tracker'}
          </p>
        </div>
        <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
          <div className="space-y-4">
            {isSignUp && (
              <div>
                <input
                  id="name"
                  name="name"
                  type="text"
                  autoComplete="name"
                  required
                  className="appearance-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 focus:z-10 sm:text-sm"
                  placeholder="Full name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </div>
            )}
            <div>
              <input
                id="email-address"
                name="email"
                type="email"
                autoComplete="email"
                required
                className="appearance-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 focus:z-10 sm:text-sm"
                placeholder="Email address"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <div>
              <input
                id="password"
                name="password"
                type="password"
                autoComplete={isSignUp ? 'new-password' : 'current-password'}
                required
                className="appearance-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 focus:z-10 sm:text-sm"
                placeholder={isSignUp ? 'Password (min. 6 characters)' : 'Password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
            {isSignUp && (
              <>
                <div>
                  <input
                    id="confirm-password"
                    name="confirm-password"
                    type="password"
                    autoComplete="new-password"
                    required
                    className="appearance-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 focus:z-10 sm:text-sm"
                    placeholder="Confirm password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                  />
                </div>

                {/* Role Selection */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Select Role
                  </label>
                  <div className="space-y-2">
                    <label className="flex items-center">
                      <input
                        type="radio"
                        name="role"
                        value={UserRole.PARTICIPANT}
                        checked={role === UserRole.PARTICIPANT}
                        onChange={(e) => setRole(e.target.value as UserRole)}
                        className="mr-2"
                      />
                      <span className="text-sm">
                        <span className="font-medium">Participant</span> - Track milestones and expenses
                      </span>
                    </label>
                    <label className="flex items-center">
                      <input
                        type="radio"
                        name="role"
                        value={UserRole.PROGRAM_MANAGER}
                        checked={role === UserRole.PROGRAM_MANAGER}
                        onChange={(e) => setRole(e.target.value as UserRole)}
                        className="mr-2"
                      />
                      <span className="text-sm">
                        <span className="font-medium">Program Manager</span> - Manage participants and programs
                      </span>
                    </label>
                    <label className="flex items-center">
                      <input
                        type="radio"
                        name="role"
                        value={UserRole.ADMIN}
                        checked={role === UserRole.ADMIN}
                        onChange={(e) => setRole(e.target.value as UserRole)}
                        className="mr-2"
                      />
                      <span className="text-sm">
                        <span className="font-medium">Admin</span> - Full system access
                      </span>
                    </label>
                  </div>
                </div>

                {/* Access Code for Manager/Admin */}
                {(role === UserRole.PROGRAM_MANAGER || role === UserRole.ADMIN) && (
                  <div>
                    <input
                      id="access-code"
                      name="access-code"
                      type="text"
                      required
                      className="appearance-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 focus:z-10 sm:text-sm"
                      placeholder={`Access code for ${role === UserRole.ADMIN ? 'Admin' : 'Program Manager'}`}
                      value={accessCode}
                      onChange={(e) => setAccessCode(e.target.value)}
                    />
                    <p className="mt-1 text-xs text-gray-500">
                      Contact administrator for access code
                    </p>
                  </div>
                )}
              </>
            )}
          </div>
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-md text-sm">
              {error}
            </div>
          )}
          <div>
            <button
              type="submit"
              disabled={isLoading}
              className="group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? 'Processing...' : (isSignUp ? 'Create Account' : 'Sign In')}
            </button>
          </div>
          <div className="text-center">
            <button
              type="button"
              onClick={toggleMode}
              className="text-sm text-indigo-600 hover:text-indigo-500"
            >
              {isSignUp ? 'Already have an account? Sign in' : "Don't have an account? Create one"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default Login;
