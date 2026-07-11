import { supabase } from './supabase';

// Audit logging is a non-critical, best-effort side effect. It must NEVER cause
// the primary operation (which has already succeeded by the time this is called)
// to appear to fail. A failure here previously surfaced as a thrown error to the
// caller, making users think the whole operation failed and retry it -> duplicate
// records. So we swallow any RPC error, warn to the console, and return null.
export async function logAuditEvent(input: {
  action: string;
  targetUserId?: string | null;
  programId?: string | null;
  metadata?: any;
}): Promise<string | null> {
  try {
    const { data, error } = await supabase.rpc('log_audit_event', {
      p_action: input.action,
      p_target_user_id: input.targetUserId || null,
      p_program_id: input.programId || null,
      p_metadata: input.metadata || {}
    });

    if (error) {
      console.warn('logAuditEvent: failed to record audit event (non-fatal):', error);
      return null;
    }
    return data;
  } catch (err) {
    console.warn('logAuditEvent: unexpected error recording audit event (non-fatal):', err);
    return null;
  }
}

export async function getAuditLogs(limit = 100) {
  const { data, error } = await supabase
    .from('audit_logs')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) throw error;
  return data || [];
}
