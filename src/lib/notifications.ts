import { supabase } from './supabase';

export type NotificationType = 'assignment' | 'feedback' | 'deadline' | 'decline' | 'general';

export interface AppNotification {
  id: string;
  userId: string;
  type: NotificationType;
  title: string;
  message: string;
  data?: any;
  read: boolean;
  createdAt: string;
}

function mapNotification(row: any): AppNotification {
  return {
    id: row.id,
    userId: row.user_id,
    type: row.type || 'general',
    title: row.title,
    message: row.message,
    data: row.metadata || undefined,
    read: row.is_read ?? row.read ?? false,
    createdAt: row.created_at
  };
}

export async function getMyNotifications(): Promise<AppNotification[]> {
  const { data, error } = await supabase
    .from('notifications')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(100);

  if (error) throw error;
  return (data || []).map(mapNotification);
}

export async function getUnreadNotificationCount(): Promise<number> {
  const { count, error } = await supabase
    .from('notifications')
    .select('id', { count: 'exact', head: true })
    .eq('is_read', false);

  if (error) throw error;
  return count || 0;
}

export async function markNotificationRead(notificationId: string): Promise<void> {
  const { error } = await supabase
    .from('notifications')
    .update({ is_read: true, read: true })
    .eq('id', notificationId);

  if (error) throw error;
}

export async function markAllNotificationsRead(): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const { error } = await supabase
    .from('notifications')
    .update({ is_read: true, read: true })
    .eq('user_id', user.id);

  if (error) throw error;
}

export async function createNotification(input: {
  userId: string;
  type: NotificationType;
  title: string;
  message: string;
  data?: any;
}): Promise<AppNotification> {
  const { data: notificationId, error } = await supabase
    .rpc('create_notification', {
      p_user_id: input.userId,
      p_type: input.type,
      p_title: input.title,
      p_message: input.message,
      p_metadata: input.data || {}
    });

  if (error) throw error;

  return {
    id: notificationId,
    userId: input.userId,
    type: input.type,
    title: input.title,
    message: input.message,
    data: input.data,
    read: false,
    createdAt: new Date().toISOString()
  };
}

export async function notifyAssignment(input: {
  participantId: string;
  managerName: string;
  milestoneTitle: string;
  programName: string;
  assignmentId: string;
  programId: string;
  isRequired: boolean;
  canDecline: boolean;
}): Promise<void> {
  await createNotification({
    userId: input.participantId,
    type: 'assignment',
    title: 'New Milestone Assigned',
    message: `${input.managerName} assigned "${input.milestoneTitle}" in ${input.programName}. ${
      input.isRequired ? 'This is required.' : 'This is optional.'
    } ${input.canDecline ? 'You can decline this assignment with a reason.' : ''}`,
    data: {
      assignmentId: input.assignmentId,
      programId: input.programId,
      isRequired: input.isRequired,
      canDecline: input.canDecline
    }
  });
}

export async function notifyFeedback(input: {
  participantId: string;
  managerName: string;
  milestoneTitle: string;
  feedback: string;
  assignmentId: string;
  reportId: string;
}): Promise<void> {
  const preview = input.feedback.length > 100
    ? `${input.feedback.slice(0, 100)}...`
    : input.feedback;

  await createNotification({
    userId: input.participantId,
    type: 'feedback',
    title: 'Manager Feedback Received',
    message: `${input.managerName} provided feedback on "${input.milestoneTitle}": "${preview}"`,
    data: {
      assignmentId: input.assignmentId,
      reportId: input.reportId
    }
  });
}

export async function notifyDecline(input: {
  managerId: string;
  participantName: string;
  milestoneTitle: string;
  reason: string;
  assignmentId: string;
  participantId: string;
}): Promise<void> {
  await createNotification({
    userId: input.managerId,
    type: 'decline',
    title: 'Milestone Declined',
    message: `${input.participantName} declined "${input.milestoneTitle}". Reason: "${input.reason}"`,
    data: {
      assignmentId: input.assignmentId,
      participantId: input.participantId,
      reason: input.reason
    }
  });
}
