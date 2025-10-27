# Vercel Deployment Setup Guide

## 🎉 Deployment Successful!

Your app is now live at:
**https://goldenbridgespendingtracker-irinq41c8-samuel-ahunos-projects.vercel.app**

However, you need to set environment variables for full functionality.

---

## Step 1: Set Environment Variables in Vercel

### Option A: Via Vercel Dashboard (Recommended)

1. Go to: https://vercel.com/samuel-ahunos-projects/golden_bridge_spending_tracker/settings/environment-variables

2. Add the following environment variables:

| Variable Name | Value | Environment |
|--------------|-------|-------------|
| `VITE_SUPABASE_URL` | `https://uedwlvucyyxjenoggpwu.supabase.co` | Production, Preview, Development |
| `VITE_SUPABASE_ANON_KEY` | `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...` (from .env.local) | Production, Preview, Development |
| `NEXT_PUBLIC_SUPABASE_URL` | `https://uedwlvucyyxjenoggpwu.supabase.co` | Production, Preview, Development |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...` (from .env.local) | Production, Preview, Development |
| `GEMINI_API_KEY` | Your Gemini API key | Production, Preview, Development |

3. Click **"Save"** after each variable

### Option B: Via Vercel CLI (Faster)

```bash
# Set Supabase URL
vercel env add VITE_SUPABASE_URL production
# Paste: https://uedwlvucyyxjenoggpwu.supabase.co

# Set Supabase Anon Key
vercel env add VITE_SUPABASE_ANON_KEY production
# Paste your anon key from .env.local

# Set Next.js compatible variables
vercel env add NEXT_PUBLIC_SUPABASE_URL production
# Paste: https://uedwlvucyyxjenoggpwu.supabase.co

vercel env add NEXT_PUBLIC_SUPABASE_ANON_KEY production
# Paste your anon key from .env.local

# Set Gemini API key
vercel env add GEMINI_API_KEY production
# Paste your Gemini key from .env.local
```

---

## Step 2: Redeploy to Apply Environment Variables

After setting environment variables, redeploy:

```bash
vercel --prod
```

Or click **"Redeploy"** in the Vercel dashboard.

---

## Step 3: Test Your Live App

Once redeployed, test these features:

### 1. **Authentication Test**
- Go to your production URL
- Try signing up with a test account
- Verify email confirmation works
- Test login

### 2. **Database Test**
- After login, create a test expense
- Check if data appears in Supabase Table Editor
- Verify RLS policies work (users can only see their data)

### 3. **Receipt OCR Test**
- Upload a receipt image
- Test if Gemini AI extracts expense data

---

## Step 4: Configure Custom Domain (Optional)

1. Go to: https://vercel.com/samuel-ahunos-projects/golden_bridge_spending_tracker/settings/domains

2. Add your custom domain:
   - Example: `app.goldenbridge.org`
   - Or: `tracker.goldenbridge.org`

3. Follow Vercel's DNS configuration instructions

4. Update Supabase auth redirect URLs:
   - Go to: https://app.supabase.com/project/uedwlvucyyxjenoggpwu/auth/url-configuration
   - Add your custom domain to **Redirect URLs**

---

## Troubleshooting

### Issue: "Missing environment variables" error
**Solution**: Ensure all environment variables are set in Vercel dashboard

### Issue: Authentication not working
**Solution**:
1. Check Supabase credentials in Vercel environment variables
2. Verify Supabase project is active
3. Check browser console for errors

### Issue: Can't see data after login
**Solution**:
1. Check RLS policies in Supabase
2. Verify user has a profile in `profiles` table
3. Check browser console for API errors

### Issue: Receipt OCR not working
**Solution**:
1. Verify `GEMINI_API_KEY` is set in Vercel
2. Check Gemini API quota
3. Ensure API key has correct permissions

---

## Monitoring Your Deployment

### View Logs
```bash
vercel logs https://goldenbridgespendingtracker-irinq41c8-samuel-ahunos-projects.vercel.app
```

### Check Build Status
https://vercel.com/samuel-ahunos-projects/golden_bridge_spending_tracker

### View Analytics
https://vercel.com/samuel-ahunos-projects/golden_bridge_spending_tracker/analytics

---

## Next Steps

1. ✅ Set environment variables
2. ✅ Redeploy
3. ✅ Test authentication
4. ✅ Create test users in production
5. ✅ Verify RLS policies work
6. 🔄 Configure custom domain (optional)
7. 🔄 Set up SendGrid for email notifications

---

## Production URLs

- **Live App**: https://goldenbridgespendingtracker-irinq41c8-samuel-ahunos-projects.vercel.app
- **Vercel Dashboard**: https://vercel.com/samuel-ahunos-projects/golden_bridge_spending_tracker
- **Supabase Dashboard**: https://app.supabase.com/project/uedwlvucyyxjenoggpwu

---

## Emergency Rollback

If something goes wrong:

```bash
# View deployment history
vercel ls

# Rollback to previous deployment
vercel rollback [deployment-url]
```

---

Last Updated: 2025-10-26
