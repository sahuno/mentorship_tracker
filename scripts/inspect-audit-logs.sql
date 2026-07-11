-- Inspect recent audit events as an admin or database owner.
-- Usage:
--   psql "$DATABASE_URL" -f scripts/inspect-audit-logs.sql

SELECT
  audit_logs.created_at,
  actor.email AS actor_email,
  audit_logs.action,
  target.email AS target_email,
  programs.name AS program_name,
  audit_logs.metadata
FROM audit_logs
LEFT JOIN profiles AS actor ON actor.id = audit_logs.actor_id
LEFT JOIN profiles AS target ON target.id = audit_logs.target_user_id
LEFT JOIN programs ON programs.id = audit_logs.program_id
ORDER BY audit_logs.created_at DESC
LIMIT 100;
