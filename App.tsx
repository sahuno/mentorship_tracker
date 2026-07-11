
import React, { useState, useEffect } from 'react';
import Login from './components/LoginSupabase';
import Dashboard from './components/Dashboard';
import ProgramManagerDashboard from './components/ProgramManagerDashboard';
import AdminDashboard from './components/AdminDashboard';
import AccountSettingsPage from './components/AccountSettingsPage';
import ResetPasswordPage from './components/ResetPasswordPage';
import { User, UserRole } from './types';
import { getUser, getUserProfileSecure, signOut, onAuthStateChange } from './src/lib/auth';

const App: React.FC = () => {
  const [user, setUser] = useState<User | null>(null);
  const [isCheckingSession, setIsCheckingSession] = useState(true);
  const [isAccountSettingsOpen, setIsAccountSettingsOpen] = useState(false);
  const isResetPasswordRoute = window.location.pathname === '/auth/reset-password';

  // Check for existing Supabase session on mount
  useEffect(() => {
    const checkSession = async () => {
      if (isResetPasswordRoute) {
        setIsCheckingSession(false);
        return;
      }

      try {
        const supabaseUser = await getUser();
        if (supabaseUser) {
          // Use secure profile fetch with session verification
          const profile = await getUserProfileSecure();
          if (profile) {
            setUser({
              id: supabaseUser.id,
              email: supabaseUser.email || '',
              name: profile.name,
              phone: profile.phone || undefined,
              role: profile.role as UserRole,
            });
          }
        }
      } catch (error) {
        console.error('Error checking session:', error);
      } finally {
        setIsCheckingSession(false);
      }
    };

    checkSession();

    // Listen for auth state changes
    if (isResetPasswordRoute) {
      return;
    }

    const { data: { subscription } } = onAuthStateChange(async (supabaseUser) => {
      if (supabaseUser) {
        // Use secure profile fetch with session verification
        try {
          const profile = await getUserProfileSecure();
          if (profile) {
            setUser({
              id: supabaseUser.id,
              email: supabaseUser.email || '',
              name: profile.name,
              phone: profile.phone || undefined,
              role: profile.role as UserRole,
            });
          }
        } catch (error) {
          console.error('Error fetching profile on auth change:', error);
        }
      } else {
        setUser(null);
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [isResetPasswordRoute]);

  const handleLogin = (loggedInUser: User) => {
    setUser(loggedInUser);
    setIsAccountSettingsOpen(false);
  };

  const handleLogout = async () => {
    try {
      await signOut();
      setUser(null);
      setIsAccountSettingsOpen(false);
    } catch (error) {
      console.error('Error signing out:', error);
    }
  };

  const handleOpenAccountSettings = () => {
    setIsAccountSettingsOpen(true);
  };

  const handleCloseAccountSettings = () => {
    setIsAccountSettingsOpen(false);
  };

  const handleProfileUpdated = (updates: Partial<User>) => {
    setUser((currentUser) => currentUser ? { ...currentUser, ...updates } : currentUser);
  };

  // Show loading while checking session
  if (isResetPasswordRoute) {
    return <ResetPasswordPage />;
  }

  if (user && isAccountSettingsOpen) {
    return (
      <AccountSettingsPage
        user={user}
        onBack={handleCloseAccountSettings}
        onLogout={handleLogout}
        onProfileUpdated={handleProfileUpdated}
      />
    );
  }

  if (isCheckingSession) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-gray-600">Loading...</div>
      </div>
    );
  }

  // Render different dashboard based on user role
  const renderDashboard = () => {
    if (!user) return <Login onLogin={handleLogin} />;

    switch (user.role) {
      case UserRole.ADMIN:
        // Admins get dedicated admin dashboard with user management
        return <AdminDashboard user={user} onLogout={handleLogout} onAccountSettings={handleOpenAccountSettings} />;
      case UserRole.PROGRAM_MANAGER:
        return (
          <ProgramManagerDashboard
            user={user}
            onLogout={handleLogout}
            onAccountSettings={handleOpenAccountSettings}
          />
        );
      case UserRole.PARTICIPANT:
      default:
        return <Dashboard user={user} onLogout={handleLogout} onAccountSettings={handleOpenAccountSettings} />;
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 font-sans text-gray-800">
      {renderDashboard()}
    </div>
  );
};

export default App;
