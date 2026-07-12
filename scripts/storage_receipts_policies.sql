-- ============================================================================
-- OPTIONAL defense-in-depth: RLS policies on storage.objects for the private
-- `receipts` bucket.
--
-- Author: Samuel Ahuno (ekwame001@gmail.com)
-- ============================================================================
--
-- HOW TO APPLY: paste this into the Supabase Dashboard → SQL Editor and run it.
--   Do NOT put these statements in a `supabase db push` migration. On hosted
--   Supabase, migrations/the management API run as `postgres`, which does not
--   own storage.objects (owned by supabase_storage_admin), so CREATE POLICY
--   here fails with 42501 (must be owner). The Dashboard SQL editor runs as a
--   privileged role and can create them.
--
-- WHY THIS IS OPTIONAL: the app never accesses Storage directly from the
--   browser. Uploads (api/receipt-ocr.ts) and views (api/receipts/[token].ts)
--   go through edge functions using the SERVICE-ROLE client (which bypasses
--   RLS) and do their own JWT + cycle-ownership authorization. The real
--   boundary is the PRIVATE bucket (set in migration 20260620_09) plus those
--   edge functions. These policies only harden against a hypothetical FUTURE
--   code path that lets the anon/authenticated client touch storage directly.
--
-- Path convention: objects are stored at  receipts/<cycle_id>/<uuid>.<ext>
--   (see api/receipt-ocr.ts). split_part(name,'/',2) = the cycle id.
-- ============================================================================

-- RLS is already enabled on storage.objects by default on Supabase.

DROP POLICY IF EXISTS "Authenticated users can upload cycle receipts" ON storage.objects;
CREATE POLICY "Authenticated users can upload cycle receipts" ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'receipts'
    AND split_part(storage.objects.name, '/', 1) = 'receipts'
    AND EXISTS (
      SELECT 1
      FROM balance_cycles bc
      JOIN profiles p ON p.id = auth.uid()
      LEFT JOIN programs pr ON pr.id = bc.program_id
      WHERE bc.id::text = split_part(storage.objects.name, '/', 2)
        AND (
          bc.participant_id = auth.uid()
          OR p.role = 'admin'
          OR pr.manager_id = auth.uid()
        )
    )
  );

DROP POLICY IF EXISTS "Users can view cycle receipts" ON storage.objects;
CREATE POLICY "Users can view cycle receipts" ON storage.objects
  FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'receipts'
    AND split_part(storage.objects.name, '/', 1) = 'receipts'
    AND (
      EXISTS (
        SELECT 1 FROM balance_cycles bc
        WHERE bc.id::text = split_part(storage.objects.name, '/', 2)
          AND bc.participant_id = auth.uid()
      )
      OR public.is_admin()
      OR EXISTS (
        SELECT 1 FROM balance_cycles bc
        JOIN programs pr ON pr.id = bc.program_id
        WHERE bc.id::text = split_part(storage.objects.name, '/', 2)
          AND pr.manager_id = auth.uid()
      )
    )
  );

DROP POLICY IF EXISTS "Users can delete cycle receipts" ON storage.objects;
CREATE POLICY "Users can delete cycle receipts" ON storage.objects
  FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'receipts'
    AND split_part(storage.objects.name, '/', 1) = 'receipts'
    AND (
      EXISTS (
        SELECT 1 FROM balance_cycles bc
        WHERE bc.id::text = split_part(storage.objects.name, '/', 2)
          AND bc.participant_id = auth.uid()
      )
      OR public.is_admin()
      OR EXISTS (
        SELECT 1 FROM balance_cycles bc
        JOIN programs pr ON pr.id = bc.program_id
        WHERE bc.id::text = split_part(storage.objects.name, '/', 2)
          AND pr.manager_id = auth.uid()
      )
    )
  );
