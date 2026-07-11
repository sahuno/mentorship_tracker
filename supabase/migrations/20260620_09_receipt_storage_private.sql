-- Private storage bucket for cycle-scoped receipt uploads.
--
-- SECURITY MODEL (why this migration only creates the bucket):
--   The browser NEVER accesses Supabase Storage directly. Both receipt upload
--   (api/receipt-ocr.ts) and receipt viewing (api/receipts/[token].ts) go
--   through edge functions that use the SERVICE-ROLE client (which bypasses
--   storage RLS) and perform their own authorization: authenticate the JWT,
--   then verify the caller is the cycle's participant, an admin, or the
--   program's manager. The security boundary is therefore:
--     (1) this bucket being PRIVATE (public = false), and
--     (2) the service-role edge functions doing per-request authorization.
--
--   RLS policies on storage.objects only govern DIRECT client access, which
--   this app does not use, so they are DEFENSE-IN-DEPTH, not the gate.
--
-- WHY THE storage.objects POLICIES ARE NOT IN THIS MIGRATION:
--   storage.objects and storage.buckets are owned by supabase_storage_admin.
--   On hosted Supabase, `supabase db push` and the management API run as the
--   `postgres` role, which is NOT a member of supabase_storage_admin, so
--   `ALTER TABLE storage.objects` / `CREATE POLICY ON storage.objects` fail
--   with 42501 (must be owner) and roll back the whole migration. postgres CAN
--   insert/update storage.buckets, so bucket setup lives here (db-push-safe),
--   while the optional direct-client RLS policies live in
--   scripts/storage_receipts_policies.sql to be run from the Dashboard SQL
--   editor (which runs as a privileged role). See docs/SECURITY_REMEDIATION.md
--   (#1 / N2).
--
-- Idempotent: safe to re-run.

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'receipts',
  'receipts',
  false,
  10485760, -- 10 MB, matches MAX_RECEIPT_FILE_SIZE_BYTES in src/lib/receiptOcrShared.ts
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
ON CONFLICT (id) DO UPDATE
SET
  name = EXCLUDED.name,
  public = false,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;
