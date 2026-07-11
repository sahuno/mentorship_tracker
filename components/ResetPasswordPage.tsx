import React, { useEffect, useState } from 'react';
import { getSession, resetPassword, updatePassword, validateNewPassword } from '../src/lib/auth';

const ResetPasswordPage: React.FC = () => {
  const [email, setEmail] = useState('');
  const [recoveryEmail, setRecoveryEmail] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    let isMounted = true;

    const loadSession = async () => {
      try {
        const session = await getSession();
        if (isMounted && session?.user?.email) {
          setEmail(session.user.email);
          setRecoveryEmail(session.user.email);
        }
      } catch (sessionError) {
        console.error('Unable to load reset session:', sessionError);
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    loadSession();

    return () => {
      isMounted = false;
    };
  }, []);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError('');
    setSuccess('');

    const validationError = validateNewPassword(newPassword, confirmPassword);
    if (validationError) {
      setError(validationError);
      return;
    }

    try {
      setIsSaving(true);
      await updatePassword(newPassword);
      setSuccess('Password updated successfully. You can now sign in with the new password.');
      setNewPassword('');
      setConfirmPassword('');
    } catch (updateError) {
      setError(updateError instanceof Error ? updateError.message : 'Failed to update password');
    } finally {
      setIsSaving(false);
    }
  };

  const handleResendReset = async () => {
    const targetEmail = recoveryEmail.trim();
    if (!targetEmail) {
      setError('Enter the email address to resend the reset link.');
      return;
    }

    try {
      setError('');
      setSuccess('');
      setIsSaving(true);
      await resetPassword(targetEmail);
      setSuccess(`A new password reset email was sent to ${targetEmail}.`);
    } catch (resendError) {
      const message = resendError instanceof Error ? resendError.message : 'Failed to resend reset email';
      setError(
        message.includes('rate limit')
          ? 'Password reset emails are rate-limited by Supabase unless custom SMTP is configured. Try again later or set up SendGrid/Resend.'
          : message
      );
    } finally {
      setIsSaving(false);
    }
  };

  const goToLogin = () => {
    window.location.href = '/';
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-indigo-100 via-purple-50 to-pink-100 px-4">
      <div className="w-full max-w-md rounded-lg bg-white p-8 shadow-xl">
        <div className="text-center">
          <h1 className="text-3xl font-extrabold text-gray-900">Reset your password</h1>
          <p className="mt-2 text-sm text-gray-600">
            Choose a new password for your Golden Bridge Women account.
          </p>
        </div>

        {isLoading ? (
          <div className="mt-8 rounded-md border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-700">
            Checking reset session...
          </div>
        ) : (
          <form className="mt-8 space-y-5" onSubmit={handleSubmit}>
            <div className="rounded-md border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-800">
              {email ? (
                <>
                  Resetting password for <strong>{email}</strong>
                </>
              ) : (
                <>
                  This reset link is missing session data. Request a new password reset from the sign-in page.
                </>
              )}
            </div>

            <div>
              <label htmlFor="recoveryEmail" className="block text-sm font-medium text-gray-700">
                Email for reset link
              </label>
              <input
                id="recoveryEmail"
                type="email"
                autoComplete="email"
                value={recoveryEmail}
                onChange={(event) => setRecoveryEmail(event.target.value)}
                className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-indigo-500"
                placeholder="you@example.com"
              />
            </div>

            <div>
              <label htmlFor="newPassword" className="block text-sm font-medium text-gray-700">
                New password
              </label>
              <input
                id="newPassword"
                type="password"
                autoComplete="new-password"
                value={newPassword}
                onChange={(event) => setNewPassword(event.target.value)}
                className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-indigo-500"
                placeholder="••••••••"
                disabled={!email}
              />
            </div>

            <div>
              <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700">
                Confirm new password
              </label>
              <input
                id="confirmPassword"
                type="password"
                autoComplete="new-password"
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.target.value)}
                className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-indigo-500"
                placeholder="••••••••"
                disabled={!email}
              />
            </div>

            {error && (
              <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
                {error}
              </div>
            )}

            {success && (
              <div className="rounded-md border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-800">
                {success}
              </div>
            )}

            <button
              type="submit"
              disabled={isSaving || !email}
              className="w-full rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isSaving ? 'Saving...' : 'Update password'}
            </button>

            <button
              type="button"
              onClick={handleResendReset}
              disabled={isSaving || !recoveryEmail.trim()}
              className="w-full rounded-md border border-indigo-200 bg-indigo-50 px-4 py-2 text-sm font-medium text-indigo-700 hover:bg-indigo-100 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isSaving ? 'Sending...' : 'Resend reset email'}
            </button>
            <p className="text-xs text-gray-500">
              Supabase password reset emails are rate-limited unless custom SMTP is configured.
            </p>

            <button
              type="button"
              onClick={goToLogin}
              className="w-full text-sm font-medium text-indigo-600 hover:text-indigo-500"
            >
              Back to sign in
            </button>
          </form>
        )}
      </div>
    </div>
  );
};

export default ResetPasswordPage;
