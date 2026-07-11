# Golden Bridge Gap Remediation Todo List

Source plan: `docs/GAP_REMEDIATION_PLAN.md`

Last updated: 2026-06-20

## How to Use This Checklist

- Work top to bottom unless a production incident forces a different order.
- Do not start new product features until Phase 1, Phase 3, and Phase 4 are complete.
- Treat each phase as complete only after its acceptance checks pass.
- Prefer one commit per phase, or smaller commits inside a phase when the change is risky.
- Before editing migrations, confirm whether the target migration has already been applied to a shared Supabase project. If yes, create a corrective migration instead of rewriting history.

## Phase 0: Stabilize Local Development

Goal: make the repo buildable and establish a repeatable verification baseline.

### Tasks

- [x] Run `npm install`.
- [x] Run `npm run build`.
- [x] Add `typecheck` script to `package.json`.
- [x] Run `npm run typecheck`.
- [x] Confirm `.env.local` is ignored.
- [x] Confirm `.env.example` lists all required client-safe environment variables.
- [x] Record current Supabase project ref and migration status.
  - Local Supabase project id: `golden_bridge_spending_tracker`.
  - Local migration list includes corrective migration `20260620_01_fix_invite_security_and_acceptance.sql`.
- [x] Review existing uncommitted migration edits:
  - [x] `supabase/migrations/20251130_03_role_invite_policies.sql`
  - [x] `supabase/migrations/20251130_04_seed_initial_admin.sql`
- [x] Decide whether those migration edits should be kept, replaced, or moved into a new corrective migration.

### Acceptance Checks

- [x] `npm install` succeeds.
- [x] `npm run build` succeeds, or build failures are documented with file/error references.
- [x] `npm run typecheck` exists.
- [x] `npm run typecheck` succeeds, or type failures are documented with file/error references.
- [x] `git status --short` is understood before implementation begins.

### Suggested Commit

```bash
git commit -m "chore: establish build and typecheck baseline"
```

## Phase 1: Fix Invite Security and Signup Correctness

Goal: make auth, profile creation, role invites, and program invites reliable before migrating more data.

### Database Tasks

- [x] Fix the `invites.updated_at` mismatch.
  - [x] Option A not used: add `updated_at TIMESTAMPTZ DEFAULT NOW()` to `invites`.
  - [x] Or choose Option B: remove `updated_at = NOW()` from invite trigger logic.
- [x] Option A not used, so no `updated_at` trigger is needed for `invites`.
- [x] Create a safe `get_invite_by_code(p_invite_code text)` RPC.
- [x] Remove or replace public direct SELECT access on `invites`.
- [x] Confirm role-only invites can use `program_id = NULL`.
- [x] Confirm participant program invites normally require a valid `program_id`.
- [x] Make `accept_invite` idempotent for existing enrollments.
- [x] Ensure invite acceptance sets:
  - [x] `status = 'accepted'`
  - [x] `accepted_at`
  - [x] `accepted_by`
- [x] Add SQL verification for invite signup cases.

### Frontend Tasks

- [x] Update `src/lib/programs.ts` `getInviteDetails()` to call `get_invite_by_code` RPC.
- [x] Update `components/LoginSupabase.tsx` signup flow to preserve invite context after auth signup.
- [x] Call `acceptInvite()` after signup or first confirmed login for program invites.
- [x] Prevent success text from claiming enrollment until DB enrollment is confirmed.
- [x] Handle role-only invites separately from program invites.
- [x] Show a clear error when an invite is expired, already accepted, or invalid.

### Verification Tasks

- [ ] Test self-signup creates a participant profile.
- [ ] Test invited admin signup creates admin profile.
- [ ] Test invited manager signup creates program manager profile.
- [ ] Test invited participant signup creates participant profile and program enrollment.
  - 2026-06-20 browser attempt was blocked by Supabase auth validation/rate limits:
    `example.com` signup rejected as invalid, then subsequent signup attempts returned
    `email rate limit exceeded`.
- [x] Test expired invite cannot be used.
- [x] Test existing user accepting participant invite is enrolled once.
- [x] Test anonymous users cannot list all pending invites.
- [ ] Test no auth user is left without a profile after invited signup.

### Acceptance Checks

- [ ] New invited admin signs up and receives admin role.
- [ ] New invited manager signs up and receives program manager role.
- [ ] New invited participant signs up and appears in the correct program.
- [ ] Public anon key cannot select all pending invites.
- [ ] Invite signup cannot silently create auth-only users without profiles.

### Suggested Commit

```bash
git commit -m "fix: secure and complete invitation signup flow"
```

## Phase 2: Align Data Model and Types

Goal: remove ambiguity before component migration.

### Tasks

- [x] Create Supabase TypeScript types from current migrations:

```bash
npx supabase gen types typescript --linked > src/lib/database.types.ts
```

Note: the linked project is paused, so `src/lib/database.types.ts` was created manually in generated-client shape and should be regenerated from Supabase after the project is restored or migrated.

- [x] Decide canonical shape for expenses.
  - [x] Map UI `item` to DB `description`, or migrate DB to `item`.
  - [x] Map UI `receiptUrl` to DB `receipt_url`.
- [x] Decide canonical shape for milestones.
  - [x] Keep DB `milestones` plus `milestone_assignments`.
  - [ ] Or migrate DB to support current UI fields directly.
- [x] Create service-level types in `src/lib/`.
- [x] Add mapper functions:
  - [x] `dbExpenseToExpense()`
  - [x] `expenseToDbInsert()`
  - [x] `dbMilestoneAssignmentToMilestone()`
  - [x] `milestoneFormToDbInsert()`
- [ ] Replace `any` in core data paths.
- [x] Update component props that currently accept raw `any`.
- [x] Run typecheck and capture remaining type debt.

### Acceptance Checks

- [x] TypeScript types exist for profiles, programs, participants, cycles, expenses, milestones, assignments, invites, and notifications.
- [x] Components do not depend on raw Supabase response shape unless they own that query.
- [x] Typecheck catches model drift.

### Suggested Commit

```bash
git commit -m "refactor: align Supabase data types with app models"
```

## Phase 3: Migrate Participant Finance to Supabase

Goal: participant spending cycles and expenses persist across devices and are visible to authorized managers/admins.

### Service Tasks

- [x] Create `src/lib/cycles.ts`.
- [x] Implement `getMyBalanceCycles(programId)`.
- [x] Implement `createBalanceCycle(programId, input)`.
- [x] Implement `setActiveCycle(cycleId)`.
- [x] Create or complete `src/lib/expenses.ts`.
- [x] Implement `getExpenses(cycleId)`.
- [x] Implement `createExpense(input)`.
- [x] Implement `updateExpense(id, input)`.
- [x] Implement `deleteExpense(id)`.

### Component Tasks

- [x] Update `components/Dashboard.tsx` to load cycles after program selection.
- [x] Remove participant cycle reads from `useLocalStorage`.
- [x] Update `components/tabs/FinanceTab.tsx` to call Supabase handlers.
- [x] Update `components/NewCycleModal.tsx` call sites to persist to Supabase.
- [x] Update `components/AddExpenseModal.tsx` save path to persist DB-compatible data.
- [x] Add loading state for finance data.
- [x] Add error state for finance data.
- [x] Add empty state when no active cycle exists.
- [x] Remove base64 receipt persistence from the localStorage finance path.

### Security and RLS Tasks

- [x] Verify participant can manage only their own cycles.
- [x] Verify participant can manage only expenses inside their own cycles.
- [x] Verify manager can view cycles/expenses for managed programs.
- [x] Decide whether manager expense edits are allowed.
- [x] If manager edits are allowed, add audit logging requirement before enabling.

### Acceptance Checks

- [x] Participant creates a cycle, refreshes, and sees it.
- [x] Participant adds an expense, refreshes, and sees it.
- [x] Participant edits an expense, refreshes, and sees updated data.
- [x] Participant deletes an expense, refreshes, and it stays deleted.
- [x] Manager can view participant expenses through RLS.
- [x] Participant cannot read another participant's expenses.

### Suggested Commit

```bash
git commit -m "refactor: persist participant finance data in Supabase"
```

## Phase 4: Migrate Program Manager Workflows

Goal: managers operate on Supabase-backed programs and participants, not localStorage.

### Schema Decision Tasks

- [x] Decide whether multiple managers per program is required.
- [x] If single manager is enough, update frontend types and UI language to match `programs.manager_id`.
- [x] Multiple managers are not required for the current implementation; `programs.manager_id` remains canonical.
- [x] No `program_managers` join table is required while the single-manager model is active.

### Service Tasks

- [x] Ensure `getMyPrograms()` handles admin, manager, and participant roles correctly.
- [x] Ensure `createProgram()` supports the chosen manager model.
- [x] Ensure `updateProgram()` enforces permissions through RLS.
- [x] Ensure `deleteProgram()` or status-complete behavior is intentional.
  - Current behavior is soft completion via `status = 'completed'`, not destructive delete.
- [x] Ensure `getProgram(programId)` returns participant details needed by UI.
- [x] Ensure `addParticipantToProgram()` handles existing users and invites correctly.
- [x] Ensure `removeParticipantFromProgram()` revokes access.

### Component Tasks

- [x] Replace `ProgramManager.getProgramsForUser()` in `ProgramManagerDashboard.tsx`.
- [x] Replace `ProgramManager.getProgramById()` in `ProgramManagerDashboard.tsx`.
- [x] Replace `ProgramManager.getParticipantsInProgram()` in `ProgramManagerDashboard.tsx`.
- [x] Replace localStorage create path in `CreateProgramModal`.
- [x] Remove `window.location.reload()` after program creation.
- [x] Ensure `ManageProgramParticipantsModal` uses Supabase exclusively.
- [x] Build admin "All Programs" view, or explicitly label it incomplete.

### Acceptance Checks

- [x] Manager creates a program and sees it without page reload.
- [x] Manager adds an existing participant and the participant sees the program.
- [x] Manager creates an invite for a non-existing participant.
- [x] Manager removes a participant and access is revoked.
- [x] Admin can see all programs.
- [x] No production manager workflow imports `utils/programManager.ts`.

### Suggested Commit

```bash
git commit -m "refactor: migrate program manager workflows to Supabase"
```

## Phase 5: Migrate Milestones, Assignments, Progress Reports

Goal: milestones and participant progress become shared program data.

### Schema Tasks

- [x] Decide whether to add a dedicated `progress_reports` table.
- [x] If adding `progress_reports`, create migration with:
  - [x] `id`
  - [x] `assignment_id`
  - [x] `participant_id`
  - [x] `week_number`
  - [x] `report_date`
  - [x] `content`
  - [x] `hours_spent`
  - [x] `completion_percentage`
  - [x] `created_at`
  - [x] `updated_at`
- [x] Add RLS for progress reports.
- [x] Decide manager feedback storage.
  - [ ] Dedicated `manager_feedback` table.
  - [x] Or constrained JSONB column.
- [x] Add RLS for manager feedback.

### Service Tasks

- [x] Create `src/lib/milestones.ts`.
- [x] Implement program milestone CRUD.
- [x] Implement assignment creation for one participant.
- [x] Implement bulk assignment creation.
- [x] Implement participant assignment status update.
- [x] Implement progress report creation.
- [x] Implement progress report fetch for participant.
- [x] Implement progress report fetch for manager.
- [x] Implement manager feedback creation.

### Component Tasks

- [x] Update `components/tabs/MilestoneTab.tsx`.
- [x] Update `components/tabs/AssignmentsTab.tsx`.
- [x] Update `components/AssignMilestoneModal.tsx`.
- [x] Update `components/ProgressReportModal.tsx`.
- [x] Update `components/ProgressMatrixView.tsx`.
- [x] Update `components/ParticipantDetailsModal.tsx`.
- [x] Remove milestone localStorage keys from production paths.
- [x] Replace local milestone assignment notifications with persistent notification calls.

### Acceptance Checks

- [x] Manager assigns milestone to one participant.
- [x] Manager assigns milestone to multiple participants.
- [x] Participant sees assigned milestone after refresh.
- [x] Participant submits progress report.
- [x] Manager sees progress in matrix/details view.
- [x] Manager feedback persists.
- [x] Participant sees manager feedback if intended.
- [x] Participant cannot edit another participant's assignment.

### Suggested Commit

```bash
git commit -m "refactor: persist milestones and progress in Supabase"
```

## Phase 6: Migrate Notifications and Audit Logs

Goal: operational events are persistent and tamper-resistant enough for production use.

### Notification Tasks

- [x] Replace `utils/notificationManager.ts` storage with `notifications` table.
- [x] Create `src/lib/notifications.ts`.
- [x] Implement `getMyNotifications()`.
- [x] Implement `markNotificationRead(id)`.
- [x] Implement `createNotification(input)`.
- [x] Update notification badge to query Supabase.
- [x] Update assignment flow to create persistent notifications.
- [x] Update invite/enrollment flow to create persistent notifications if needed.
  - No invite/enrollment notification UX is currently required; those flows are audited.

### Audit Tasks

- [x] Decide audit log schema.
- [x] Add `audit_logs` table if audit is required.
- [x] Restrict audit inserts through SECURITY DEFINER RPC or trusted server path.
- [x] Record manager/admin actions:
  - [x] Assign milestone.
  - [x] Add participant.
  - [x] Remove participant.
  - [x] Edit participant finance data if allowed.
  - [x] Change user role.
  - [x] Create/cancel invite.
- [x] Add admin audit inspection view or script.

### Acceptance Checks

- [x] Notifications persist after refresh.
- [x] Notifications appear across devices.
- [x] Users can only view/update their own notifications.
- [x] Audit events cannot be edited by normal users.
- [x] Admin can inspect critical audit events.

### Suggested Commit

```bash
git commit -m "refactor: persist notifications and audit logs"
```

## Phase 7: Secure Receipt OCR and Storage

Goal: remove browser-exposed Gemini key and store receipts safely.

### Storage Tasks

- [x] Create receipt storage bucket.
- [x] Add storage policies for receipt upload/read.
- [x] Decide whether receipts are private per participant or visible to managers/admins.
- [x] Store receipt URLs in `expenses.receipt_url`.

### Server OCR Tasks

- [x] Choose endpoint platform:
  - [ ] Supabase Edge Function.
  - [x] Vercel Function.
  - [ ] Other trusted backend.
- [x] Move Gemini API key to server-only environment variable.
- [x] Implement authenticated OCR endpoint.
- [x] Verify user session in endpoint.
- [x] Validate file type.
- [x] Validate file size.
- [x] Upload receipt to storage if needed.
- [x] Call Gemini from server.
- [x] Return structured OCR result.
- [x] Log errors without exposing secrets.
- [x] Add rate limiting or abuse guard.

### Frontend Tasks

- [x] Update `components/AddExpenseModal.tsx` to call the server OCR endpoint.
- [x] Remove direct `@google/generative-ai` browser call.
- [x] Remove `process.env.GEMINI_API_KEY` exposure from `vite.config.ts`.
- [x] Remove browser dependency on Gemini package if unused.

### Acceptance Checks

- [x] Gemini key does not appear in the client bundle.
- [ ] OCR works for authenticated users.
- [ ] Anonymous OCR calls are rejected.
- [ ] Oversized files are rejected.
- [ ] Unsupported file types are rejected.
- [ ] Receipt URL is saved in `expenses.receipt_url`.

### Suggested Commit

```bash
git commit -m "fix: move receipt OCR behind authenticated server endpoint"
```

## Phase 8: Admin and Reporting Completion

Goal: finish partially implemented admin/reporting surfaces.

### Admin Tasks

- [ ] Decide secure strategy for admin user email visibility.
  - [ ] Store email in `profiles`.
  - [ ] Or expose admin-only email lookup through RPC/backend.
- [ ] Update `getAllUsers()` to return email.
- [ ] Update `AdminUserManagement` to show real email.
- [ ] Build admin "All Programs" view.
- [ ] Add program filtering/search if useful.

### Reporting Tasks

- [ ] Rework `ReportsAnalytics` to query Supabase.
- [ ] Rework financial oversight reports to query Supabase.
- [ ] Define export permissions by role.
- [ ] Define export scope by program/user/date.
- [ ] Add CSV export from Supabase data.
- [ ] Add JSON export from Supabase data.
- [ ] Remove or clearly label incomplete "coming soon" sections.

### Acceptance Checks

- [ ] Admin can see users with email, role, joined date.
- [ ] Admin can inspect all programs.
- [ ] Manager reports reflect current DB data.
- [ ] Exports match visible dashboard totals.

### Suggested Commit

```bash
git commit -m "feat: complete admin program and reporting views"
```

## Phase 9: Documentation and Cleanup

Goal: leave the project understandable and maintainable.

### Documentation Tasks

- [ ] Replace top-level `README.md` with current app setup.
- [ ] Replace `docs/README.md` or mark it historical.
- [ ] Add `docs/ENVIRONMENT.md`.
- [ ] Document required client variables:
  - [ ] `VITE_SUPABASE_URL`
  - [ ] `VITE_SUPABASE_ANON_KEY`
- [ ] Document server-only variables:
  - [ ] Gemini key location.
  - [ ] Email provider keys when implemented.
- [ ] Update `docs/TESTING_GUIDE.md` for current flows.
- [ ] Archive old migration planning docs or link them as historical.

### Cleanup Tasks

- [ ] Remove unused localStorage utilities after all callers are migrated.
- [ ] Remove unused Gemini browser dependency if server OCR replaces it.
- [ ] Replace `alert()` in critical flows.
- [ ] Replace `confirm()` in critical flows.
- [ ] Remove `window.location.reload()` from normal workflows.
- [ ] Replace generated AI Studio README content.
- [ ] Run `rg "localStorage"` and classify all remaining hits.
- [ ] Run `rg "any"` and classify remaining core data hits.

### Acceptance Checks

- [ ] A new developer can run the app from README alone.
- [ ] Current limitations are explicit.
- [ ] No production workflow uses `utils/userManager.ts`.
- [ ] No production workflow uses `utils/programManager.ts`.
- [ ] `rg "localStorage"` only finds auth storage, harmless preferences, migration tooling, or documented exceptions.

### Suggested Commit

```bash
git commit -m "docs: update project setup and migration status"
```

## Cross-Phase Verification Matrix

Run this matrix at the end of every phase that changes data or permissions.

- [ ] Self-signup creates participant profile.
- [ ] Role invite assigns invited role.
- [ ] Program invite enrolls participant in program.
- [ ] Participant can view only own active enrollments.
- [ ] Manager can view only managed programs.
- [ ] Admin can view all programs.
- [ ] Participant cannot create or manage programs.
- [ ] Manager can create/manage only permitted programs.
- [ ] Participant can view only own expenses.
- [ ] Manager can view expenses for managed programs.
- [ ] Participant can edit only own expenses.
- [x] Manager expense edits are denied unless explicitly allowed and audited.
- [x] Manager can assign milestones to participants in managed programs.
- [x] Participant can submit progress only for own assignments.
- [x] Users can view only their own notifications.
- [ ] Only admins can change roles.
- [ ] Admin cannot accidentally change their own role if the UI blocks it.

## Final Cleanup Checklist

- [ ] Remove `utils/userManager.ts` from production imports.
- [ ] Remove `utils/programManager.ts` from production imports.
- [x] Remove localStorage audit log usage.
- [x] Remove localStorage notification usage.
- [x] Remove participant cycle localStorage usage.
- [x] Remove participant milestone localStorage usage.
- [ ] Replace `any` in core data services and dashboard props.
- [ ] Replace `alert()` and `confirm()` in critical flows with app modals/toasts.
- [ ] Remove `window.location.reload()` from normal workflows.
- [ ] Replace generated AI Studio README.
- [ ] Remove client-side Gemini key injection.
- [ ] Add typecheck script.
- [ ] Add focused SQL verification scripts.

## Implementation Order

Recommended order:

- [ ] Phase 0: build/typecheck baseline.
- [ ] Phase 1: invite security and signup correctness.
- [ ] Phase 3: participant finance persistence.
- [x] Phase 4: program manager Supabase migration.
- [x] Phase 5: milestones and progress persistence.
- [ ] Phase 7: server-side OCR.
- [ ] Phase 8: admin/reporting completion.
- [ ] Phase 9: docs and cleanup.

Optional but recommended before broad migrations:

- [ ] Phase 2: data model and type alignment.
- [x] Phase 6: notifications and audit logs.
