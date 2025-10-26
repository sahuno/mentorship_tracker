# Mock Data Seeding Script

This directory contains scripts to populate the Golden Bridge Spending Tracker with realistic test data for development and testing purposes.

## Quick Start

### Option 1: Browser Console (Easiest)

1. **Start the development server:**
   ```bash
   npm run dev
   ```

2. **Open the app in your browser:**
   - Navigate to http://localhost:3001

3. **Open Browser DevTools:**
   - Press `F12` (Windows/Linux)
   - Press `Cmd + Option + I` (Mac)
   - Or right-click → "Inspect"

4. **Go to the Console tab**

5. **Copy and paste the entire contents of `seedMockData.js`**
   - Open `scripts/seedMockData.js`
   - Select all (Cmd+A / Ctrl+A)
   - Copy (Cmd+C / Ctrl+C)
   - Paste into the browser console
   - Press Enter

6. **Run the seeding function:**
   ```javascript
   seedMockData()
   ```

7. **Refresh the page** (F5 or Cmd+R)

8. **Login with test credentials** (see below)

---

## What Gets Created

### Users

**1 Admin:**
- Sarah Admin
- Email: `admin@goldenbridge.org`
- Password: `Admin123!`
- Access Code: `ADMIN2024`

**2 Program Managers:**

*Manager 1 - Emily*
- Name: Emily Program Manager
- Email: `emily.manager@goldenbridge.org`
- Password: `Manager123!`
- Access Code: `MANAGER2024`
- Manages: "Women in Tech Leadership 2025" program

*Manager 2 - Michael*
- Name: Michael Program Manager
- Email: `michael.manager@goldenbridge.org`
- Password: `Manager123!`
- Access Code: `MANAGER2024`
- Manages: "Entrepreneurship Accelerator" program

**5 Participants:**

All participants use password: `Participant123!`

1. Jessica Williams - `jessica.w@example.com`
   - Enrolled in: Tech Leadership program
   - Has: Spending cycle with expenses, assigned milestones

2. Maria Garcia - `maria.g@example.com`
   - Enrolled in: Tech Leadership program
   - Has: Spending cycle with expenses, assigned milestones

3. Aisha Johnson - `aisha.j@example.com`
   - Enrolled in: BOTH programs (great for testing!)
   - Has: Spending cycle with expenses, assigned milestones

4. Priya Patel - `priya.p@example.com`
   - Enrolled in: Entrepreneurship program
   - Has: Empty spending cycle

5. Sophia Chen - `sophia.c@example.com`
   - Enrolled in: Entrepreneurship program
   - Has: Empty spending cycle

### Programs

**Program 1: Women in Tech Leadership 2025**
- Manager: Emily
- Duration: January 1 - June 30, 2025
- Participants: Jessica, Maria, Aisha
- Status: Active

**Program 2: Entrepreneurship Accelerator**
- Manager: Michael
- Duration: February 1 - April 30, 2025
- Participants: Aisha, Priya, Sophia
- Status: Active

### Additional Data

- **Spending Cycles**: Created for all participants with $2,500 budget
- **Expenses**: 2-5 mock expenses for first 3 participants (books, courses, conferences, etc.)
- **Milestones**: 2 assigned milestones per participant in Program 1
- **Progress**: Some milestones marked as completed/in-progress

---

## Testing Scenarios

### Test Admin Features
1. Login as: `admin@goldenbridge.org / Admin123!`
2. Access code: `ADMIN2024`
3. You can:
   - View all programs
   - Create new programs
   - See all users
   - Access all features

### Test Program Manager Features

**Login as Emily:**
1. Email: `emily.manager@goldenbridge.org`
2. Password: `Manager123!`
3. Access code: `MANAGER2024`
4. Test:
   - View "Women in Tech Leadership 2025" program
   - See 3 assigned participants (Jessica, Maria, Aisha)
   - Assign milestones
   - View participant progress
   - Add/remove participants
   - Review financial data
   - Generate reports

**Login as Michael:**
1. Email: `michael.manager@goldenbridge.org`
2. Password: `Manager123!`
3. Access code: `MANAGER2024`
4. Test:
   - View "Entrepreneurship Accelerator" program
   - See 3 assigned participants (Aisha, Priya, Sophia)
   - All same features as Emily

### Test Participant Features

**Login as Jessica:**
1. Email: `jessica.w@example.com`
2. Password: `Participant123!`
3. Test:
   - View enrolled program (Tech Leadership)
   - See assigned milestones
   - Add expenses
   - Submit progress reports
   - View notifications

**Login as Aisha (Multi-Program):**
1. Email: `aisha.j@example.com`
2. Password: `Participant123!`
3. Test:
   - Switch between 2 programs
   - Different milestones per program
   - Program-specific data

---

## Clearing Test Data

If you want to start fresh:

1. **Option A: Run the script again**
   - The script will ask if you want to clear existing data
   - Click "OK" to clear, "Cancel" to keep

2. **Option B: Manual clearing**
   ```javascript
   // In browser console:
   Object.keys(localStorage)
     .filter(key => key.startsWith('gbw_'))
     .forEach(key => localStorage.removeItem(key));
   ```

3. **Option C: Clear all localStorage**
   - DevTools → Application tab → Storage → Local Storage
   - Right-click → Clear

---

## Customizing Mock Data

Edit `seedMockData.js` to customize:

- User names, emails, passwords
- Number of participants
- Program names and descriptions
- Milestone titles and categories
- Expense categories and amounts
- Budget amounts

After editing, re-run the script in the console.

---

## Troubleshooting

### "seedMockData is not defined"
- Make sure you copied the ENTIRE `seedMockData.js` file
- Check that you pressed Enter after pasting
- Try pasting again

### "Cannot read property of undefined"
- Clear localStorage and try again
- Refresh the page
- Make sure dev server is running

### Users not showing up after refresh
- Check browser console for errors
- Verify localStorage has `gbw_users_v2` key
- Try clearing data and re-seeding

### Login not working
- Double-check email and password (case-sensitive)
- Make sure you're using the correct access code for managers/admin
- Check console for authentication errors

---

## Production Note

⚠️ **IMPORTANT**: This mock data is for DEVELOPMENT/TESTING ONLY.

- DO NOT use these credentials in production
- DO NOT commit `.env.local` with real API keys
- All passwords here are simple for testing - use strong passwords in production
- Consider implementing a proper backend before production deployment

See `DEPLOYMENT_STRATEGY.md` for production deployment guidance.

---

## Questions?

If you encounter issues:
1. Check the browser console for errors
2. Verify the dev server is running
3. Try clearing localStorage and re-seeding
4. Check that you're using the latest version of the code

Happy testing! 🎉
