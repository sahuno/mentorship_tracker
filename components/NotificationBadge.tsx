import React, { useEffect, useState } from 'react';
import NotificationManager from '../utils/notificationManager';

interface NotificationBadgeProps {
  userId: string;
}

const NotificationBadge: React.FC<NotificationBadgeProps> = ({ userId }) => {
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    // Check for unread notifications
    const updateCount = () => {
      const count = NotificationManager.getUnreadCount(userId);
      setUnreadCount(count);
    };

    updateCount();

    // Check for updates every 30 seconds
    const interval = setInterval(updateCount, 30000);

    // Also check for approaching deadlines
    NotificationManager.checkDeadlines(userId);

    return () => clearInterval(interval);
  }, [userId]);

  if (unreadCount === 0) return null;

  return (
    <span className="inline-flex items-center justify-center px-2 py-1 text-xs font-bold leading-none text-white bg-red-500 rounded-full">
      {unreadCount > 99 ? '99+' : unreadCount}
    </span>
  );
};

export default NotificationBadge;