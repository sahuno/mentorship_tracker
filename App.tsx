
import React, { useState, useEffect } from 'react';
import Login from './components/Login';
import Dashboard from './components/Dashboard';
import ProgramManagerDashboard from './components/ProgramManagerDashboard';
import { User, UserRole } from './types';
import UserManager from './utils/userManager';

const App: React.FC = () => {
  const [user, setUser] = useState<User | null>(null);
  const [isCheckingSession, setIsCheckingSession] = useState(true);

  // Check for existing session on mount
  useEffect(() => {
    const existingUser = UserManager.getSession();
    if (existingUser) {
      setUser(existingUser);
    }
    setIsCheckingSession(false);
  }, []);

  const handleLogin = (loggedInUser: User) => {
    setUser(loggedInUser);
  };

  const handleLogout = () => {
    UserManager.clearSession();
    setUser(null);
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
