---
date: 2026-07-12 08:55:26 -0400
topic: outstanding items and pre-launch risks assessment
cwd: /Users/ahunos/myWork/golden_bridge_spending_tracker
source: save-last (previous assistant turn)
---

# outstanding items and pre-launch risks assessment

Honest answer: the tracker is green, but "the checklist is done" isn't the same as "safe for real users." Thinking about what actually protects *you*, here's what I'd be focused on — and I found something that reframes it.

**Reality check first: the app is essentially empty** — 8 profiles (mostly test), 2 programs, **0 expenses**, 5 milestones. So it's *launched but not actually used yet*. That's not a criticism; it's important, because it means the near-disaster so far cost you almost nothing, and the real stakes begin the moment people start entering financial data. So the right framing is a **pre-real-users checklist**, and two items on it matter a lot:

**1. The free-tier auto-pause will happen again — this is how you nearly lost it.** You're on Supabase Free. Free projects **pause after ~7 days of inactivity**, and with near-zero traffic, `rlqa` will pause, and the app goes down — exactly the original failure. On top of that, free tier has thin backup guarantees. This is the single most important thing, and it's a decision only you can make:
- **Upgrade to Pro ($25/mo)** → no auto-pause + daily backups (7-day retention). For a financial app you intend to run, I'd genuinely recommend this before onboarding anyone.
- Or a **keepalive** (a scheduled ping to keep it active) — I can set that up, but it's a band-aid and doesn't fix the backup gap.
- Or accept it and un-pause manually when needed — fine while it's just you testing.

**2. The core security property was never actually tested live.** Everything about this project was RLS — making sure participant A can't see participant B's financial data. But all my verification was typecheck + logic + isolated Postgres, and your smoke test was happy-path (*can I add an expense?*), not adversarial (*can I read someone else's?*). We never logged in as two different participants and confirmed the isolation holds on the live database. **For a financial app, that's the one thing worth proving before real money data goes in.** I can run that test right now with throwaway accounts (create two participants, sign in as each, confirm one literally cannot read the other's expenses/cycles/milestones) and clean them up after.

**3. A few things are deployed but never human-verified** — the milestone junction refactor (#3), and #6–#10 weren't in your smoke test. Lower priority; I can spot-check them.

**Minor:** the 4 `browser-*@example.com` test accounts are still there; and your `SUPABASE_DB_PASSWORD` + Gmail app password now live in `.env.local` on your laptop — keep that file safe (it's gitignored, but it's real secrets).

So, what I *should* be doing for you, in order:
1. **Run the adversarial RLS isolation test** — proves the whole security effort actually holds live. I'll do it and clean up. This is the one I'd act on immediately.
2. Help you **decide the free-tier pause/backup question** (I lean Pro before real users).

Want me to run the RLS isolation test now?
