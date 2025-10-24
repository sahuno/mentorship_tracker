import { v4 as uuidv4 } from 'uuid';

export interface Notification {
  id: string;
  userId: string;
  type: 'assignment' | 'feedback' | 'deadline' | 'decline' | 'general';
  title: string;
  message: string;
  data?: any; // Additional data like milestoneId, programId, etc.
  read: boolean;
  createdAt: string;
}

const NOTIFICATIONS_KEY_PREFIX = 'gbw_notifications_';

export class NotificationManager {
  // Get all notifications for a user
  static getNotifications(userId: string): Notification[] {
    const key = `${NOTIFICATIONS_KEY_PREFIX}${userId}`;
    const notificationsJson = localStorage.getItem(key);
    return notificationsJson ? JSON.parse(notificationsJson) : [];
  }

  // Save notifications for a user
  private static saveNotifications(userId: string, notifications: Notification[]): void {
    const key = `${NOTIFICATIONS_KEY_PREFIX}${userId}`;
    localStorage.setItem(key, JSON.stringify(notifications));
  }

  // Create a new notification
  static createNotification(
    userId: string,
    type: Notification['type'],
    title: string,
    message: string,
    data?: any
  ): Notification {
    const notification: Notification = {
      id: uuidv4(),
      userId,
      type,
      title,
      message,
      data,
      read: false,
      createdAt: new Date().toISOString()
    };

    const notifications = this.getNotifications(userId);
    notifications.unshift(notification); // Add to beginning

    // Keep only last 100 notifications
    if (notifications.length > 100) {
      notifications.splice(100);
    }

    this.saveNotifications(userId, notifications);
    return notification;
  }

  // Mark notification as read
  static markAsRead(userId: string, notificationId: string): void {
    const notifications = this.getNotifications(userId);
    const notification = notifications.find(n => n.id === notificationId);

    if (notification) {
      notification.read = true;
      this.saveNotifications(userId, notifications);
    }
  }

  // Mark all notifications as read
  static markAllAsRead(userId: string): void {
    const notifications = this.getNotifications(userId);
    notifications.forEach(n => n.read = true);
    this.saveNotifications(userId, notifications);
  }

  // Get unread count
  static getUnreadCount(userId: string): number {
    const notifications = this.getNotifications(userId);
    return notifications.filter(n => !n.read).length;
  }

  // Delete a notification
  static deleteNotification(userId: string, notificationId: string): void {
    const notifications = this.getNotifications(userId);
    const filtered = notifications.filter(n => n.id !== notificationId);
    this.saveNotifications(userId, filtered);
  }

  // Clear all notifications for a user
  static clearNotifications(userId: string): void {
    const key = `${NOTIFICATIONS_KEY_PREFIX}${userId}`;
    localStorage.removeItem(key);
  }

  // Create assignment notification
  static notifyAssignment(
    participantId: string,
    managerName: string,
    milestoneTitle: string,
    programName: string,
    milestoneId: string,
    programId: string,
    isRequired: boolean,
    canDecline: boolean
  ): void {
    const title = 'New Milestone Assigned';
    const message = `${managerName} has assigned you "${milestoneTitle}" in ${programName}. ${
      isRequired ? 'This is a required milestone.' : 'This is an optional milestone.'
    } ${canDecline ? 'You can decline this assignment with a reason.' : ''}`;

    this.createNotification(participantId, 'assignment', title, message, {
      milestoneId,
      programId,
      isRequired,
      canDecline
    });
  }

  // Create feedback notification
  static notifyFeedback(
    participantId: string,
    managerName: string,
    milestoneTitle: string,
    feedbackPreview: string,
    milestoneId: string,
    reportId: string
  ): void {
    const title = 'Manager Feedback Received';
    const message = `${managerName} provided feedback on your progress report for "${milestoneTitle}": "${feedbackPreview.substring(0, 100)}${feedbackPreview.length > 100 ? '...' : ''}"`;

    this.createNotification(participantId, 'feedback', title, message, {
      milestoneId,
      reportId
    });
  }

  // Create deadline notification
  static notifyDeadline(
    participantId: string,
    milestoneTitle: string,
    daysRemaining: number,
    milestoneId: string
  ): void {
    const title = 'Milestone Deadline Approaching';
    const message = `"${milestoneTitle}" is due in ${daysRemaining} day${daysRemaining !== 1 ? 's' : ''}. Please ensure you complete it on time.`;

    this.createNotification(participantId, 'deadline', title, message, {
      milestoneId,
      daysRemaining
    });
  }

  // Create decline notification for manager
  static notifyDecline(
    managerId: string,
    participantName: string,
    milestoneTitle: string,
    reason: string,
    milestoneId: string,
    participantId: string
  ): void {
    const title = 'Milestone Declined';
    const message = `${participantName} has declined the milestone "${milestoneTitle}". Reason: "${reason}"`;

    this.createNotification(managerId, 'decline', title, message, {
      milestoneId,
      participantId,
      reason
    });
  }

  // Check for approaching deadlines and create notifications
  static checkDeadlines(userId: string): void {
    const milestoneKey = `gbw_milestones_${userId}`;
    const milestonesData = localStorage.getItem(milestoneKey);

    if (!milestonesData) return;

    const milestones = JSON.parse(milestonesData);
    const now = new Date();
    const notifiedKey = `gbw_notified_deadlines_${userId}`;
    const notifiedData = localStorage.getItem(notifiedKey);
    const notified = notifiedData ? JSON.parse(notifiedData) : {};

    milestones.forEach((milestone: any) => {
      if (milestone.status === 'completed') return;

      const endDate = new Date(milestone.endDate);
      const daysRemaining = Math.ceil((endDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

      // Notify at 7 days, 3 days, and 1 day before deadline
      const notificationDays = [7, 3, 1];

      if (notificationDays.includes(daysRemaining)) {
        const notificationKey = `${milestone.id}_${daysRemaining}`;

        if (!notified[notificationKey]) {
          this.notifyDeadline(userId, milestone.title, daysRemaining, milestone.id);
          notified[notificationKey] = true;
        }
      }
    });

    localStorage.setItem(notifiedKey, JSON.stringify(notified));
  }
}

export default NotificationManager;