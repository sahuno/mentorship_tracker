# Repository Guidelines

## Project Structure & Module Organization
- `components/` contains React UI features (dashboards, modals, tab views) plus `icons/` and `tabs/` for shared pieces.
- `src/lib/` wraps Supabase setup and data helpers; keep new queries/controllers here so components stay declarative.
- `hooks/` and `utils/` host reusable state and domain helpers; extend them before adding ad-hoc logic.
- `supabase/` houses migrations/config, while `scripts/` and `docs/` provide SQL verification and deployment runbooks referenced by ops.

## Build, Test & Development Commands
- `npm install` — install dependencies after cloning or Node upgrades.
- `npm run dev` — Vite dev server with hot reload on port 5173.
- `npm run build` — generate production bundle in `dist/`; run before pushing release branches.
- `npm run preview` — serve the built bundle to spot prod-only issues.
- `npx supabase db diff` — confirm local schema aligns with the remote project prior to committing SQL changes.

## Coding Style & Naming Conventions
- TypeScript + React function components, 2-space indent, single quotes, trailing semicolons; prefer `const` and typed props.
- PascalCase component filenames (`ProgramManagerDashboard.tsx`), camelCase variables/functions, SCREAMING_SNAKE_CASE env vars.
- Keep view logic in `components/` and push data/side-effects into `src/lib/` or `utils/`; expand `types.ts` instead of introducing `any`.
- Share stateful patterns through hooks; wrap Supabase calls in typed helpers to centralize error handling.

## Testing Guidelines
- Follow `docs/TESTING_GUIDE.md` for Supabase checks; the Option 2 SQL script in `scripts/` is the baseline before merging schema work.
- Exercise affected screens via `npm run dev`, logging manual steps and screenshots in the PR until automated coverage exists.
- Record test Supabase outputs (table counts, policy checks) when touching migrations or auth flows.

## Commit & Pull Request Guidelines
- Mirror the Conventional Commit history (`feat:`, `fix:`, `chore:`) with scoped, atomic commits; include migration files with their schema helpers.
- PRs must outline intent, local test evidence, Supabase notes, and link related tasks or incidents; attach UI captures when UX shifts.
- Request owner review before merge and double-check that secrets (`.env.local`, dashboard captures) never enter version control.

## Environment & Security Notes
- Duplicate `.env.example` to `.env.local`, fill Supabase, Gemini, and SendGrid keys, and keep service keys off shared channels.
- Use `NEXT_PUBLIC_` only for client-safe values; rotate Supabase service keys after demos and prune obsolete env entries when branches close.
