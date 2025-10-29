# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

**Last Updated**: 2025-10-27
**Production Status**: ✅ LIVE - Deployed on Vercel with Supabase backend
**GitHub Repository**: git@github.com:sahuno/mentorship_tracker.git

---

## Project Overview

Golden Bridge Spending Tracker is a **production-ready** React + Supabase web application for the "Golden Bridge Women" mentorship program. It enables participants to track expenses against budgets across defined spending cycles with AI-powered receipt OCR capabilities.

### Key Features
- 🔐 **Supabase Authentication** with role-based access control (Admin, Manager, Participant)
- 💰 **Expense Tracking** with budget cycles and AI-powered receipt scanning
- 📊 **Program Management** for mentorship programs with participant assignments
- 🎯 **Milestone Tracking** with progress monitoring and notifications
- 📈 **Financial Analytics** and reporting dashboards
- 🔔 **Real-time Notifications** system

---

## Production URLs

- **Live App**: https://goldenbridgespendingtracker-angdi7esv-samuel-ahunos-projects.vercel.app
- **Supabase Dashboard**: https://app.supabase.com/project/uedwlvucyyxjenoggpwu
- **Vercel Dashboard**: https://vercel.com/samuel-ahunos-projects/golden_bridge_spending_tracker
- **GitHub Repo**: https://github.com/sahuno/mentorship_tracker

---

## Development Commands

### Setup
```bash
npm install
```

### Running the Application
```bash
npm run dev        # Start development server on http://localhost:3000
npm run build      # Production build
npm run preview    # Preview production build
```

### Database Management
```bash
npx supabase db push              # Push migrations to remote database
npx supabase migration list       # List applied migrations
npx supabase db reset             # Reset local database (development only)
```

### Environment Configuration

Required environment variables in `.env.local`:

```bash
# Supabase (get from https://app.supabase.com/project/_/settings/api)
VITE_SUPABASE_URL=https://uedwlvucyyxjenoggpwu.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
NEXT_PUBLIC_SUPABASE_URL=https://uedwlvucyyxjenoggpwu.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key

# Gemini AI for Receipt OCR (get from https://makersuite.google.com/app/apikey)
GEMINI_API_KEY=your-gemini-api-key

# Application
NEXT_PUBLIC_APP_URL=http://localhost:3000  # Change to production URL for Vercel
NODE_ENV=development
```

**Note**: See `.env.example` for full list of optional variables.

---

## Architecture

### Backend: Supabase

**Database Schema** (8 tables with RLS):
- `profiles` - User profiles with role-based access (admin, program_manager, participant)
- `programs` - Mentorship programs managed by program managers
- `program_participants` - Many-to-many junction table
- `balance_cycles` - Budget periods with spending limits
- `expenses` - Individual expense transactions with receipt storage
- `milestones` - Program goals and objectives
- `milestone_assignments` - Participant progress tracking
- `notifications` - In-app notification system

**Location**: `supabase/migrations/20251026130728_initial_schema.sql`

**Row Level Security (RLS)**: All tables have comprehensive RLS policies:
- Participants can only access their own data
- Program managers can access their program data
- Admins have full access across all data

### Frontend: React + TypeScript

**Core Data Model** (types.ts):
- `User` - Authentication identity with role
- `UserRole` - Enum: 'admin', 'program_manager', 'participant'
- `Expense` - Spending entry with optional receipt image
- `BalanceSheetCycle` - Budget period container
- `Program` - Mentorship program definition
- `Milestone` - Program goal with assignments
- `Notification` - In-app alert

### State Management

**Hybrid Approach**:
1. **Supabase Real-time** for server-persisted data (expenses, programs, milestones)
2. **Local State** (React useState) for UI state and session management
3. **LocalStorage** (legacy) for backward compatibility with pre-Supabase implementation

**Key Files**:
- `src/lib/supabase.ts` - Supabase client configuration
- `src/lib/auth.ts` - Authentication functions (signup, login, logout, session)
- `hooks/useLocalStorage.ts` - Local storage persistence hook

### Component Hierarchy

```
App.tsx (session management + auth state)
├── LoginSupabase.tsx (authentication UI)
└── Dashboard.tsx / ProgramManagerDashboard.tsx (role-based dashboards)
    ├── TabNavigation.tsx
    ├── HomeTab.tsx (overview + quick actions)
    ├── FinanceTab.tsx (expense tracking + budget cycles)
    │   ├── BalanceSheet.tsx
    │   ├── AddExpenseModal.tsx (with AI OCR)
    │   └── NewCycleModal.tsx
    ├── MilestoneTab.tsx (goal tracking)
    │   ├── MilestoneCard.tsx
    │   ├── AddMilestoneModal.tsx
    │   └── AssignMilestoneModal.tsx
    └── AssignmentsTab.tsx (participant progress)
        ├── ProgressMatrixView.tsx
        └── ProgressReportModal.tsx
```

---

## Critical Implementation Details

### Authentication Flow (Supabase)

**Signup** (`src/lib/auth.ts:62-90`):
1. User submits signup form with email, password, name, role, phone
2. `supabase.auth.signUp()` creates user in `auth.users` table
3. **Database trigger automatically creates profile** (see below)
4. Supabase sends email confirmation (if enabled)
5. User confirms email and can log in

**Login** (`src/lib/auth.ts:24-45`):
1. User submits email/password
2. `supabase.auth.signInWithPassword()` authenticates
3. `getUserProfile()` fetches profile from `profiles` table
4. Session established with role-based permissions

**Session Management** (`App.tsx:14-56`):
- Checks for existing session on app mount
- Listens to auth state changes with `onAuthStateChange()`
- Automatically refreshes session tokens
- Redirects to login if session expires

### Profile Creation Security (Database Trigger)

**Implementation**: Automatic profile creation via PostgreSQL trigger
**Location**: `supabase/migrations/20251027124019_profile_creation_trigger.sql`

**How it works**:
```sql
CREATE FUNCTION handle_new_user() RETURNS TRIGGER SECURITY DEFINER
```

1. When a user signs up, `auth.users` INSERT event fires
2. Trigger `on_auth_user_created` executes `handle_new_user()` function
3. Function extracts `name`, `role`, `phone` from `raw_user_meta_data`
4. **Forces role to 'participant'** for security (prevents privilege escalation)
5. Creates profile record with `SECURITY DEFINER` (bypasses RLS)

**Security Benefits**:
- ✅ Profile creation happens at database level (cannot be bypassed by client code)
- ✅ Works regardless of email confirmation timing (no `auth.uid()` dependency)
- ✅ Enforces role='participant' for all self-signups
- ✅ Runs with elevated privileges to bypass RLS policies

**Previous Approach** (deprecated):
- Manual profile insertion from `auth.ts` (removed in commit d69a6a1)
- RLS policy allowing INSERT (superseded by trigger)
- Failed due to timing issues with email confirmation

**Admin/Manager Role Assignment**:
- Admin and manager roles **must be assigned manually** by existing admins
- Self-signup **always creates 'participant' role** (enforced by trigger)
- Future enhancement: Add admin dashboard for role management

### AI Receipt OCR

**Implementation**: `components/AddExpenseModal.tsx:86-147`

**Flow**:
1. User uploads receipt image (JPG, PNG, WebP)
2. Image converted to base64 Data URL via FileReader
3. Sent to Google Gemini 2.5 Flash model with extraction prompt
4. Returns structured JSON array: `[{item, amount, date}]`
5. User clicks detected expense to auto-populate form
6. Receipt URL stored in Supabase `expenses.receipt_url` column

**API Configuration**:
- API Key: `process.env.GEMINI_API_KEY`
- Model: `gemini-2.0-flash-exp`
- Max tokens: Automatically managed by Gemini

### Expense CRUD Operations

**Add Expense** (`FinanceTab.tsx`):
- Creates expense with UUID via `supabase.from('expenses').insert()`
- Associates with active `balance_cycle`
- Stores receipt image as Data URL (or Supabase Storage URL)

**Edit Expense**:
- Fetches expense by ID
- Updates via `supabase.from('expenses').update()`
- Preserves receipt URL if not changed

**Delete Expense**:
- Confirmation modal before deletion
- Soft delete or hard delete via `supabase.from('expenses').delete()`

### Budget Cycle Management

**Rules**:
- Only **one cycle can be active** (`is_active: true`) at a time
- Starting new cycle deactivates all previous cycles
- Expenses belong to specific cycle via `balance_cycle_id` foreign key

**Calculations**:
- Total spent: `SUM(expenses.amount)` for active cycle
- Remaining budget: `cycle.budget - total_spent`
- Budget warnings when remaining < 20%

---

## Tech Stack

- **Frontend**: React 19.2 + TypeScript 5.8
- **Build Tool**: Vite 6.2
- **Styling**: Tailwind CSS (via inline classes)
- **Backend**: Supabase (PostgreSQL + Auth + Real-time)
- **Database**: PostgreSQL 17 with Row Level Security
- **Authentication**: Supabase Auth (email/password)
- **AI**: Google Gemini API 2.0 Flash
- **Deployment**: Vercel (auto-deploy from GitHub)
- **Dependencies**:
  - `@supabase/supabase-js` ^2.76.1
  - `@supabase/auth-ui-react` ^0.4.7
  - `@google/generative-ai` (for Gemini)
  - `uuid` v9.0.1
  - `react-router-dom` (if using routing)

---

## Development Guidelines

### Adding New Database Tables

1. Create migration file: `supabase/migrations/YYYYMMDDHHMMSS_description.sql`
2. Define table schema with RLS policies
3. Test locally: `npx supabase db reset`
4. Push to production: `npx supabase db push`

### Adding New Expense Fields

1. Update database: Add column to `expenses` table via migration
2. Update `Expense` interface in `types.ts`
3. Modify form in `AddExpenseModal.tsx`
4. Update table display in `BalanceSheet.tsx`
5. Adjust OCR prompt if AI should extract the field

### Modifying User Roles

**Important**: Role changes require database-level operations.

**To promote user to admin/manager**:
```sql
UPDATE profiles
SET role = 'admin'  -- or 'program_manager'
WHERE id = '<user-uuid>';
```

**Cannot be done from application UI** (security by design).

### Working with Supabase Real-time

**Subscribe to table changes**:
```typescript
const subscription = supabase
  .channel('expenses-changes')
  .on('postgres_changes',
    { event: '*', schema: 'public', table: 'expenses' },
    (payload) => {
      console.log('Change received!', payload)
    }
  )
  .subscribe()
```

**Cleanup**:
```typescript
useEffect(() => {
  return () => {
    subscription.unsubscribe()
  }
}, [])
```

---

## Security & Best Practices

### Environment Variables

**Never commit secrets** - All sensitive values in `.env.local` (gitignored):
- ✅ `.env.local` is in `.gitignore`
- ✅ `.env.example` contains only placeholders
- ✅ Supabase `config.toml` uses `env()` substitution
- ✅ Application reads from `import.meta.env.VITE_*`

**Protected patterns in `.gitignore`**:
```
.env.local
.env.*.local
handoff*.md  # May contain sensitive debugging info
Screenshot*  # May show sensitive data
```

### Row Level Security (RLS)

**All tables have RLS enabled**. Example policies:

```sql
-- Participants can only view their own expenses
CREATE POLICY "Participants can view own expenses" ON expenses
  FOR SELECT USING (
    auth.uid() IN (
      SELECT id FROM profiles WHERE id = expenses.user_id
    )
  );

-- Admins can view all expenses
CREATE POLICY "Admins can view all expenses" ON expenses
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );
```

**Location**: `supabase/migrations/20251026130728_initial_schema.sql:188-300`

### CSRF & XSS Protection

- ✅ Supabase handles CSRF tokens automatically
- ✅ React escapes JSX by default (XSS protection)
- ✅ Receipt images sanitized before storage
- ⚠️ **TODO**: Add Content Security Policy (CSP) headers in Vercel

### Database Backup

- ✅ Supabase auto-backup enabled (daily snapshots)
- ✅ Point-in-time recovery available
- 📝 **Manual backup**: Use Supabase Dashboard → Database → Backups

---

## Known Issues & Troubleshooting

### Email Confirmation Not Received

**Symptom**: User signs up successfully but doesn't receive confirmation email.

**Possible Causes**:
1. **Email in spam folder** - Supabase default sender (`noreply@mail.app.supabase.io`) often flagged
2. **Email confirmations disabled** - Check Auth settings in Supabase dashboard
3. **Rate limit reached** - Free tier has email sending limits
4. **SMTP not configured** - Production should use custom SMTP (SendGrid, Resend, etc.)

**Solution**:
- Check Supabase → Auth → Providers → Email settings
- Verify "Confirm email" is enabled
- Configure custom SMTP for production (recommended)
- Check Supabase logs for email errors

### Profile Not Created After Signup

**Symptom**: User created in `auth.users` but missing from `profiles` table.

**Check**:
1. Verify trigger exists: `SELECT * FROM pg_trigger WHERE tgname = 'on_auth_user_created'`
2. Check function exists: `\df handle_new_user` in Supabase SQL editor
3. Review logs: Supabase Dashboard → Logs → Database

**Fix**:
Re-apply migration: `npx supabase db push --include-all`

### RLS Policy Blocking Operations

**Symptom**: "new row violates row-level security policy" error.

**Debug**:
1. Check user's role: `SELECT role FROM profiles WHERE id = auth.uid()`
2. Review RLS policies: `SELECT * FROM pg_policies WHERE tablename = 'expenses'`
3. Test policy: Run query as specific user in Supabase SQL editor

**Solution**: Adjust RLS policy `WITH CHECK` or `USING` clause.

---

## Deployment

### Production Deployment (Vercel)

**Automatic Deployment**:
1. Push to GitHub: `git push origin main`
2. Vercel auto-deploys from GitHub
3. Environment variables managed in Vercel dashboard

**Environment Variables** (set in Vercel):
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `GEMINI_API_KEY`
- `NODE_ENV=production`

**Build Settings**:
- Framework: Vite
- Build Command: `npm run build`
- Output Directory: `dist`
- Install Command: `npm install`

### Database Migrations

**Deploy new migration**:
```bash
# 1. Create migration locally
npx supabase migration new description

# 2. Write SQL in generated file
# supabase/migrations/YYYYMMDDHHMMSS_description.sql

# 3. Test locally
npx supabase db reset

# 4. Push to production
npx supabase db push
```

**Rollback** (if needed):
```sql
-- Create new migration that reverses changes
-- No automatic rollback in Supabase
```

---

## Testing

### Manual Testing Checklist

**Authentication**:
- [ ] Signup creates user + profile + sends email
- [ ] Login works with correct credentials
- [ ] Login fails with wrong credentials
- [ ] Logout clears session
- [ ] Session persists across page refresh

**Expense Tracking**:
- [ ] Add expense saves to database
- [ ] Edit expense updates correctly
- [ ] Delete expense removes from database
- [ ] Budget calculations accurate
- [ ] Receipt upload and display works

**Role-Based Access**:
- [ ] Participant sees only own data
- [ ] Manager sees program data
- [ ] Admin sees all data
- [ ] Role restrictions enforced

### Test Credentials (Production)

**Create test users** via Supabase SQL Editor:

```sql
-- After user signs up, promote to admin
UPDATE profiles SET role = 'admin'
WHERE email = 'admin@goldenbridge.org';

-- Or create test users directly
INSERT INTO auth.users (email, encrypted_password, email_confirmed_at)
VALUES ('test@example.com', crypt('password123', gen_salt('bf')), NOW());
```

**Note**: Use Supabase Dashboard → Authentication → Users for user management.

---

## Path Aliases

`@/*` maps to project root (configured in tsconfig.json and vite.config.ts)

Example:
```typescript
import { supabase } from '@/src/lib/supabase'  // ✅
import { User } from '@/types'                  // ✅
```

---

## Future Enhancements

### High Priority
- [ ] Custom SMTP email configuration (SendGrid/Resend)
- [ ] Receipt image storage in Supabase Storage (instead of Data URLs)
- [ ] Admin dashboard for role management
- [ ] Email notification system for budget alerts
- [ ] Export financial reports (PDF/CSV)

### Medium Priority
- [ ] Multi-program support for participants
- [ ] Milestone progress charts and analytics
- [ ] Mobile app (React Native)
- [ ] Integration with accounting software (QuickBooks, Xero)

### Low Priority
- [ ] Dark mode UI
- [ ] Multi-language support (i18n)
- [ ] Advanced search and filtering
- [ ] Audit log for all operations

---

## Support & Resources

- **Supabase Docs**: https://supabase.com/docs
- **Vite Docs**: https://vitejs.dev
- **React Docs**: https://react.dev
- **Tailwind CSS**: https://tailwindcss.com/docs
- **Gemini API**: https://ai.google.dev/docs

---

**Maintainer**: Samuel Ahuno (ekwame001@gmail.com)
**License**: MIT (or specify your license)
**Last Updated**: 2025-10-27
