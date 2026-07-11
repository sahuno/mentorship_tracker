# Golden Bridge Spending Tracker Gap Remediation Plan

Last updated: 2026-06-20

## Purpose

This document is the implementation plan for closing the current product and engineering gaps in the Golden Bridge Spending Tracker. It is based on a repository review of the React/Vite frontend, Supabase schema and migrations, localStorage utilities, and existing planning documents.

Use this as the working checklist before adding new features. The app is currently in a partial migration state: Supabase authentication and some admin/program helpers exist, but many core workflows still persist to browser localStorage.

## Current Product Summary

The application is a role-based program spending and progress tracker for Golden Bridge programs.

Implemented product areas:

- Supabase email/password authentication and profile-based roles.
- Role routing for administrators, program managers, and participants.
- Participant dashboard with program selector, finance tab, milestones tab, and assignments tab.
- Program manager dashboard with overview, program list, participant management, milestone assignment, financial oversight, and reports UI.
- Admin dashboard with system stats, user management, invite management, and role changes.
- Supabase schema for profiles, programs, participants, balance cycles, expenses, milestones, milestone assignments, notifications, and invites.
- Receipt OCR UI using Gemini from the browser.

Main architectural reality:

- Authentication is mostly Supabase-backed.
- Program lookup/enrollment is partially Supabase-backed.
- Expenses, cycles, milestones, progress reports, notifications, audit logs, and most program manager workflows still use localStorage.

## Guiding Decisions

These decisions should be made explicit before implementation starts:

- Supabase should become the single source of truth for all shared program data.
- localStorage should be kept only for harmless UI preferences, temporary drafts, and migration/export tooling.
- Role and permission checks must be enforced in Supabase RLS or server-side functions, not only in React.
- Secrets must not be embedded in the Vite client bundle.
- Database table shape and React TypeScript types must be aligned before large component migrations.
- Each phase should leave the app buildable and manually testable.

## Critical Gaps

### 1. Mixed Persistence

Participant programs load from Supabase, but cycles and milestones are read from localStorage in `components/Dashboard.tsx`.

Program manager workflows read program and participant data through `utils/programManager.ts` and `utils/userManager.ts`, which are localStorage-only.

Impact:

- Data does not sync across browsers or users.
- Program managers may not see participant data created after Supabase login.
- Reports and financial oversight can be inaccurate.
- Production behavior depends on one browser's local state.

Target state:

- `src/lib/` owns all Supabase data operations.
- Components call typed service helpers or hooks.
- localStorage utilities are removed from production workflows.

### 2. Invite Flow Does Not Fully Enroll Users

The signup UI reads invite details and shows success messaging, but does not call `acceptInvite()` after signup.

Impact:

- Invited participant accounts can be created without a `program_participants` enrollment.
- The UI may tell users they were enrolled when only the profile was created.

Target state:

- Invite acceptance happens exactly once after user creation or first confirmed login.
- Role-only invites and program enrollment invites are handled separately.
- The UI message reflects the actual database outcome.

### 3. Invite Migration Bug

`supabase/migrations/20251130_02_update_profile_trigger.sql` updates `invites.updated_at`, but the `invites` table does not define `updated_at` in the visible migrations.

Impact:

- Invited signup can fail inside the profile trigger.
- The trigger catches errors and returns, so the auth user may exist without a profile.
- Missing profiles break login routing and role checks.

Target state:

- Either add `updated_at` to `invites` with a trigger, or remove all references to it.
- Trigger errors should not silently leave users without profiles.
- Add SQL verification for invited signup behavior.

### 4. Public Invite RLS Is Too Broad

The policy named `Anyone can view invite by code for signup` allows selecting every pending, non-expired invite. RLS cannot know whether the client intended a specific invite code.

Impact:

- Anonymous users may be able to enumerate pending invite emails, roles, names, and program details through the Supabase anon key.

Target state:

- Do not allow direct public SELECT on `invites`.
- Expose a `get_invite_by_code(p_invite_code text)` RPC returning only safe fields.
- Keep invite email visibility limited to what the signup page truly needs.

### 5. Client-Side Gemini Secret Exposure

`vite.config.ts` injects `GEMINI_API_KEY` into the client bundle and `components/AddExpenseModal.tsx` calls Gemini directly.

Impact:

- The Gemini API key can be extracted from the browser bundle.
- Usage cannot be reliably rate-limited by user or role.
- Receipt images are sent to an external AI service directly from the client.

Target state:

- Move OCR to a Supabase Edge Function, Vercel Function, or backend endpoint.
- Store the Gemini key only in server environment variables.
- Enforce authenticated access, size limits, rate limits, and logging.

### 6. Frontend and Database Models Diverge

Examples:

- Frontend `Milestone` uses `title`, `category`, `startDate`, `endDate`, `progressReports`.
- Database `milestones` uses `name`, `deadline`, `completion_reward`, with participant progress in `milestone_assignments`.
- Frontend `Expense` uses `item` and `receiptUrl`.
- Database `expenses` uses `description` and `receipt_url`.

Impact:

- Supabase migration work becomes brittle.
- Components need ad hoc mapping.
- Reporting and assignment logic is hard to trust.

Target state:

- Generate database types from Supabase.
- Create explicit app/domain types if needed.
- Add mapper functions only where the UI intentionally differs from storage.
- Prefer DB naming in service layer and UI adapter naming at component boundaries.

### 7. Admin User Data Is Incomplete

`getAllUsers()` currently returns profile records and sets `email: undefined`.

Impact:

- Admin user management displays `N/A` for email.
- Invites and role management are harder to audit.

Target state:

- Either store email safely in `profiles`, or expose admin-only email lookup through a secure function.
- Document which field is authoritative.

### 8. Build and Test Coverage Are Thin

`npm run build` could not run during review because dependencies were not installed in the workspace (`vite: command not found`). `package.json` has no test, lint, or typecheck script.

Impact:

- Type and schema drift can go unnoticed.
- Migration work can regress screens silently.

Target state:

- Dependencies install cleanly.
- `npm run build` passes.
- Add `npm run typecheck`.
- Add targeted SQL verification scripts for migrations.
- Add manual QA scripts for critical flows until automated tests exist.

### 9. Documentation Is Stale

Top-level `README.md` and `docs/README.md` are generated AI Studio stubs. Existing production docs still say major data flows are localStorage-backed.

Impact:

- New contributors cannot tell what is production-ready.
- Deployment and environment requirements are confusing.

Target state:

- Top-level README describes the actual app, architecture, setup, env vars, and current limitations.
- Migration status is represented in one current document.
- Old planning docs are marked as historical or consolidated.

## Implementation Roadmap

### Phase 0: Stabilize Local Development

Goal: make the repo buildable and establish a repeatable verification baseline.

Tasks:

- Run `npm install`.
- Run `npm run build`.
- Add a `typecheck` script:

```json
"typecheck": "tsc --noEmit"
```

- Run `npm run typecheck`.
- Confirm `.env.local` is ignored and `.env.example` is complete.
- Record current Supabase project and migration status.
- Confirm the two existing modified migration files are intentional before changing them.

Acceptance checks:

- `npm install` succeeds.
- `npm run build` succeeds or all build errors are captured in this document.
- `npm run typecheck` exists and either passes or has tracked failures.
- `git status --short` is understood before implementation begins.

Suggested commit:

```bash
git commit -m "chore: establish build and typecheck baseline"
```

### Phase 1: Fix Invite Security and Signup Correctness

Goal: make authentication, profile creation, role invites, and program invites reliable before migrating more data.

Tasks:

- Fix `invites.updated_at` mismatch:
  - Option A: add `updated_at TIMESTAMPTZ DEFAULT NOW()` to `invites` and attach the existing `update_updated_at_column()` trigger.
  - Option B: remove `updated_at = NOW()` from invite trigger code.
- Decide how role-only invites differ from program invites:
  - Admin and manager invites may have `program_id = NULL`.
  - Participant program invites should normally have a program.
- Replace public invite SELECT policy with safe RPC:

```sql
CREATE OR REPLACE FUNCTION get_invite_by_code(p_invite_code TEXT)
RETURNS TABLE (
  invite_code TEXT,
  email TEXT,
  invitee_name TEXT,
  target_role TEXT,
  program_id UUID,
  program_name TEXT,
  program_description TEXT,
  expires_at TIMESTAMPTZ
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    i.invite_code,
    i.email,
    i.invitee_name,
    i.target_role,
    p.id AS program_id,
    p.name AS program_name,
    p.description AS program_description,
    i.expires_at
  FROM invites i
  LEFT JOIN programs p ON p.id = i.program_id
  WHERE i.invite_code = p_invite_code
    AND i.status = 'pending'
    AND i.expires_at > NOW()
  LIMIT 1;
$$;
```

- Update `getInviteDetails()` to call the RPC instead of selecting `invites` directly.
- Update signup/login flow to call `acceptInvite()` for program invites.
- Make role assignment and program enrollment idempotent.
- Add SQL verification:
  - Role-only admin invite creates admin profile.
  - Program participant invite creates participant profile and enrollment.
  - Expired invite cannot be used.
  - Existing user accepting invite is enrolled once.
  - Anonymous users cannot list pending invites.

Acceptance checks:

- New invited admin signs up and receives admin role.
- New invited manager signs up and receives manager role.
- New invited participant signs up and appears in the correct program.
- Public anon key cannot select all pending invites.
- No auth user is left without a profile after invited signup.

Suggested commit:

```bash
git commit -m "fix: secure and complete invitation signup flow"
```

### Phase 2: Align Data Model and Types

Goal: remove ambiguity before component migration.

Tasks:

- Generate Supabase TypeScript types:

```bash
npx supabase gen types typescript --linked > src/lib/database.types.ts
```

- Decide canonical table shapes:
  - Keep current DB schema and adapt UI.
  - Or add columns/migrations to support the existing UI shape.
- Create service return types in `src/lib/`.
- Add mapper functions for unavoidable UI differences:
  - `dbExpenseToExpense()`
  - `expenseToDbInsert()`
  - `dbMilestoneAssignmentToMilestone()`
  - `milestoneFormToDbInsert()`
- Replace broad `any` in core data paths.

Acceptance checks:

- TypeScript types for profiles, programs, participants, cycles, expenses, milestones, assignments, invites, and notifications exist.
- No component directly depends on raw Supabase response shape unless it owns that query.
- Typecheck catches model drift.

Suggested commit:

```bash
git commit -m "refactor: align Supabase data types with app models"
```

### Phase 3: Migrate Participant Finance to Supabase

Goal: participant spending cycles and expenses persist across devices and are visible to authorized managers/admins.

Tasks:

- Create `src/lib/cycles.ts`:
  - `getMyBalanceCycles(programId)`
  - `createBalanceCycle(programId, input)`
  - `setActiveCycle(cycleId)`
- Create or complete `src/lib/expenses.ts`:
  - `getExpenses(cycleId)`
  - `createExpense(input)`
  - `updateExpense(id, input)`
  - `deleteExpense(id)`
- Update `Dashboard.tsx` to load cycles for selected program from Supabase.
- Update `FinanceTab.tsx` handlers to call Supabase.
- Keep local optimistic state only after successful DB writes, or use a clear loading/error state.
- Remove base64 receipt persistence from localStorage path.
- Add empty, loading, and error states.

Acceptance checks:

- Participant creates a cycle, refreshes, and sees the cycle.
- Participant adds, edits, deletes expense, refreshes, and sees correct data.
- Manager can view participant expenses through RLS but cannot edit unless policy explicitly allows it.
- Participant cannot read another participant's expenses.

Suggested commit:

```bash
git commit -m "refactor: persist participant finance data in Supabase"
```

### Phase 4: Migrate Program Manager Workflows

Goal: managers operate on Supabase-backed programs and participants, not localStorage.

Tasks:

- Replace `ProgramManager.getProgramsForUser()` usage in `ProgramManagerDashboard.tsx` with `getMyPrograms()`.
- Replace `CreateProgramModal` localStorage save with `createProgram()`.
- Decide if multiple managers per program is required:
  - Current frontend type supports `managerIds`.
  - Current DB schema supports single `manager_id`.
  - If multiple managers are required, add a `program_managers` join table and migrate RLS.
- Replace participant list logic with `getProgram(programId)`.
- Ensure `ManageProgramParticipantsModal` uses Supabase exclusively.
- Replace `window.location.reload()` after program creation with state refresh.
- Build admin "All Programs" view or remove/label as not implemented.

Acceptance checks:

- Manager creates a program and sees it without page reload.
- Manager adds an existing participant and the participant sees the program.
- Manager creates an invite for a non-existing participant.
- Manager removes participant and access is revoked.
- Admin can see all programs.

Suggested commit:

```bash
git commit -m "refactor: migrate program manager workflows to Supabase"
```

### Phase 5: Migrate Milestones, Assignments, Progress Reports

Goal: milestones and participant progress become shared program data.

Tasks:

- Decide whether progress reports need a dedicated table. Current DB has `milestone_assignments` but no `progress_reports` table.
- Recommended migration:
  - Keep `milestones` as program-level templates/goals.
  - Use `milestone_assignments` for each participant's status.
  - Add `progress_reports` table:

```sql
CREATE TABLE progress_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  assignment_id UUID REFERENCES milestone_assignments(id) ON DELETE CASCADE,
  participant_id UUID REFERENCES profiles(id) NOT NULL,
  week_number INTEGER,
  report_date DATE NOT NULL DEFAULT CURRENT_DATE,
  content TEXT NOT NULL,
  hours_spent NUMERIC,
  completion_percentage INTEGER CHECK (completion_percentage BETWEEN 0 AND 100),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

- Add manager feedback support:
  - Option A: `manager_feedback` table linked to progress reports.
  - Option B: JSONB column if feedback stays simple.
- Create `src/lib/milestones.ts`.
- Update `MilestoneTab`, `AssignmentsTab`, `AssignMilestoneModal`, `ProgressReportModal`, `ProgressMatrixView`, and `ParticipantDetailsModal`.
- Remove milestone localStorage keys from production flows.

Acceptance checks:

- Manager assigns milestone to one or many participants.
- Participant sees assigned milestone after refresh.
- Participant submits progress report.
- Manager sees progress in matrix/details view.
- Manager feedback persists and is visible to participant if intended.

Suggested commit:

```bash
git commit -m "refactor: persist milestones and progress in Supabase"
```

### Phase 6: Migrate Notifications and Audit Logs

Goal: operational events are persistent and tamper-resistant enough for production use.

Tasks:

- Replace `utils/notificationManager.ts` localStorage storage with `notifications` table.
- Add service functions:
  - `getMyNotifications()`
  - `markNotificationRead(id)`
  - `createNotification(input)`
- Decide audit log storage:
  - Add `audit_logs` table for manager/admin actions.
  - Restrict inserts through SECURITY DEFINER RPC or trusted server path.
- Update assignment, enrollment, finance override, role change, and invite flows to create audit events.

Acceptance checks:

- User notifications persist after refresh and across devices.
- Audit events cannot be edited by normal users.
- Admin can inspect critical audit events.

Suggested commit:

```bash
git commit -m "refactor: persist notifications and audit logs"
```

### Phase 7: Secure Receipt OCR and Storage

Goal: remove browser-exposed Gemini key and store receipts safely.

Tasks:

- Create receipt storage bucket and policies.
- Move OCR to a server-side endpoint:
  - Supabase Edge Function, or
  - Vercel Function, or
  - other trusted backend.
- Server endpoint responsibilities:
  - Verify user session.
  - Validate file type and size.
  - Upload receipt to storage if needed.
  - Call Gemini with server-only API key.
  - Return structured OCR result.
  - Log errors without leaking secrets.
- Update `AddExpenseModal.tsx` to call the endpoint.
- Remove `process.env.GEMINI_API_KEY` exposure from `vite.config.ts`.

Acceptance checks:

- Gemini key does not appear in the client bundle.
- OCR works for authenticated users.
- Oversized or unsupported files are rejected.
- Receipt URL stored in `expenses.receipt_url`.

Suggested commit:

```bash
git commit -m "fix: move receipt OCR behind authenticated server endpoint"
```

### Phase 8: Admin and Reporting Completion

Goal: finish partially implemented admin/reporting surfaces.

Tasks:

- Make admin user email visible through a secure strategy.
- Build admin "All Programs" view.
- Rework reports to query Supabase instead of localStorage.
- Define export permissions and export scope.
- Add CSV/JSON exports based on Supabase data.
- Remove or clearly label incomplete "coming soon" sections.

Acceptance checks:

- Admin can see users with email, role, joined date.
- Admin can inspect all programs.
- Manager reports reflect current DB data.
- Exports match visible dashboard totals.

Suggested commit:

```bash
git commit -m "feat: complete admin program and reporting views"
```

### Phase 9: Documentation and Cleanup

Goal: leave the project understandable and maintainable.

Tasks:

- Replace top-level `README.md` with current app setup.
- Replace `docs/README.md` or mark it historical.
- Add `docs/ENVIRONMENT.md` with required variables:
  - `VITE_SUPABASE_URL`
  - `VITE_SUPABASE_ANON_KEY`
  - server-only Gemini key location
  - email provider keys when implemented
- Add `docs/TESTING_GUIDE.md` updates for current flows.
- Archive old migration planning docs or link them from a "historical docs" section.
- Remove unused localStorage utilities after all callers are migrated.
- Remove unused dependencies if Gemini client no longer runs in browser.

Acceptance checks:

- A new developer can run the app from README alone.
- Current limitations are explicit.
- No production workflow uses `utils/userManager.ts` or `utils/programManager.ts`.
- `rg "localStorage"` only finds auth storage, harmless preferences, migration tooling, or documented exceptions.

Suggested commit:

```bash
git commit -m "docs: update project setup and migration status"
```

## Data Migration Strategy

If users have meaningful localStorage data, migrate before removing localStorage flows.

Recommended approach:

1. Add an authenticated export screen for current browser data.
2. Export JSON with version and user id.
3. Add an admin-only import or migration script.
4. Validate user ids/emails before insert.
5. Insert in this order:
   - profiles, if needed
   - programs
   - program_participants
   - balance_cycles
   - expenses
   - milestones
   - milestone_assignments
   - progress_reports
   - notifications
6. Store migration audit result.
7. Keep read-only backup export for 30 days after cutover.

Do not silently merge localStorage and Supabase data in normal user flows. That creates hard-to-debug duplicates.

## Verification Matrix

Run this matrix at the end of every phase touching data or permissions.

| Flow | Participant | Program Manager | Admin |
| --- | --- | --- | --- |
| Sign up without invite | Creates participant profile | N/A | N/A |
| Sign up with role invite | Uses invited role | Uses invited role | Uses invited role |
| Sign up with program invite | Enrolled in program | N/A | N/A |
| View programs | Own active enrollments only | Managed programs only | All programs |
| Create program | Denied | Allowed if policy says managers can create | Allowed |
| Add participant | Denied | Own programs only | Allowed |
| View expenses | Own expenses only | Participants in managed programs | All or policy-defined |
| Edit expenses | Own expenses only | Denied unless explicitly allowed and audited | Policy-defined |
| Assign milestones | Denied | Participants in managed programs | Allowed |
| Submit progress | Own assignments only | Denied | Denied |
| View notifications | Own notifications only | Own notifications only | Own notifications only |
| Change roles | Denied | Denied | Allowed except own role |

## Technical Debt Cleanup Checklist

- [ ] Remove `utils/userManager.ts` from production imports.
- [ ] Remove `utils/programManager.ts` from production imports.
- [ ] Remove localStorage audit log usage.
- [ ] Remove localStorage notification usage.
- [ ] Remove participant cycle localStorage usage.
- [ ] Remove participant milestone localStorage usage.
- [ ] Replace `any` in core data services and dashboard props.
- [ ] Replace `alert()` and `confirm()` in critical flows with app modals/toasts.
- [ ] Remove `window.location.reload()` from normal workflows.
- [ ] Replace generated AI Studio README.
- [ ] Remove client-side Gemini key injection.
- [ ] Add typecheck script.
- [ ] Add focused SQL verification scripts.

## Known Existing Uncommitted Changes at Review Time

At the time this plan was created, these files already had uncommitted changes:

- `supabase/migrations/20251130_03_role_invite_policies.sql`
- `supabase/migrations/20251130_04_seed_initial_admin.sql`

Review these before editing migration history. Avoid rewriting migration files that may already have been applied to a shared Supabase project unless you are intentionally creating a corrective migration.

## Suggested Implementation Order

If time is limited, use this order:

1. Phase 0: build/typecheck baseline.
2. Phase 1: invite security and signup correctness.
3. Phase 3: participant finance persistence.
4. Phase 4: program manager Supabase migration.
5. Phase 5: milestones and progress persistence.
6. Phase 7: server-side OCR.
7. Phase 8: admin/reporting completion.
8. Phase 9: docs and cleanup.

Do not start new product features until Phases 1, 3, and 4 are complete. Those phases define whether users can trust the core data.
