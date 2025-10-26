# Supabase Project Setup Instructions

## Step 1: Create Supabase Project

1. Go to https://app.supabase.com
2. Click "New Project"
3. Fill in project details:
   - **Name**: `golden-bridge-tracker` (or your preferred name)
   - **Database Password**: (generate a strong password and save it!)
   - **Region**: Choose closest to your users (e.g., US East)
   - **Pricing Plan**: Free tier is fine to start
4. Click "Create new project"
5. Wait 2-3 minutes for project to initialize

## Step 2: Get Project Credentials

Once your project is ready:

1. Go to **Settings** → **API**
2. Copy the following values:

   ```
   Project URL: https://xxxxx.supabase.co
   anon public key: eyJhbG...
   service_role key: eyJhbG... (keep this secret!)
   ```

3. Update your `.env.local` file with these values:

   ```bash
   NEXT_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbG...
   SUPABASE_SERVICE_KEY=eyJhbG...
   ```

## Step 3: Link Local Project to Supabase

```bash
# Get your project ref (from the URL: https://app.supabase.com/project/YOUR_PROJECT_REF)
npx supabase link --project-ref YOUR_PROJECT_REF

# Enter your database password when prompted
```

## Step 4: Push Database Migration

```bash
# This will apply the schema to your Supabase database
npx supabase db push

# Verify tables were created
npx supabase db diff
```

## Step 5: Create Storage Bucket for Receipts

Option A: Via Supabase Dashboard
1. Go to **Storage** in Supabase Dashboard
2. Click "New bucket"
3. Name: `receipts`
4. Make it **Public** ✅
5. Click "Create bucket"

Option B: Via SQL Editor
```sql
INSERT INTO storage.buckets (id, name, public)
VALUES ('receipts', 'receipts', true);
```

## Step 6: Verify Setup

Run this SQL in the Supabase SQL Editor to verify everything:

```sql
-- Check that all tables exist
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
ORDER BY table_name;

-- Should show:
-- balance_cycles
-- expenses
-- milestone_assignments
-- milestones
-- notifications
-- profiles
-- program_participants
-- programs

-- Check RLS is enabled
SELECT tablename, rowsecurity
FROM pg_tables
WHERE schemaname = 'public';

-- All should show: true
```

## Troubleshooting

### Issue: "Database not ready"
- Wait 2-3 minutes after project creation
- Refresh the Supabase dashboard

### Issue: "Migration failed"
- Check database password is correct
- Verify you're linked to the right project: `npx supabase projects list`
- Try running migration locally first: `npx supabase db reset`

### Issue: "Can't connect to database"
- Check your internet connection
- Verify project URL in `.env.local` is correct
- Ensure you're using the correct project ref

## Next Steps After Setup

Once Supabase is configured:

1. ✅ Day 2 tasks complete - commit the migration
2. 🔄 Move to Day 3: Vercel setup
3. 🔄 Move to Day 4: Authentication implementation

---

**Current Status**: Database schema created locally
**Next**: Create Supabase project → Link → Push migration
