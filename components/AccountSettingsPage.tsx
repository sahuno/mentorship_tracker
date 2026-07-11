import React, { useEffect, useState } from 'react';
import { User } from '../types';
import { getUserProfileSecure, updatePassword, updateProfile } from '../src/lib/auth';

interface AccountSettingsPageProps {
  user: User;
  onBack: () => void;
  onLogout: () => void;
  onProfileUpdated: (user: Partial<User>) => void;
}

const AccountSettingsPage: React.FC<AccountSettingsPageProps> = ({
  user,
  onBack,
  onLogout,
  onProfileUpdated,
}) => {
  const [name, setName] = useState(user.name);
  const [email, setEmail] = useState(user.email);
  const [phone, setPhone] = useState(user.phone || '');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [profileError, setProfileError] = useState('');
  const [profileSuccess, setProfileSuccess] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [passwordSuccess, setPasswordSuccess] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [isProfileSaving, setIsProfileSaving] = useState(false);
  const [emailChangePending, setEmailChangePending] = useState(false);

  useEffect(() => {
    let isMounted = true;

    const loadProfile = async () => {
      try {
        const profile = await getUserProfileSecure();

        if (!isMounted || !profile) return;

        setName(profile.name || user.name);
        setEmail(profile.email || user.email);
        setPhone(profile.phone || '');
      } catch (loadError) {
        console.error('Failed to load account profile:', loadError);
      }
    };

    loadProfile();

    return () => {
      isMounted = false;
    };
  }, [user.email, user.name]);

  const handleProfileUpdate = async (event: React.FormEvent) => {
    event.preventDefault();
    setProfileError('');
    setProfileSuccess('');
    setEmailChangePending(false);

    try {
      setIsProfileSaving(true);
      const result = await updateProfile({
        name,
        email,
        phone,
      });

      onProfileUpdated({
        name: result.profile?.name || name,
        phone: result.profile?.phone || phone || undefined,
      });

      if (result.emailChangeRequested) {
        setEmailChangePending(true);
        setProfileSuccess('Profile updated. A confirmation email was sent for your new email address.');
      } else {
        setProfileSuccess('Profile updated successfully.');
      }
    } catch (profileError) {
      setProfileError(profileError instanceof Error ? profileError.message : 'Failed to update profile');
    } finally {
      setIsProfileSaving(false);
    }
  };

  const handlePasswordUpdate = async (event: React.FormEvent) => {
    event.preventDefault();
    setPasswordError('');
    setPasswordSuccess('');

    if (newPassword.length < 6) {
      setPasswordError('Password must be at least 6 characters.');
      return;
    }

    if (newPassword !== confirmPassword) {
      setPasswordError('Passwords do not match.');
      return;
    }

    try {
      setIsSaving(true);
      await updatePassword(newPassword);
      setPasswordSuccess('Password updated successfully.');
      setNewPassword('');
      setConfirmPassword('');
    } catch (updateError) {
      setPasswordError(updateError instanceof Error ? updateError.message : 'Failed to update password');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="border-b border-gray-200 bg-white shadow-sm">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-4 sm:px-6 lg:px-8">
          <div>
            <p className="text-sm text-gray-500">Account settings</p>
            <h1 className="text-2xl font-bold text-gray-900">Manage your profile</h1>
          </div>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onBack}
              className="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              Back
            </button>
            <button
              type="button"
              onClick={onLogout}
              className="rounded-md border border-red-200 bg-red-50 px-4 py-2 text-sm font-medium text-red-700 hover:bg-red-100"
            >
              Logout
            </button>
          </div>
        </div>
      </div>

      <main className="mx-auto grid max-w-5xl gap-6 px-4 py-8 sm:px-6 lg:px-8">
        <section className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-gray-900">Account summary</h2>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <div>
              <p className="text-xs uppercase tracking-wide text-gray-500">Name</p>
              <p className="mt-1 text-sm font-medium text-gray-900">{name}</p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-wide text-gray-500">Email</p>
              <p className="mt-1 text-sm font-medium text-gray-900 break-all">{email}</p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-wide text-gray-500">Phone</p>
              <p className="mt-1 text-sm font-medium text-gray-900">{phone || 'Not set'}</p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-wide text-gray-500">Role</p>
              <p className="mt-1 text-sm font-medium text-gray-900">{user.role || 'participant'}</p>
            </div>
          </div>
        </section>

        <section className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-gray-900">Profile details</h2>
          <p className="mt-1 text-sm text-gray-600">
            Edit your name, email, and phone number.
          </p>

          <form className="mt-6 space-y-4" onSubmit={handleProfileUpdate}>
            <div>
              <label htmlFor="name" className="block text-sm font-medium text-gray-700">
                Full name
              </label>
              <input
                id="name"
                type="text"
                autoComplete="name"
                value={name}
                onChange={(event) => setName(event.target.value)}
                className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-indigo-500"
                placeholder="Your name"
              />
            </div>

            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700">
                Email address
              </label>
              <input
                id="email"
                type="email"
                autoComplete="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-indigo-500"
                placeholder="you@example.com"
              />
              <p className="mt-1 text-xs text-gray-500">
                Changing your email sends a confirmation message. Your sign-in email updates after you confirm it.
              </p>
            </div>

            <div>
              <label htmlFor="phone" className="block text-sm font-medium text-gray-700">
                Phone number
              </label>
              <input
                id="phone"
                type="tel"
                autoComplete="tel"
                value={phone}
                onChange={(event) => setPhone(event.target.value)}
                className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-indigo-500"
                placeholder="+1 (555) 123-4567"
              />
            </div>

            {emailChangePending && (
              <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
                Email confirmation is pending. Keep using your current login until you confirm the new address.
              </div>
            )}

            {profileError && (
              <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
                {profileError}
              </div>
            )}

            {profileSuccess && !isProfileSaving && (
              <div className="rounded-md border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-800">
                {profileSuccess}
              </div>
            )}

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={onBack}
                className="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                Done
              </button>
              <button
                type="submit"
                disabled={isProfileSaving}
                className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isProfileSaving ? 'Saving...' : 'Save profile'}
              </button>
            </div>
          </form>
        </section>

        <section className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-gray-900">Change password</h2>
          <p className="mt-1 text-sm text-gray-600">
            Update the password for this account directly in the app.
          </p>

          <form className="mt-6 space-y-4" onSubmit={handlePasswordUpdate}>
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
              />
            </div>

            {passwordError && (
              <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
                {passwordError}
              </div>
            )}

            {passwordSuccess && (
              <div className="rounded-md border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-800">
                {passwordSuccess}
              </div>
            )}

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={onBack}
                className="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                Done
              </button>
              <button
                type="submit"
                disabled={isSaving}
                className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isSaving ? 'Saving...' : 'Update password'}
              </button>
            </div>
          </form>
        </section>
      </main>
    </div>
  );
};

export default AccountSettingsPage;
