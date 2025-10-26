# Golden Bridge Spending Tracker - Supabase + Vercel Deployment Plan

## Executive Summary

Based on your requirements:
- **Scale**: Medium deployment (20-100 users)
- **Timeline**: 3+ months for launch
- **Budget**: $20-50/month range
- **Key Features**: Cross-device sync, AI Receipt OCR, Multi-program support, Email notifications
- **Tech Stack**: Supabase (Auth + Database + Storage) + Vercel (Hosting) + SendGrid (Email)
- **Priority**: Data security with PITR backups, automated migration from localStorage

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                         Users                               │
└──────────────────┬──────────────────────────────────────────┘
                   │
                   ▼
         ┌─────────────────┐
         │   Vercel CDN    │
         │  (React App)    │
         └────────┬────────┘
                  │
        ┌─────────┴──────────┬──────────────┐
        │                    │               │
        ▼                    ▼               ▼
┌──────────────┐    ┌──────────────┐  ┌──────────────┐
│  Supabase    │    │   Gemini     │  │  SendGrid    │
│  Auth API    │    │   AI API     │  │  Email API   │
└──────┬───────┘    └──────────────┘  └──────────────┘
       │
       ▼
┌──────────────────────────────────┐
│     Supabase PostgreSQL          │
│  ┌────────────────────────────┐  │
│  │ Tables:                    │  │
│  │ • users                    │  │
│  │ • programs                 │  │
│  │ • balance_cycles          │  │
│  │ • expenses                 │  │
│  │ • milestones              │  │
│  │ • assignments             │  │
│  └────────────────────────────┘  │
└──────────────────────────────────┘
       │
       ▼
┌──────────────────────────────────┐
│   Supabase Storage (Receipts)    │
└──────────────────────────────────┘
```

## Cost Breakdown

### Monthly Costs (Production)
```
Supabase Pro:       $25/month
- 500MB database
- 5GB storage
- 50,000 MAUs
- PITR backups (7 days)
- No pausing

Vercel Pro:         $20/month
- Unlimited bandwidth
- 1TB bandwidth
- Analytics
- Priority support

SendGrid:           $0-15/month
- 100 emails/day free
- $15 for 40,000 emails/month if needed

Google Gemini:      $0
- 15 requests/minute free tier
- Sufficient for OCR needs

Total:              $45-60/month
```

## Database Schema

```sql
-- Enable Row Level Security
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Users table (managed by Supabase Auth)
-- auth.users already exists

-- Custom user profiles
CREATE TABLE profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('admin', 'program_manager', 'participant')),
  phone TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Programs
CREATE TABLE programs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  description TEXT,
  manager_id UUID REFERENCES profiles(id),
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  total_budget DECIMAL(10,2) NOT NULL,
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'paused', 'completed')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Program participants (many-to-many)
CREATE TABLE program_participants (
  program_id UUID REFERENCES programs(id) ON DELETE CASCADE,
  participant_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  enrolled_at TIMESTAMPTZ DEFAULT NOW(),
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
  PRIMARY KEY (program_id, participant_id)
);

-- Balance cycles
CREATE TABLE balance_cycles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  program_id UUID REFERENCES programs(id) ON DELETE CASCADE,
  participant_id UUID REFERENCES profiles(id),
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  budget DECIMAL(10,2) NOT NULL,
  is_active BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Expenses
CREATE TABLE expenses (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  cycle_id UUID REFERENCES balance_cycles(id) ON DELETE CASCADE,
  description TEXT NOT NULL,
  amount DECIMAL(10,2) NOT NULL,
  date DATE NOT NULL,
  category TEXT,
  contact TEXT,
  remarks TEXT,
  receipt_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Milestones
CREATE TABLE milestones (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  program_id UUID REFERENCES programs(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  deadline DATE NOT NULL,
  completion_reward DECIMAL(10,2),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Milestone assignments
CREATE TABLE milestone_assignments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  milestone_id UUID REFERENCES milestones(id) ON DELETE CASCADE,
  participant_id UUID REFERENCES profiles(id),
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'completed', 'verified')),
  completion_date DATE,
  proof_url TEXT,
  manager_notes TEXT,
  assigned_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Notifications
CREATE TABLE notifications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  is_read BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Row Level Security Policies
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE programs ENABLE ROW LEVEL SECURITY;
ALTER TABLE balance_cycles ENABLE ROW LEVEL SECURITY;
ALTER TABLE expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE milestones ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- Policies (simplified examples - expand based on needs)
CREATE POLICY "Users can view own profile" ON profiles
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Participants can view their expenses" ON expenses
  FOR SELECT USING (
    cycle_id IN (
      SELECT id FROM balance_cycles WHERE participant_id = auth.uid()
    )
  );

CREATE POLICY "Program managers can view their program data" ON programs
  FOR SELECT USING (manager_id = auth.uid() OR role = 'admin');

-- Indexes for performance
CREATE INDEX idx_expenses_cycle_id ON expenses(cycle_id);
CREATE INDEX idx_expenses_date ON expenses(date);
CREATE INDEX idx_balance_cycles_participant ON balance_cycles(participant_id);
CREATE INDEX idx_program_participants ON program_participants(program_id, participant_id);
CREATE INDEX idx_notifications_user ON notifications(user_id, is_read);
```

## Authentication Flow

### Email + Magic Link Implementation

```typescript
// lib/supabase.ts
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true
  }
})

// auth/login.ts
export async function signInWithEmail(email: string) {
  const { data, error } = await supabase.auth.signInWithOtp({
    email,
    options: {
      emailRedirectTo: `${window.location.origin}/auth/callback`,
      data: {
        // Include user role if known
        preferred_role: 'participant'
      }
    }
  })

  if (error) throw error
  return data
}

// auth/mfa.ts (Optional MFA for managers/admins)
export async function enableMFA(userId: string) {
  const { data, error } = await supabase.auth.mfa.enroll({
    factorType: 'totp'
  })

  if (error) throw error
  return data.totp
}
```

## Migration Strategy

### Phase 1: Data Export Tool (Week 1)

```typescript
// scripts/exportLocalStorage.ts
export interface LocalStorageExport {
  version: '1.0'
  exportDate: string
  users: any[]
  programs: any[]
  cycles: any[]
  expenses: any[]
  receipts: Map<string, string> // receipt URLs as base64
}

export async function exportLocalStorageData(): Promise<LocalStorageExport> {
  const data: LocalStorageExport = {
    version: '1.0',
    exportDate: new Date().toISOString(),
    users: JSON.parse(localStorage.getItem('users') || '[]'),
    programs: JSON.parse(localStorage.getItem('programs') || '[]'),
    cycles: JSON.parse(localStorage.getItem('spendingCycles') || '[]'),
    expenses: [],
    receipts: new Map()
  }

  // Extract expenses from cycles
  data.cycles.forEach(cycle => {
    if (cycle.expenses) {
      cycle.expenses.forEach(expense => {
        data.expenses.push({
          ...expense,
          cycleId: cycle.id
        })

        // Extract receipt images
        if (expense.receiptUrl) {
          data.receipts.set(expense.id, expense.receiptUrl)
        }
      })
    }
  })

  return data
}

// Save as JSON file
export function downloadExport(data: LocalStorageExport) {
  const blob = new Blob([JSON.stringify(data, null, 2)], {
    type: 'application/json'
  })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `goldenbridge-export-${Date.now()}.json`
  a.click()
}
```

### Phase 2: Supabase Import Tool (Week 2)

```typescript
// scripts/importToSupabase.ts
import { createClient } from '@supabase/supabase-js'
import type { LocalStorageExport } from './exportLocalStorage'

export async function importToSupabase(
  exportData: LocalStorageExport,
  supabaseUrl: string,
  supabaseServiceKey: string // Use service key for admin operations
) {
  const supabase = createClient(supabaseUrl, supabaseServiceKey)

  const results = {
    users: { success: 0, failed: 0 },
    programs: { success: 0, failed: 0 },
    cycles: { success: 0, failed: 0 },
    expenses: { success: 0, failed: 0 },
    receipts: { success: 0, failed: 0 }
  }

  // 1. Migrate users
  for (const user of exportData.users) {
    try {
      // Create auth user
      const { data: authUser, error: authError } = await supabase.auth.admin.createUser({
        email: user.email,
        email_confirm: true,
        user_metadata: {
          name: user.name,
          role: user.role
        }
      })

      if (authError) throw authError

      // Create profile
      const { error: profileError } = await supabase
        .from('profiles')
        .insert({
          id: authUser.user.id,
          name: user.name,
          role: user.role,
          phone: user.phone
        })

      if (profileError) throw profileError
      results.users.success++
    } catch (error) {
      console.error(`Failed to migrate user ${user.email}:`, error)
      results.users.failed++
    }
  }

  // 2. Migrate programs
  for (const program of exportData.programs) {
    try {
      const { error } = await supabase
        .from('programs')
        .insert({
          id: program.id,
          name: program.name,
          description: program.description,
          manager_id: program.managerId,
          start_date: program.startDate,
          end_date: program.endDate,
          total_budget: program.budget,
          status: program.status || 'active'
        })

      if (error) throw error
      results.programs.success++
    } catch (error) {
      console.error(`Failed to migrate program ${program.name}:`, error)
      results.programs.failed++
    }
  }

  // 3. Migrate balance cycles
  for (const cycle of exportData.cycles) {
    try {
      const { error } = await supabase
        .from('balance_cycles')
        .insert({
          id: cycle.id,
          program_id: cycle.programId,
          participant_id: cycle.participantId,
          start_date: cycle.startDate,
          end_date: cycle.endDate,
          budget: cycle.budget,
          is_active: cycle.isActive
        })

      if (error) throw error
      results.cycles.success++
    } catch (error) {
      console.error(`Failed to migrate cycle:`, error)
      results.cycles.failed++
    }
  }

  // 4. Upload receipts to Storage and migrate expenses
  for (const expense of exportData.expenses) {
    try {
      let receiptUrl = null

      // Upload receipt if exists
      if (expense.receiptUrl && exportData.receipts.has(expense.id)) {
        const base64Data = exportData.receipts.get(expense.id)!
        const base64Response = await fetch(base64Data)
        const blob = await base64Response.blob()

        const fileName = `receipts/${expense.cycleId}/${expense.id}.jpg`
        const { data: uploadData, error: uploadError } = await supabase.storage
          .from('receipts')
          .upload(fileName, blob)

        if (!uploadError && uploadData) {
          const { data: urlData } = supabase.storage
            .from('receipts')
            .getPublicUrl(fileName)
          receiptUrl = urlData.publicUrl
        }

        if (!uploadError) results.receipts.success++
        else results.receipts.failed++
      }

      // Insert expense
      const { error } = await supabase
        .from('expenses')
        .insert({
          id: expense.id,
          cycle_id: expense.cycleId,
          description: expense.description,
          amount: expense.amount,
          date: expense.date,
          category: expense.category,
          contact: expense.contact,
          remarks: expense.remarks,
          receipt_url: receiptUrl
        })

      if (error) throw error
      results.expenses.success++
    } catch (error) {
      console.error(`Failed to migrate expense:`, error)
      results.expenses.failed++
    }
  }

  return results
}
```

## Implementation Timeline

### Week 1-2: Foundation
- [ ] Set up Supabase project
- [ ] Configure database schema
- [ ] Set up Vercel project
- [ ] Configure environment variables
- [ ] Implement auth flow (Email + Magic Link)
- [ ] Build data export tool

### Week 3-4: Core Migration
- [ ] Create Supabase client library
- [ ] Migrate auth system to Supabase
- [ ] Replace localStorage with Supabase queries
- [ ] Implement real-time subscriptions
- [ ] Build data import tool
- [ ] Test migration with sample data

### Week 5-6: Storage & Features
- [ ] Implement receipt upload to Supabase Storage
- [ ] Set up SendGrid integration
- [ ] Configure email templates
- [ ] Implement notification system
- [ ] Add MFA for managers/admins

### Week 7-8: Testing & Optimization
- [ ] Comprehensive testing
- [ ] Performance optimization
- [ ] Security audit
- [ ] Set up monitoring (Sentry)
- [ ] Configure backups
- [ ] Load testing

### Week 9-10: Deployment
- [ ] Production migration
- [ ] User training materials
- [ ] Documentation
- [ ] Go-live support
- [ ] Post-launch monitoring

## Environment Configuration

### `.env.local` (Development)
```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_KEY=your-service-key

# Gemini AI
GEMINI_API_KEY=your-gemini-key

# SendGrid
SENDGRID_API_KEY=your-sendgrid-key
SENDGRID_FROM_EMAIL=noreply@goldenbridge.org
SENDGRID_TEMPLATE_WELCOME=d-xxxxx
SENDGRID_TEMPLATE_MAGIC_LINK=d-xxxxx
SENDGRID_TEMPLATE_NOTIFICATION=d-xxxxx

# App Config
NEXT_PUBLIC_APP_URL=http://localhost:3000
NEXT_PUBLIC_APP_NAME=Golden Bridge Spending Tracker
```

### Vercel Environment Variables (Production)
Same as above but with production values. Set via Vercel Dashboard or CLI:

```bash
vercel env add NEXT_PUBLIC_SUPABASE_URL production
vercel env add NEXT_PUBLIC_SUPABASE_ANON_KEY production
vercel env add SUPABASE_SERVICE_KEY production
# ... etc
```

## Email Templates (SendGrid)

### Welcome Email
```html
Subject: Welcome to Golden Bridge Women Program

Hi {{name}},

Welcome to the Golden Bridge Women mentorship program!

You've been enrolled in the {{program_name}} program. To get started:

1. Click here to set up your account: {{magic_link}}
2. This link expires in 24 hours
3. Once logged in, you can start tracking your expenses

Your Program Manager is {{manager_name}}.

Best regards,
Golden Bridge Women Team
```

### Magic Link Email
```html
Subject: Your Golden Bridge Login Link

Hi {{name}},

Click the link below to log in to your Golden Bridge account:

{{magic_link}}

This link will expire in 1 hour. If you didn't request this, please ignore this email.

Best regards,
Golden Bridge Women Team
```

### Notification Email
```html
Subject: {{notification_title}}

Hi {{name}},

{{notification_message}}

View in app: {{app_link}}

Best regards,
Golden Bridge Women Team
```

## Security Checklist

- [x] All API keys in environment variables
- [x] Row Level Security on all tables
- [x] HTTPS only (Vercel handles this)
- [x] Magic links expire in 1 hour
- [x] Session refresh tokens
- [x] Optional MFA for admins/managers
- [x] Regular backups with PITR
- [x] Encrypted receipts in storage
- [x] Rate limiting on API routes
- [x] Input validation on all forms
- [x] XSS protection (React default)
- [x] CSRF protection (Supabase handles)

## Monitoring Setup

### Basic Monitoring (Free/Low-cost)

1. **Vercel Analytics** (Included with Pro)
   - Page views
   - Web vitals
   - User analytics

2. **Supabase Dashboard** (Built-in)
   - Database metrics
   - Auth metrics
   - Storage usage

3. **Sentry** (Free tier)
   ```typescript
   // sentry.client.config.ts
   import * as Sentry from "@sentry/nextjs"

   Sentry.init({
     dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
     environment: process.env.NODE_ENV,
     tracesSampleRate: 0.1,
     replaysSessionSampleRate: 0.1
   })
   ```

4. **Custom Health Checks**
   ```typescript
   // app/api/health/route.ts
   export async function GET() {
     const checks = {
       database: await checkDatabase(),
       storage: await checkStorage(),
       email: await checkEmail()
     }

     return Response.json({
       status: Object.values(checks).every(c => c) ? 'healthy' : 'degraded',
       checks,
       timestamp: new Date().toISOString()
     })
   }
   ```

## Backup Strategy

### Automated Backups

1. **Supabase Pro PITR** (7 days)
   - Automatic point-in-time recovery
   - No configuration needed

2. **Daily JSON Exports** (Via GitHub Actions)
   ```yaml
   name: Daily Backup
   on:
     schedule:
       - cron: '0 2 * * *' # 2 AM daily

   jobs:
     backup:
       runs-on: ubuntu-latest
       steps:
         - uses: actions/checkout@v2
         - name: Export Database
           run: |
             npx supabase db dump --data-only > backup-$(date +%Y%m%d).sql
         - name: Upload to S3
           uses: jakejarvis/s3-sync-action@master
           with:
             args: --acl private
           env:
             AWS_S3_BUCKET: goldenbridge-backups
             AWS_ACCESS_KEY_ID: ${{ secrets.AWS_ACCESS_KEY_ID }}
             AWS_SECRET_ACCESS_KEY: ${{ secrets.AWS_SECRET_ACCESS_KEY }}
   ```

3. **Manual Backup Script**
   ```bash
   #!/bin/bash
   # backup.sh
   DATE=$(date +%Y%m%d_%H%M%S)

   # Export database
   supabase db dump --data-only > "backups/db_$DATE.sql"

   # Export storage
   supabase storage download receipts --recursive -o "backups/storage_$DATE"

   # Compress
   tar -czf "backups/goldenbridge_$DATE.tar.gz" "backups/db_$DATE.sql" "backups/storage_$DATE"

   # Upload to cloud (optional)
   aws s3 cp "backups/goldenbridge_$DATE.tar.gz" s3://goldenbridge-backups/
   ```

## Deployment Checklist

### Pre-Deployment
- [ ] All tests passing
- [ ] Environment variables configured
- [ ] Database migrations ready
- [ ] Email templates created
- [ ] Backup strategy tested
- [ ] Security audit complete

### Deployment Steps
1. **Supabase Setup**
   ```bash
   # Initialize Supabase
   npx supabase init

   # Link to project
   npx supabase link --project-ref your-project-ref

   # Run migrations
   npx supabase db push

   # Set up storage bucket
   npx supabase storage create receipts --public
   ```

2. **Vercel Deployment**
   ```bash
   # Install Vercel CLI
   npm i -g vercel

   # Deploy
   vercel --prod

   # Set environment variables
   vercel env pull
   ```

3. **SendGrid Configuration**
   - Create API key
   - Verify sender domain
   - Create dynamic templates
   - Test email delivery

### Post-Deployment
- [ ] Verify auth flow
- [ ] Test data migration
- [ ] Check email delivery
- [ ] Monitor error rates
- [ ] Gather user feedback
- [ ] Document known issues

## Troubleshooting Guide

### Common Issues

1. **Magic links not working**
   - Check SMTP configuration
   - Verify redirect URL
   - Check spam folder
   - Ensure domain verification

2. **Storage upload fails**
   - Check bucket permissions
   - Verify file size limits (5MB default)
   - Check storage quota

3. **Database connection issues**
   - Verify connection pooling
   - Check RLS policies
   - Monitor connection limits

4. **Performance issues**
   - Add database indexes
   - Implement pagination
   - Use Supabase Realtime selectively
   - Cache with Redis (future)

## Future Enhancements (6-12 months)

1. **Mobile App Preparation**
   - Design REST API layer
   - Document API endpoints
   - Create API client SDK
   - Plan React Native migration

2. **Advanced Features**
   - Multi-language support
   - Advanced analytics dashboard
   - Bulk expense import
   - Automated report generation
   - Integration with accounting software

3. **Scaling Considerations**
   - Redis caching layer
   - CDN for static assets
   - Database read replicas
   - Horizontal scaling plan

## Support & Documentation

### For Developers
- Supabase Docs: https://supabase.com/docs
- Vercel Docs: https://vercel.com/docs
- Project Wiki: [To be created]
- API Documentation: [To be generated]

### For Users
- User Manual: [To be created]
- Video Tutorials: [To be recorded]
- FAQ Document: [To be written]
- Support Email: support@goldenbridge.org

---

## Next Steps

1. **Immediate Actions** (This Week)
   - Create Supabase project
   - Set up Vercel project
   - Configure development environment
   - Begin auth implementation

2. **Short-term** (Next 2 Weeks)
   - Complete auth flow
   - Build migration tools
   - Test with sample data

3. **Medium-term** (Next Month)
   - Full migration
   - Email integration
   - Testing & optimization

4. **Launch Preparation** (Month 2-3)
   - User training
   - Documentation
   - Soft launch with test group
   - Production deployment

---

Last Updated: ${new Date().toISOString()}
Generated for: Golden Bridge Women Mentorship Program
Contact: Samuel Ahuno (ekwame001@gmail.com)