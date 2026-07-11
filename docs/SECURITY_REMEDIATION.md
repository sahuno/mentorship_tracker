# Security & Code-Review Remediation Tracker

**Purpose:** Single source of truth for the findings from the 2026-07-07 security review + code review, plus issues that surfaced while remediating them. Update this doc as items are fixed.

**Last updated:** 2026-07-11
**Reviews run:** 2026-07-07 (`/security-review` on RLS/auth surface, `/code-review high` on the working-tree diff)
**Target database:** `rlqaoecdzkrshidpljwb` ("golden-bridge-tracker-restored") — the ACTIVE restored project. NOTE the deployed Vercel frontend still points at the OLD inactive project `uedwlvucyyxjenoggpwu` (see N4).
**How fixes are applied:** `npx supabase db push` is currently UNSAFE (see N1). Migrations are applied directly via the Supabase **management API** as `postgres` (public-schema objects only) and verified against the live schema. `_09` storage is the exception — it needs manual Dashboard application (see N2).

> **Two kinds of "done":** DB/migration fixes are applied to the restored DB (live). **Code fixes live only in the working tree** — they are NOT committed or deployed, and the deployed frontend still points at the old project (N4). Users don't get code fixes until the tree is committed and the app is repointed + redeployed.

## Status legend
- ✅ DONE — applied to the live restored DB and/or fixed in the working tree and verified (struck through in lists below)
- 🔧 IN PROGRESS / NEEDS REWORK
- ⛔ OPEN — not started
- 🚫 DEFERRED / WON'T FIX

---

## Dashboard

| ID | Severity | Title | Status | Fix artifact | Where |
|----|----------|-------|--------|--------------|-------|
| Backup | — | Prod DB dump in repo, not gitignored | ✅ DONE | moved out of repo + `.gitignore` | local |
| S1 | HIGH | Privilege escalation via signup metadata | ✅ DONE | `20260620_10` | live DB |
| S2 | MEDIUM | Notification forgery to any user | ✅ DONE | `20260620_12` | live DB |
| #1 | HIGH | Receipt storage migration fails / rolls back | 🔧 NEEDS REWORK | `20260620_09` (approach invalid here) | — |
| #2 | HIGH | Participant self-milestones broken by RLS | ✅ DONE | `20260620_11` | live DB |
| #3 | HIGH | Invited managers/admins silently become participants | ✅ DONE | `20260620_10` (email-match) | live DB |
| #4 | HIGH | Manager expense delete/edit false success + bogus audit | ✅ DONE | `20260620_14` + `expenses.ts` + `FinancialOversightTab.tsx` | DB live; code in tree |
| #5 | MEDIUM | Pausing a milestone always throws (CHECK violation) | ✅ DONE | `20260620_13` + `milestones.ts` | DB live; code in tree |
| #6 | MEDIUM | 0% progress report loses its value (falsy-zero) | ✅ DONE | `mappers.ts` (`?? undefined`) | code in tree |
| #7 | MEDIUM | Audit-log failure makes a succeeded op report failure | ✅ DONE | `audit.ts` (log-and-continue) | code in tree |
| #8 | MEDIUM | Saving during receipt OCR silently drops the receipt | ✅ DONE | `AddExpenseModal.tsx` | code in tree |
| #9 | MEDIUM | Seed-admin migration non-idempotent, re-opens admin invite | ✅ DONE | `20251130_04` (idempotent); live checked clean | file + live check |
| #10 | LOW/MED | Login routes to wrong dashboard from invite role | ✅ DONE | `LoginSupabase.tsx` | code in tree |
| S3 | LOW | `find_user_by_email` leaks role | 🚫 DEFERRED | below confidence bar | — |
| Cleanup | — | N+1 queries, duplication, dead weight (see below) | ⛔ OPEN | — | — |
| N1 | HIGH | Migration ledger diverged → `db push` unsafe | ⛔ OPEN | reconcile ledger | — |
| N2 | HIGH | Storage-policy privilege blocks `_09` on this project | ⛔ OPEN | Dashboard / storage-admin | — |
| N3 | MED | Restored DB password unavailable + CLI login-role broken | ⛔ OPEN | needs user/password | — |
| N4 | HIGH | Vercel frontend points at OLD inactive project; code fixes undeployed | ⛔ OPEN | env realignment + redeploy | — |
| N5 | LOW | Direct API fixes not recorded in migration ledger | ⛔ OPEN (accepted) | idempotent | — |
| N6 | MEDIUM | Leftover test admin account on live DB | ⛔ OPEN | delete test admin | — |

---

## Part 1 — Security review (RLS/auth surface)

- [x] ~~**S1 — HIGH · Privilege escalation to admin via signup metadata.**~~ **FIXED** by `20260620_10` (LIVE) — defaults to `participant`, ignores metadata role, elevates only via pending invite matched on `LOWER(email)`. Verified live.
- [x] ~~**S2 — MEDIUM · Any authenticated user can forge notifications to anyone.**~~ **FIXED** by `20260620_12` (LIVE) — direct-insert policy tightened to `user_id = auth.uid()`; RPC enforces a type allowlist + target authorization (self / admin / manager↔participant in a shared active program). Verified live.
- 🚫 **S3 — LOW · `find_user_by_email` returns role.** DEFERRED — pre-existing disclosure it builds on; didn't clear the confidence bar.

---

## Part 2 — Code review (diff + new files)

- [ ] 🔧 **#1 — HIGH · Receipt storage migration fails and rolls back.** `20260620_09`. NEEDS REWORK — the `SET ROLE supabase_storage_admin` approach does NOT work on this project (postgres is not a member; see N2). `receipts` bucket still absent. Rework: create bucket in SQL; create storage policies via Dashboard → Storage → Policies.
- [x] ~~**#2 — HIGH · Participant self-milestones broken by RLS.**~~ **FIXED** by `20260620_11` (LIVE) — `milestones.created_by DEFAULT auth.uid()` + participant policies; 5 rows backfilled.
- [x] ~~**#3 — HIGH · Invited managers/admins silently become participants.**~~ **FIXED** by `20260620_10` (LIVE) — email-matched invites; inert signup `role` metadata also removed from `auth.ts` (Agent C).
- [x] ~~**#4 — HIGH · Manager expense delete/edit false success + bogus audit + dropped fields.**~~ **FIXED**: (a) `20260620_14` (LIVE) adds manager INSERT/UPDATE/DELETE RLS on `expenses` scoped via `can_manage_program(cycle→program)`; (b) `expenses.ts` `deleteExpense`/`updateExpense` now `.select()` and throw if 0 rows affected (blocked writes fail loudly); (c) `FinancialOversightTab.tsx` handlers wrapped in try/catch, success/audit only after real success, and add/edit routed through `mappers.ts` so `category`/`receipt_url` persist. Verified: manager write RLS functional in ephemeral PG (owning-manager delete affects 1 row, outsider 0). Code in tree.
- [x] ~~**#5 — MEDIUM · Pausing a milestone always throws.**~~ **FIXED** by `20260620_13` (LIVE — CHECK now includes `'paused'`, verified) + `milestones.ts` `updateMilestoneAssignment` reordered so the status update runs before the metadata update (no half-applied state on the valid path). Residual: full cross-table atomicity would need a SECURITY DEFINER RPC (noted, not blocking).
- [x] ~~**#6 — MEDIUM · 0% progress report loses its value.**~~ **FIXED** in `mappers.ts` — `completion_percentage ?? undefined` preserves a valid `0`. Code in tree.
- [x] ~~**#7 — MEDIUM · Audit-log failure makes a succeeded op report failure.**~~ **FIXED** in `audit.ts` — `logAuditEvent` catches, `console.warn`s, returns `null` instead of throwing (log-and-continue). No call site consumes the return, so no call-site edits needed. Code in tree.
- [x] ~~**#8 — MEDIUM · Saving during receipt OCR silently drops the receipt.**~~ **FIXED** in `AddExpenseModal.tsx` — submit disabled while OCR/upload in flight; the prior receipt URL is retained until the new upload succeeds (edit no longer loses the old receipt on a failed replacement). Code in tree.
- [x] ~~**#9 — MEDIUM · Seed-admin migration non-idempotent, re-opens admin invite.**~~ **FIXED** — `20251130_04` rewritten as `INSERT … WHERE NOT EXISTS (pending/accepted admin invite)`; preserves invite_code, never reopens an accepted invite. Live check: no stray admin invite for the seed email exists (clean).
- [x] ~~**#10 — LOW/MEDIUM · Login routes to wrong dashboard from invite role.**~~ **FIXED** in `LoginSupabase.tsx` — sign-in path routes by the real profile role, not `inviteDetails.target_role`; App.tsx race is harmless because both `setUser` paths now carry the same correct role. Code in tree.

### Cleanup themes (flagged by finders, cut by the 10-item cap) — DEFERRED to a follow-up round
- [ ] ⛔ **N+1 queries:** `finance.ts` one query per participant; `Dashboard.tsx` one per cycle — both refetch fully after every mutation.
- [ ] ⛔ **Duplicate milestone rows** created per participant instead of using the assignment junction table.
- [ ] ⛔ **Duplication:** expense→DB row mapping (now partly addressed in FinancialOversightTab via #4, but Dashboard.tsx still hand-maps); password validation triplicated; `normalizeReceiptItem` duplicated across the two `receiptOcr` modules; ~55 lines of Supabase boilerplate duplicated across the two `api/` handlers.
- [ ] ⛔ **Dead weight:** write-only `useLocalStorage` mirrors in `Dashboard.tsx`; legacy localStorage fallback branches in the tabs.
- [ ] ⛔ **Dev proxy config:** `vite.plugins/receiptApiProxy.ts` reads `process.env` but `vite.config.ts` no longer loads `.env.local` into it → receipt uploads 500 in `npm run dev`.

---

## Cross-cutting issues that surfaced during remediation (NEW — not in the original reviews)

- [ ] ⛔ **N1 — HIGH · Migration ledger diverged from schema → `db push` is UNSAFE.** `schema_migrations` records only 4 migrations (through `20251029214441`); the schema already has objects from ~all later migrations (applied manually). `db push` would replay them and fail/corrupt. Fix: reconcile via `supabase migration repair --status applied <version>` for each already-applied migration before any push. Blocked by N3.
- [ ] ⛔ **N2 — HIGH · Storage-policy privilege blocks `_09` on this project.** `postgres` is NOT a member of `supabase_storage_admin`; the admin API runs as non-superuser `postgres`. Create receipt storage policies via Dashboard → Storage → Policies (or a `supabase_admin` connection). Ties to #1.
- [ ] ⛔ **N3 — MEDIUM · Restored DB password unavailable + CLI login-role broken.** Blocks `supabase db push`/`migration list/repair`/psql. Management-API-as-postgres is the working path for public-schema DDL.
- [ ] ⛔ **N4 — HIGH · Vercel frontend points at OLD inactive project; code fixes undeployed.** Deployed bundle (`b5b2a79`) has `uedwlvucyyxjenoggpwu` (INACTIVE) baked in; local + fixes target `rlqaoecdzkrshidpljwb`. All code fixes (#4 client, #6, #7, #8, #10) sit in the working tree, uncommitted/undeployed. Fix: pick the canonical project, realign Vercel + `.env.local`, commit, redeploy.
- [ ] ⛔ **N5 — LOW (accepted) · Direct API fixes not recorded in the ledger.** `_10/_11/_12/_13/_14` applied via management API, absent from `schema_migrations`. All idempotent. Fold into N1 reconciliation.
- [ ] ⛔ **N6 — MEDIUM · Leftover test admin account on live DB.** `browser-admin-20260620154643@example.com` has role `admin` on the restored DB (created during 2026-06-20 browser testing, possibly via the then-open S1 hole). Recommend deleting this account (auth user + profile). Not auto-deleted (prod account deletion). Verify it's not needed, then remove.

---

## Application log (what's actually on the restored DB)

| Date | Migration / action | Method | Result |
|------|--------------------|--------|--------|
| 2026-07-07 | backup file removed from repo + `.gitignore` hardened | local | ✅ |
| 2026-07-07 | `20260620_10` (secure `handle_new_user`) | mgmt API as postgres | ✅ verified (S1 + #3) |
| 2026-07-07 | `20260620_11` (`milestones.created_by` + participant policies) | mgmt API as postgres | ✅ verified (#2) |
| 2026-07-07 | `20260620_12` (notification forgery) | mgmt API as postgres | ✅ verified (S2) |
| 2026-07-11 | `20260620_13` (allow `'paused'` status) | mgmt API as postgres | ✅ verified (#5) |
| 2026-07-11 | `20260620_14` (manager expense write policies) | mgmt API as postgres | ✅ verified (#4) |
| 2026-07-11 | read-only check: no stray admin invite for seed email | mgmt API as postgres | ✅ clean (#9) |

Code-only fixes (#4 client, #6, #7, #8, #10) are in the working tree, verified by `tsc --noEmit` (exit 0), NOT yet committed or deployed (see N4).

---

## Suggested next steps (in order)
1. **N6** — remove the leftover test admin account (quick, security hygiene).
2. **Commit** the working-tree code fixes in logical chunks (they're verified but uncommitted).
3. **#1 / N2** — rework `_09` into a Dashboard-ready storage policy script.
4. **Cleanup themes** — N+1 queries, duplication, dead weight, dev proxy (follow-up agent round).
5. **N1 / N3 / N5** — reconcile the migration ledger (needs the DB password) so `db push` becomes usable again.
6. **N4** — realign environments, repoint + redeploy the app so the code fixes reach users.
