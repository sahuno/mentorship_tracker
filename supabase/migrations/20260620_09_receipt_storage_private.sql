-- Private storage bucket and access policies for cycle-scoped receipt uploads.
--
-- storage.objects and storage.buckets are owned by supabase_storage_admin, not
-- postgres. `supabase db push` connects as postgres, which cannot ALTER or add
-- policies to those tables directly and fails with:
--   ERROR: 42501: must be owner of table objects
-- On hosted Supabase the postgres role is a member of supabase_storage_admin,
-- so we SET ROLE to it for the storage DDL, then RESET. This is the supported
-- way to manage storage RLS from a migration.

SET ROLE supabase_storage_admin;

INSERT INTO storage.buckets (id, name, public)
VALUES ('receipts', 'receipts', false)
ON CONFLICT (id) DO UPDATE
SET
  name = EXCLUDED.name,
  public = false;

-- RLS is enabled on storage.objects by default; kept for explicitness. Safe as
-- the storage-admin owner (would raise must-be-owner as postgres).
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can upload cycle receipts" ON storage.objects;
DROP POLICY IF EXISTS "Users can view cycle receipts" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete cycle receipts" ON storage.objects;

CREATE POLICY "Authenticated users can upload cycle receipts" ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'receipts'
    AND split_part(name, '/', 1) = 'receipts'
    AND EXISTS (
      SELECT 1
      FROM balance_cycles bc
      JOIN profiles p ON p.id = auth.uid()
      LEFT JOIN programs pr ON pr.id = bc.program_id
      WHERE bc.id::text = split_part(name, '/', 2)
        AND (
          bc.participant_id = auth.uid()
          OR p.role = 'admin'
          OR pr.manager_id = auth.uid()
        )
    )
  );

CREATE POLICY "Users can view cycle receipts" ON storage.objects
  FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'receipts'
    AND split_part(name, '/', 1) = 'receipts'
    AND (
      EXISTS (
        SELECT 1
        FROM balance_cycles bc
        WHERE bc.id::text = split_part(name, '/', 2)
          AND bc.participant_id = auth.uid()
      )
      OR public.is_admin()
      OR EXISTS (
        SELECT 1
        FROM balance_cycles bc
        JOIN programs pr ON pr.id = bc.program_id
        WHERE bc.id::text = split_part(name, '/', 2)
          AND pr.manager_id = auth.uid()
      )
    )
  );

CREATE POLICY "Users can delete cycle receipts" ON storage.objects
  FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'receipts'
    AND split_part(name, '/', 1) = 'receipts'
    AND (
      EXISTS (
        SELECT 1
        FROM balance_cycles bc
        WHERE bc.id::text = split_part(name, '/', 2)
          AND bc.participant_id = auth.uid()
      )
      OR public.is_admin()
      OR EXISTS (
        SELECT 1
        FROM balance_cycles bc
        JOIN programs pr ON pr.id = bc.program_id
        WHERE bc.id::text = split_part(name, '/', 2)
          AND pr.manager_id = auth.uid()
      )
    )
  );

RESET ROLE;
