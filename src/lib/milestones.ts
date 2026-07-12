import {
  AssignmentType,
  Milestone,
  MilestoneStatus,
  ProgressReport
} from '../../types';
import { dbMilestoneAssignmentToMilestone, milestoneFormToDbInsert, milestoneFormToDbUpdate } from './mappers';
import { supabase } from './supabase';

interface AssignmentInput {
  participantId: string;
  milestone: Omit<Milestone, 'id' | 'userId' | 'createdAt' | 'progressReports'>;
}

interface ProgressReportInput extends Omit<ProgressReport, 'id'> {}

function dbStatusFromMilestoneStatus(status: MilestoneStatus) {
  if (status === MilestoneStatus.NOT_STARTED) return 'pending';
  if (status === MilestoneStatus.COMPLETED) return 'completed';
  return status;
}

export async function getMyMilestoneAssignments(programId?: string): Promise<Milestone[]> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  let query = supabase
    .from('milestone_assignments')
    .select(`
      *,
      milestone:milestone_id (*),
      progress_reports (*)
    `)
    .eq('participant_id', user.id)
    .order('assigned_at', { ascending: false });

  if (programId) {
    query = query.eq('milestone.program_id', programId);
  }

  const { data, error } = await query;
  if (error) throw error;

  return ((data || []) as any[])
    .filter((assignment) => !programId || assignment.milestone?.program_id === programId)
    .map((assignment) => dbMilestoneAssignmentToMilestone(assignment as any));
}

export async function getProgramMilestoneAssignments(programId: string): Promise<Milestone[]> {
  const { data, error } = await supabase
    .from('milestone_assignments')
    .select(`
      *,
      milestone:milestone_id (*),
      progress_reports (*)
    `)
    .eq('milestone.program_id', programId)
    .order('assigned_at', { ascending: false });

  if (error) throw error;

  return ((data || []) as any[])
    .filter((assignment) => assignment.milestone?.program_id === programId)
    .map((assignment) => dbMilestoneAssignmentToMilestone(assignment as any));
}

export async function getParticipantMilestones(
  programId: string,
  participantId: string
): Promise<Milestone[]> {
  const { data, error } = await supabase
    .from('milestone_assignments')
    .select(`
      *,
      milestone:milestone_id (*),
      progress_reports (*)
    `)
    .eq('participant_id', participantId)
    .eq('milestone.program_id', programId)
    .order('assigned_at', { ascending: false });

  if (error) throw error;

  return ((data || []) as any[])
    .filter((assignment) => assignment.milestone?.program_id === programId)
    .map((assignment) => dbMilestoneAssignmentToMilestone(assignment as any));
}

export async function createMilestoneAssignments(
  programId: string,
  assignments: AssignmentInput[]
): Promise<Milestone[]> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');
  if (assignments.length === 0) return [];

  // Every assignment in a single call shares one milestone definition (the
  // assign modal maps the same milestone to N participants; self-create passes
  // one). Create a SINGLE milestone row and link each participant through the
  // milestone_assignments junction table, rather than duplicating the milestone
  // per participant.
  const shared = assignments[0].milestone;

  const { data: milestone, error: milestoneError } = await supabase
    .from('milestones')
    .insert(milestoneFormToDbInsert(programId, shared))
    .select()
    .single();

  if (milestoneError) throw milestoneError;

  const { data: dbAssignments, error: assignmentError } = await supabase
    .from('milestone_assignments')
    .insert(
      assignments.map((assignment) => ({
        milestone_id: milestone.id,
        participant_id: assignment.participantId,
        status: dbStatusFromMilestoneStatus(assignment.milestone.status),
        assignment_type: assignment.milestone.assignmentInfo?.assignmentType || AssignmentType.MANAGER_ASSIGNED,
        is_required: assignment.milestone.assignmentInfo?.isRequired ?? true,
        can_decline: assignment.milestone.assignmentInfo?.canDecline ?? false,
        assigned_by: user.id
      }))
    )
    .select(`
      *,
      milestone:milestone_id (*),
      progress_reports (*)
    `);

  if (assignmentError) throw assignmentError;

  return ((dbAssignments || []) as any[]).map((dbAssignment) =>
    dbMilestoneAssignmentToMilestone(dbAssignment as any)
  );
}

export async function createSelfMilestone(
  programId: string | undefined,
  milestone: Omit<Milestone, 'id' | 'userId' | 'createdAt' | 'progressReports'>
): Promise<Milestone> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');
  if (!programId) throw new Error('A program must be selected before creating milestones');

  const [created] = await createMilestoneAssignments(programId, [{
    participantId: user.id,
    milestone: {
      ...milestone,
      assignmentInfo: {
        assignedBy: user.id,
        assignedAt: new Date().toISOString(),
        assignmentType: AssignmentType.SELF_CREATED,
        isRequired: false,
        canDecline: false
      }
    }
  }]);

  return created;
}

export async function updateAssignmentStatus(
  assignmentId: string,
  status: MilestoneStatus
): Promise<void> {
  const update: Record<string, any> = { status: dbStatusFromMilestoneStatus(status) };

  if (status === MilestoneStatus.COMPLETED) {
    update.completion_date = new Date().toISOString().split('T')[0];
  }

  const { error } = await supabase
    .from('milestone_assignments')
    .update(update)
    .eq('id', assignmentId);

  if (error) throw error;
}

export async function updateMilestoneAssignment(
  assignmentId: string,
  milestone: Omit<Milestone, 'id' | 'userId' | 'createdAt' | 'progressReports'>
): Promise<void> {
  const { data: assignment, error: assignmentError } = await supabase
    .from('milestone_assignments')
    .select('milestone_id')
    .eq('id', assignmentId)
    .single();

  if (assignmentError) throw assignmentError;
  if (!assignment) throw new Error('Milestone assignment not found');

  // Perform the status update FIRST. It is the operation most likely to fail
  // (it is guarded by a DB CHECK constraint on milestone_assignments.status).
  // Doing it first means a rejected status leaves the milestone metadata
  // untouched, avoiding a half-applied "mixed state" where the milestone row
  // was updated but the status was not.
  //
  // Residual atomicity limitation: these are two separate statements against two
  // tables from the client, so they are not wrapped in a single transaction. If
  // the (rarely-failing) milestones metadata update below fails after the status
  // update succeeds, the status will have changed while the metadata did not.
  // A fully atomic fix would require a SECURITY DEFINER RPC that updates both
  // rows in one transaction.
  await updateAssignmentStatus(assignmentId, milestone.status);

  const { error: milestoneError } = await supabase
    .from('milestones')
    .update(milestoneFormToDbUpdate(milestone))
    .eq('id', assignment.milestone_id);

  if (milestoneError) throw milestoneError;
}

export async function deleteMilestoneAssignment(assignmentId: string): Promise<void> {
  const { data: assignment, error: assignmentError } = await supabase
    .from('milestone_assignments')
    .select('milestone_id')
    .eq('id', assignmentId)
    .single();

  if (assignmentError) throw assignmentError;

  const { error: deleteError } = await supabase
    .from('milestone_assignments')
    .delete()
    .eq('id', assignmentId);

  if (deleteError) throw deleteError;

  if (assignment?.milestone_id) {
    const { count, error: countError } = await supabase
      .from('milestone_assignments')
      .select('id', { count: 'exact', head: true })
      .eq('milestone_id', assignment.milestone_id);

    if (countError) throw countError;

    if ((count || 0) === 0) {
      const { error: milestoneDeleteError } = await supabase
        .from('milestones')
        .delete()
        .eq('id', assignment.milestone_id);

      if (milestoneDeleteError) throw milestoneDeleteError;
    }
  }
}

export async function respondToAssignment(
  assignmentId: string,
  accepted: boolean,
  comment: string
): Promise<void> {
  const { error } = await supabase
    .from('milestone_assignments')
    .update({
      status: accepted ? 'in_progress' : 'pending',
      decline_reason: accepted ? null : comment,
      declined_at: accepted ? null : new Date().toISOString(),
      manager_response: {
        accepted,
        comment,
        respondedAt: new Date().toISOString()
      }
    })
    .eq('id', assignmentId);

  if (error) throw error;
}

export async function createProgressReport(
  assignmentId: string,
  report: ProgressReportInput
): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const { error } = await supabase
    .from('progress_reports')
    .insert({
      assignment_id: assignmentId,
      participant_id: user.id,
      week_number: report.weekNumber,
      report_date: report.date,
      content: report.content,
      hours_spent: report.hoursSpent,
      completion_percentage: report.completionPercentage
    });

  if (error) throw error;
}

export async function addManagerFeedback(
  reportId: string,
  managerId: string,
  feedback: string
): Promise<void> {
  const { data: report, error: fetchError } = await supabase
    .from('progress_reports')
    .select('manager_feedback')
    .eq('id', reportId)
    .single();

  if (fetchError) throw fetchError;

  const existing = Array.isArray(report.manager_feedback) ? report.manager_feedback : [];

  const { error } = await supabase
    .from('progress_reports')
    .update({
      manager_feedback: [
        ...existing,
        {
          managerId,
          feedback,
          feedbackDate: new Date().toISOString()
        }
      ]
    })
    .eq('id', reportId);

  if (error) throw error;
}
