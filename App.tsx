
import React, { useState, useEffect } from 'react';
import Login from './components/LoginSupabase';
import Dashboard from './components/Dashboard';
import ProgramManagerDashboard from './components/ProgramManagerDashboard';
import { User, UserRole } from './types';
import { getUser, getUserProfileSecure, signOut, onAuthStateChange } from './src/lib/auth';

const App: React.FC = () => {
  const [user, setUser] = useState<User | null>(null);
  const [isCheckingSession, setIsCheckingSession] = useState(true);

  // Check for existing Supabase session on mount
  useEffect(() => {
    const checkSession = async () => {
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
  }, []);

  const handleLogin = (loggedInUser: User) => {
    setUser(loggedInUser);
  };

  const handleLogout = async () => {
    try {
      await signOut();
      setUser(null);
    } catch (error) {
      console.error('Error signing out:', error);
    }
  };

  // Show loading while checking session
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
      case UserRole.PROGRAM_MANAGER:
        return <ProgramManagerDashboard user={user} onLogout={handleLogout} />;
      case UserRole.ADMIN:
        // For now, admins see the program manager dashboard with full access
        return <ProgramManagerDashboard user={user} onLogout={handleLogout} />;
      case UserRole.PARTICIPANT:
      default:
        return <Dashboard user={user} onLogout={handleLogout} />;
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 font-sans text-gray-800">
      {renderDashboard()}
    </div>
  );
};

export default App;
