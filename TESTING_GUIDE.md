# Supabase Deployment Testing Guide

## Quick Testing Options

### Option 1: Visual Verification (Fastest - 2 minutes)

1. **Go to Supabase Dashboard**
   - Navigate to: https://app.supabase.com/project/uedwlvucyyxjenoggpwu

2. **Check Table Editor**
   - Click **"Table Editor"** in left sidebar
   - You should see 8 tables:
     - ✅ balance_cycles
     - ✅ expenses
     - ✅ milestone_assignments
     - ✅ milestones
     - ✅ notifications
     - ✅ profiles
     - ✅ program_participants
     - ✅ programs

3. **Check Database Policies**
   - Click **"Authentication"** → **"Policies"**
   - You should see 20+ RLS policies listed
   - Each table should have security enabled

4. **Check SQL Editor**
   - Click **"SQL Editor"**
   - Click **"New query"**
   - Run: `SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename;`
   - You should see all 8 tables

---

### Option 2: Comprehensive SQL Tests (5 minutes)

1. **Open SQL Editor**
   - Go to: https://app.supabase.com/project/uedwlvucyyxjenoggpwu/sql/new

2. **Run Verification Script**
   - Copy contents from: `scripts/test-supabase-deployment.sql`
   - Paste into SQL Editor
   - Click **"Run"**

3. **Expected Results:**
   ```
   Tables: 8
   RLS Policies: 20+
   Indexes: 7+
   Triggers: 6+
   Foreign Keys: 10+
   ```

---

### Option 3: Test with Sample Data (10 minutes)

#### Step 1: Create Test User
1. Go to **Authentication** → **Users**
2. Click **"Add user"** → **"Create new user"**
3. Enter:
   - Email: `test@goldenbridge.org`
   - Password: `TestPassword123!`
   - ✅ Auto Confirm User
4. Click **"Create user"**
5. **Copy the User UUID** (you'll need this)

#### Step 2: Insert Test Data
1. Open **SQL Editor** → **New query**
2. Copy contents from: `scripts/test-insert-sample-data.sql`
3. **Find and replace** all instances of `YOUR_USER_UUID` with the actual UUID from Step 1
4. Run the script
5. Check results in **Table Editor**

#### Step 3: Verify Data
- **Profiles**: Should have 1 admin user
- **Programs**: Should have 1 test program
- **Balance Cycles**: Should have 2 cycles (only 1 active)
- **Expenses**: Should have 3 expenses
- **Milestones**: Should have 1 milestone
- **Notifications**: Should have 1 notification

---

### Option 4: Test via CLI (For developers)

```bash
# Test local to remote connection
npx supabase db diff

# Should show: "No schema changes detected"

# Generate TypeScript types
npx supabase gen types typescript --linked > lib/database.types.ts

# View your tables
npx supabase db remote list
```

---

### Option 5: Test RLS Policies (Advanced)

1. **Create two test users:**
   - Participant: `participant@test.com`
   - Manager: `manager@test.com`

2. **In SQL Editor, test as participant:**
   ```sql
   -- Switch to participant context (replace with actual UUID)
   SET LOCAL ROLE authenticated;
   SET LOCAL request.jwt.claims TO '{"sub": "participant-uuid-here"}';

   -- Try to view all programs (should only see enrolled programs)
   SELECT * FROM programs;

   -- Try to create a program (should fail - not a manager)
   INSERT INTO programs (name, start_date, end_date, total_budget)
   VALUES ('Hack Attempt', '2025-01-01', '2025-12-31', 1000);
   ```

3. **Expected:** Participant can only see/modify their own data

---

## Quick Verification Checklist

Run this single query for a quick health check:

```sql
SELECT
    'Tables' AS component,
    COUNT(*)::text AS status
FROM information_schema.tables
WHERE table_schema = 'public'
UNION ALL
SELECT
    'RLS Enabled',
    CASE WHEN COUNT(*) = 8 THEN '✓ All secured' ELSE '✗ Issue' END
FROM pg_tables
WHERE schemaname = 'public' AND rowsecurity = true
UNION ALL
SELECT
    'Policies',
    COUNT(*)::text || ' policies'
FROM pg_policies
WHERE schemaname = 'public'
UNION ALL
SELECT
    'Triggers',
    COUNT(*)::text || ' triggers'
FROM information_schema.triggers
WHERE trigger_schema = 'public'
UNION ALL
SELECT
    'Extensions',
    CASE WHEN EXISTS (
        SELECT 1 FROM pg_extension WHERE extname = 'pgcrypto'
    ) THEN '✓ pgcrypto installed' ELSE '✗ Missing' END;
```

**Expected Output:**
```
component       | status
----------------|----------------------
Tables          | 8
RLS Enabled     | ✓ All secured
Policies        | 20+ policies
Triggers        | 6+ triggers
Extensions      | ✓ pgcrypto installed
```

---

## Common Issues & Solutions

### Issue: "No tables found"
- **Solution**: Run `npx supabase db push` again
- Check Supabase project URL in `.env.local`

### Issue: "RLS policies not working"
- **Solution**: Verify you're testing with an authenticated user
- Check policy definitions in migration file

### Issue: "Can't insert data"
- **Solution**: Ensure user has a profile in the `profiles` table
- Match the user's UUID with `auth.users.id`

### Issue: "Triggers not firing"
- **Solution**: Check trigger definitions: `SELECT * FROM information_schema.triggers WHERE trigger_schema = 'public';`

---

## Next Steps After Testing

Once all tests pass:

1. ✅ **Mark Day 2 complete**
2. 🔄 **Proceed to Day 3**: Vercel setup
3. 🔄 **Proceed to Day 4**: Authentication implementation

---

## Need Help?

- Supabase Logs: https://app.supabase.com/project/uedwlvucyyxjenoggpwu/logs/explorer
- Supabase Docs: https://supabase.com/docs
- Project Issues: Create issue with error details

---

Last Updated: 2025-10-26
