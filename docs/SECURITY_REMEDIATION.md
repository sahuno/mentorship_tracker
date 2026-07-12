# Security & Code-Review Remediation Tracker

**Purpose:** Single source of truth for the findings from the 2026-07-07 security review + code review, plus issues that surfaced while remediating them. Update this doc as items are fixed.

**Last updated:** 2026-07-11
**Reviews run:** 2026-07-07 (`/security-review` on RLS/auth surface, `/code-review high` on the working-tree diff)
**Target database:** `rlqaoecdzkrshidpljwb` ("golden-bridge-tracker-restored") — the canonical project. `uedwlvucyyxjenoggpwu` was DELETED by the user. **Production is LIVE on `rlqa`** at `goldenbridgespendingtracker.vercel.app` (`main` deployed, verified).
**How fixes are applied:** `npx supabase db push` is currently UNSAFE (see N1). Migrations are applied directly via the Supabase **management API** as `postgres` and verified against the live schema — including `storage.objects` policies (postgres CAN create policies; only `ALTER TABLE storage.objects` needs storage-admin ownership).

> **Status (2026-07-11): CUTOVER COMPLETE.** All security findings (S1, S2, #1–#10) and all cleanup are implemented, merged to `main`, and LIVE in production on `rlqa`. Remaining items are intentionally deferred / optional (S3 won't-fix; N1/N3/N5 migration-ledger reconciliation — non-blocking; custom SMTP).

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
| #1 | HIGH | Receipt storage migration fails / rolls back | ✅ DONE | `20260620_09` (bucket) + `scripts/storage_receipts_policies.sql` | bucket live |
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
| Cleanup | — | N+1 queries, duplication, dead weight, dev proxy | ✅ MOSTLY DONE | 5 commits | code in tree |
| Cleanup-dm | — | Duplicate milestone rows per participant (data-model) | ✅ DONE | `milestones.ts` junction refactor | LIVE |
| N1 | HIGH | Migration ledger diverged → `db push` unsafe | ✅ DONE | renamed migrations + repaired ledger | live DB |
| N2 | HIGH | Storage-policy privilege blocks `_09` on this project | ✅ RESOLVED | bucket via SQL; policies → Dashboard script (optional) | — |
| N3 | MED | Restored DB password unavailable + CLI login-role broken | ✅ DONE | password in .env.local; stale role dropped | — |
| N4 | HIGH | Vercel frontend points at OLD inactive project; code fixes undeployed | ✅ DONE | env realign + merge + prod deploy | LIVE |
| N5 | LOW | Direct API fixes not recorded in migration ledger | ✅ DONE | ledger reconciled (all 25 applied) | live DB |
| N6 | MEDIUM | Leftover test admin account on live DB | ✅ DONE | deleted user + 2 test invites | live DB |

---

## Part 1 — Security review (RLS/auth surface)

- [x] ~~**S1 — HIGH · Privilege escalation to admin via signup metadata.**~~ **FIXED** by `20260620_10` (LIVE) — defaults to `participant`, ignores metadata role, elevates only via pending invite matched on `LOWER(email)`. Verified live.
- [x] ~~**S2 — MEDIUM · Any authenticated user can forge notifications to anyone.**~~ **FIXED** by `20260620_12` (LIVE) — direct-insert policy tightened to `user_id = auth.uid()`; RPC enforces a type allowlist + target authorization (self / admin / manager↔participant in a shared active program). Verified live.
- 🚫 **S3 — LOW · `find_user_by_email` returns role.** DEFERRED — pre-existing disclosure it builds on; didn't clear the confidence bar.

---

## Part 2 — Code review (diff + new files)

- [x] ~~**#1 — HIGH · Receipt storage migration fails and rolls back.**~~ **FIXED** — reworked `20260620_09` to only create/configure the private `receipts` bucket (public=false, 10MB, image mimes), which `postgres` CAN do via `storage.buckets`; this is `db push`-safe and idempotent. Bucket created + configured LIVE and verified. The direct-client `storage.objects` RLS policies (which postgres cannot create; N2) moved to `scripts/storage_receipts_policies.sql` for optional Dashboard application — they're defense-in-depth only, since the browser never touches Storage directly (uploads/views go through service-role edge functions that authorize per-request; the bucket is private). Discovery that reframed this: the private bucket + edge functions are the real boundary, not client-side storage RLS.
- [x] ~~**#2 — HIGH · Participant self-milestones broken by RLS.**~~ **FIXED** by `20260620_11` (LIVE) — `milestones.created_by DEFAULT auth.uid()` + participant policies; 5 rows backfilled.
- [x] ~~**#3 — HIGH · Invited managers/admins silently become participants.**~~ **FIXED** by `20260620_10` (LIVE) — email-matched invites; inert signup `role` metadata also removed from `auth.ts` (Agent C).
- [x] ~~**#4 — HIGH · Manager expense delete/edit false success + bogus audit + dropped fields.**~~ **FIXED**: (a) `20260620_14` (LIVE) adds manager INSERT/UPDATE/DELETE RLS on `expenses` scoped via `can_manage_program(cycle→program)`; (b) `expenses.ts` `deleteExpense`/`updateExpense` now `.select()` and throw if 0 rows affected (blocked writes fail loudly); (c) `FinancialOversightTab.tsx` handlers wrapped in try/catch, success/audit only after real success, and add/edit routed through `mappers.ts` so `category`/`receipt_url` persist. Verified: manager write RLS functional in ephemeral PG (owning-manager delete affects 1 row, outsider 0). Code in tree.
- [x] ~~**#5 — MEDIUM · Pausing a milestone always throws.**~~ **FIXED** by `20260620_13` (LIVE — CHECK now includes `'paused'`, verified) + `milestones.ts` `updateMilestoneAssignment` reordered so the status update runs before the metadata update (no half-applied state on the valid path). Residual: full cross-table atomicity would need a SECURITY DEFINER RPC (noted, not blocking).
- [x] ~~**#6 — MEDIUM · 0% progress report loses its value.**~~ **FIXED** in `mappers.ts` — `completion_percentage ?? undefined` preserves a valid `0`. Code in tree.
- [x] ~~**#7 — MEDIUM · Audit-log failure makes a succeeded op report failure.**~~ **FIXED** in `audit.ts` — `logAuditEvent` catches, `console.warn`s, returns `null` instead of throwing (log-and-continue). No call site consumes the return, so no call-site edits needed. Code in tree.
- [x] ~~**#8 — MEDIUM · Saving during receipt OCR silently drops the receipt.**~~ **FIXED** in `AddExpenseModal.tsx` — submit disabled while OCR/upload in flight; the prior receipt URL is retained until the new upload succeeds (edit no longer loses the old receipt on a failed replacement). Code in tree.
- [x] ~~**#9 — MEDIUM · Seed-admin migration non-idempotent, re-opens admin invite.**~~ **FIXED** — `20251130_04` rewritten as `INSERT … WHERE NOT EXISTS (pending/accepted admin invite)`; preserves invite_code, never reopens an accepted invite. Live check: no stray admin invite for the seed email exists (clean).
- [x] ~~**#10 — LOW/MEDIUM · Login routes to wrong dashboard from invite role.**~~ **FIXED** in `LoginSupabase.tsx` — sign-in path routes by the real profile role, not `inviteDetails.target_role`; App.tsx race is harmless because both `setUser` paths now carry the same correct role. Code in tree.

### Cleanup themes (agent round 2026-07-11 — 3 agents, committed on `security-remediation`)
- [x] ~~**N+1 queries.**~~ **DONE** — `finance.getProgramParticipantFinancials` 1+N → 2 queries; `Dashboard.loadProgramData` 1+N → 1 (new `cycles.getMyBalanceCyclesWithExpenses`). Ordering/output shape preserved. Also routed `Dashboard.handleSaveExpense` through `mappers.expenseToDb*`.
- [x] ~~**Duplicate milestone rows** created per participant instead of using the assignment junction table.~~ **DONE (2026-07-11, later)** — `createMilestoneAssignments` now creates ONE milestone + N junction rows (bulk insert). Existing dup rows from past assignments left as-is (no retroactive de-dupe). Deployed (`6df3df2`).
- [x] ~~**Duplication.**~~ **DONE** — `normalizeReceiptItem` deduped (exported from `receiptOcrShared`); ~55 lines of edge boilerplate + the cycle-authorization logic extracted to `api/_lib/supabaseServer.ts` (`canAccessCycle`), preserving per-handler error strings/order; password validation consolidated into `auth.validateNewPassword` (used by ResetPassword + AccountSettings). **Exception:** `LoginSupabase` password validation left as-is — its messages omit trailing periods, so deduping would change user-visible text.
- [x] ~~**Dead weight (tabs).**~~ **DONE** — removed the provably-dead localStorage `else` fallback branches in Finance/Milestone/Assignments tabs (+ unused uuid imports). **CORRECTION:** the `useLocalStorage` cycle/milestone mirrors in `Dashboard.tsx` are **NOT dead** — they are read by `notificationManager.checkDeadlines` and `ReportsAnalytics`. Removing them would break deadline notifications and reports, so they were kept. (The original review's "write-only mirrors" finding was wrong.)
- [x] ~~**Dev proxy config.**~~ **DONE** — `vite.config.ts` now loads `.env.local` server-side vars into `process.env` in `serve` (dev) mode only, so dev receipt uploads work; secrets never reach the client bundle; prod build untouched.

---

## Cross-cutting issues that surfaced during remediation (NEW — not in the original reviews)

- [ ] ⛔ **N1 — HIGH · Migration ledger diverged from schema → `db push` is UNSAFE.** `schema_migrations` records only 4 migrations (through `20251029214441`); the schema already has objects from ~all later migrations (applied manually). `db push` would replay them and fail/corrupt. Fix: reconcile via `supabase migration repair --status applied <version>` for each already-applied migration before any push. Blocked by N3.
- [x] ~~**N2 — HIGH · Storage-policy privilege blocks `_09` on this project.**~~ **RESOLVED** — bucket creation works as `postgres` via `storage.buckets` (kept in `_09`). The `storage.objects` RLS policies (which need `supabase_storage_admin`) are optional defense-in-depth and live in `scripts/storage_receipts_policies.sql` for Dashboard application. Not blocking, since access is mediated by service-role edge functions.
- [ ] ⛔ **N3 — MEDIUM · Restored DB password unavailable + CLI login-role broken.** Blocks `supabase db push`/`migration list/repair`/psql. Management-API-as-postgres is the working path for public-schema DDL.
- [x] ~~**N4 — HIGH · Vercel frontend points at OLD inactive project; code fixes undeployed.**~~ **DONE (2026-07-11)** — `uedw` deleted by user; `rlqa` chosen canonical. Set all 9 Vercel env vars (prod+preview) to `rlqa` via the Vercel REST API. Set `rlqa` Auth site_url + redirect allowlist. Merged `security-remediation` → `main` (`c491be4`), pushed, production deployed and verified: `goldenbridgespendingtracker.vercel.app` serves the `rlqa`-baked bundle, edge fns return 401. Deployment protection disabled (`ssoProtection: null`) so the app is publicly reachable (was `all_except_custom_domains` — even prod had been behind Vercel SSO). Auto-confirm left ON (built-in email rate-limits signups). Smoke test (#1,#2,#4,#5, login, signup) passed on preview before promote.
- [ ] ⛔ **N5 — LOW (accepted) · Direct API fixes not recorded in the ledger.** `_10/_11/_12/_13/_14` applied via management API, absent from `schema_migrations`. All idempotent. Fold into N1 reconciliation.
- [x] ~~**N6 — MEDIUM · Leftover test admin account on live DB.**~~ **DONE (2026-07-11)** — verified the account owned nothing (0 programs/enrollments/cycles/milestones/notifications), then deleted the auth user via the Auth Admin API (profile cascaded). It had also created 2 junk pending elevated-role invites (`browser-invited-admin@example.com`, `browser-invited-manager@example.com`) which were deleted first (FK `invites.invited_by`). Only real admin `ekwame001@gmail.com` remains.

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
| 2026-07-11 | delete leftover test admin + 2 test invites | Auth Admin API + mgmt API | ✅ verified (N6) |
| 2026-07-11 | commit all working-tree work in 6 logical chunks | git branch `security-remediation` | ✅ (not merged/pushed) |
| 2026-07-11 | create + configure private `receipts` bucket (10MB, image mimes) | mgmt API (storage.buckets) | ✅ verified (#1/N2) |
| 2026-07-11 | cleanup round (N+1, dedup, dead code, dev proxy) — 5 commits | 3 agents; git branch | ✅ tsc clean |
| 2026-07-11 | set 9 Vercel env vars (prod+preview) → rlqa | Vercel REST API | ✅ |
| 2026-07-11 | rlqa Auth site_url + redirect allowlist → prod URL | mgmt API | ✅ |
| 2026-07-11 | disable Vercel deployment protection (public app) | Vercel REST API | ✅ |
| 2026-07-11 | enable auto-confirm (built-in email rate-limits) | mgmt API | ✅ (revisit w/ SMTP) |
| 2026-07-11 | preview deploy + smoke test (#1,#2,#4,#5,login) | Vercel + manual | ✅ passed |
| 2026-07-11 | delete test fixture (3 accounts + program/cycle/expense/milestone) | Auth Admin + mgmt API | ✅ |
| 2026-07-11 | **merge → main, production deploy (c491be4)** | git push → Vercel | ✅ **LIVE on rlqa, verified** |

All code fixes are merged to `main` and deployed to production (verified `tsc --noEmit` exit 0). Latest production commit: `6df3df2` (incl. milestone junction refactor).

---

## ✅ CUTOVER COMPLETE (2026-07-11) — production is LIVE on `rlqa` with all fixes + cleanup.

## Follow-ups — status 2026-07-11
- [x] ~~**Cleanup-dm** — milestone junction refactor.~~ **DONE** — `createMilestoneAssignments` now creates ONE milestone + N junction rows (bulk insert) instead of a duplicate milestone per participant. Existing dup rows left as-is. tsc-clean, deployed.
- [x] ~~**Storage defense-in-depth**~~ **DONE** — `scripts/storage_receipts_policies.sql` applied LIVE via the mgmt API (NOT the Dashboard — turns out `postgres` CAN `CREATE POLICY ON storage.objects`; the original `_09` only failed on `ALTER TABLE ... ENABLE RLS`). Fixed an ambiguous-`name` bug (42702) in the process. 3 policies (INSERT/SELECT/DELETE) now on storage.objects. **N2 correction:** only `ALTER TABLE storage.objects` needs storage-admin ownership; policies are creatable as postgres.
- [x] ~~**CLAUDE.md refresh**~~ **DONE** — root CLAUDE.md points at rlqa, Live App URL fixed, date bumped; stale `docs/CLAUDE.md` deleted.
- [~] **Delete smoke-test signup** — N/A: no account was created today; the current 8 accounts are all from the restore. NOTE: 4 leftover `browser-*@example.com` automated-test accounts (2026-06-20) + possibly `codexverify@gmail.com` remain — candidates for cleanup, not deleted (user didn't name them).

- [x] ~~**N1 / N3 / N5 — migration ledger reconciliation.**~~ **DONE (2026-07-12)** — DB password obtained (`.env.local` `SUPABASE_DB_PASSWORD`); dropped the stale `cli_login_postgres` role that broke the CLI; renamed the 21 non-standard-named migrations to unique 14-digit versions (they collided on 8-digit date prefixes — the root cause of the divergence); `migration repair --status applied` for all 21. `supabase db push --dry-run` now reports "Remote database is up to date". NOTE: CLI must connect via the **pooler** `--db-url` (the direct `db.<ref>.supabase.co` host is IPv6-only); `SUPABASE_DB_PASSWORD` lives in `.env.local`.

- [x] ~~**Custom SMTP + email verification.**~~ **DONE (2026-07-12)** — Gmail SMTP configured (`smtp.gmail.com:587`, sender `kwameaistudio@gmail.com`, app password in `.env.local`); password-reset + signup-confirmation emails verified delivering to inbox. Flipped `mailer_autoconfirm` OFF, so **signup email verification is back ON**.

### Still open / optional
_Nothing outstanding._ All review findings, cleanup, cutover, `db push` restoration, and SMTP/email verification are complete and live.
