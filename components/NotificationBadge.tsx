import React, { useEffect, useState } from 'react';
import { getUnreadNotificationCount } from '../src/lib/notifications';

interface NotificationBadgeProps {
  userId: string;
}

const NotificationBadge: React.FC<NotificationBadgeProps> = ({ userId }) => {
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    let cancelled = false;

    const updateCount = async () => {
      try {
        const count = await getUnreadNotificationCount();
        if (!cancelled) setUnreadCount(count);
      } catch {
        if (!cancelled) setUnreadCount(0);
      }
    };

    updateCount();

    const interval = setInterval(updateCount, 30000);

    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [userId]);

  if (unreadCount === 0) return null;

  return (
    <span className="inline-flex items-center justify-center px-2 py-1 text-xs font-bold leading-none text-white bg-red-500 rounded-full">
      {unreadCount > 99 ? '99+' : unreadCount}
    </span>
  );
};

export default NotificationBadge;
