## Scope
Fix the blocking `.env` parse error, then execute the four cleanup + feature steps you approved. Ordered so each build passes before the next change.

## Step 0 — Fix `.env` (blocks build)
Line 7 has a trailing semicolon:
```
LOVABLE_API_KEY="...GLw";
```
Rewrite as `LOVABLE_API_KEY=...GLw` (no quotes, no semicolon). Nothing else in `.env` changes.

## Step 1 — Consolidate XP modules + drop redundant migration
**Current tangle** (from a repo audit):
- `src/lib/xp.ts` — uppercase `XP_RULES`, older API; used by `achievements.ts`, `habit-stats.ts`, `checkin.ts`, `home.tsx` (`awardSundayPlanningXP`), `profile.tsx` (`getTotalXP`, `getLevelTitle`), and dynamic `await import("./xp")` inside `gym.functions.ts` (2 sites).
- `src/lib/xp.functions.ts` — lowercase `XP_REWARDS`, newer API; used by top-level `gym.functions.ts` import.
- `src/lib/xp-config.ts` — the config module already exists.

**Plan (single source of truth = `xp-config.ts` + `xp.functions.ts`):**
1. Extend `src/lib/xp-config.ts`:
   - Add `LEVEL_TITLES` and `getLevelTitle(level)` (currently only in `xp.ts`).
   - Add a legacy-key adapter map so `WORKOUT_COMPLETE → workout_complete`, `GYM_CHECKIN → gym_checkin`, etc. (used only during migration).
2. Extend `src/lib/xp.functions.ts`:
   - Add `getTotalXP` server fn + `getTotalXPInternal(supabase, userId)` helper.
   - Add `awardSundayPlanningXP` server fn (port the ISO-week dedupe from `xp.ts` verbatim, calling `awardXPInternal` with `reason: "sunday_planning"` and `dedupeKey`).
   - Add `getWeeklyXP` server fn (port the per-day bucket logic from `xp.ts`).
   - Re-export `getLevelTitle`, `getLevelProgress`, `XP_REWARDS`.
3. Rewrite the five call sites to import from `@/lib/xp.functions` / `@/lib/xp-config`:
   - `src/lib/achievements.ts` — `getTotalXPInternal` from `xp.functions`.
   - `src/lib/habit-stats.ts` — `getTotalXPInternal`, `getLevelProgress`, `getLevelTitle`.
   - `src/lib/checkin.ts` — `awardXPInternal` + rename `XP_RULES.GYM_CHECKIN` → `XP_REWARDS.gym_checkin`; call `awardXPInternal(supabase, userId, { reason: "gym_checkin", dedupeKey })`.
   - `src/routes/_authenticated/profile.tsx` — `getTotalXP`, `getLevelTitle`.
   - `src/routes/_authenticated/home.tsx` — `awardSundayPlanningXP`.
4. Rewrite the two dynamic imports in `src/lib/gym.functions.ts` (`await import("./xp")`) to use `awardXPInternal` from `./xp.functions` with the new lowercase reason enum. Keep the existing dedupe keys.
5. Delete `src/lib/xp.ts`.
6. Migration cleanup: `20260703000001_v4_habit_engine.sql` and `20260704021253_...sql` both `CREATE TABLE public.xp_transactions`. Since the DB already has the table (per audit), I'll open a new migration that makes both idempotent — `CREATE TABLE IF NOT EXISTS`, `CREATE POLICY IF NOT EXISTS`, `CREATE INDEX IF NOT EXISTS` — by editing the newer file (`20260704021253`) to `IF NOT EXISTS` form so a fresh DB replay succeeds. Do not delete either migration file (history is immutable in this project).

**Verification:** `rg "from ['\"]@?/?\.?/?lib/xp['\"]"` returns 0 hits; `rg "XP_RULES"` returns 0 hits; typecheck passes.

## Step 2 — Phase 5: Habit Dashboard on Home
Home (`src/routes/_authenticated/home.tsx`, 740 lines) currently uses the existing dark-glass card system. Additive only — no redesign.

**New file:** `src/components/HabitDashboardCard.tsx` — one card that renders:
- Current Level + `getLevelTitle` chip.
- XP progress bar (`pct` from `getLevelProgress`) with `xpIntoLevel / xpForNextLevel` label.
- Weekly XP total and a 7-bar mini graph (reuse `getWeeklyXP.days`).
- Today's Habit Score (0–100) from `habit-score.ts`.
- Recent achievements strip (top 3 from `achievements.ts`, already in project).

**Wiring:** Add one `useQuery` hook in `home.tsx` fetching a new consolidated server fn `getHabitDashboard` (in `src/lib/habit-stats.ts` or new `src/lib/dashboard.functions.ts`) that returns `{ level, title, pct, xpIntoLevel, xpForNextLevel, weeklyXP, days, habitScore, recentAchievements }`. Single round-trip; keeps UI dumb.

Placement: insert `<HabitDashboardCard/>` at the top of the existing hero section on Home, above whatever is already rendered. No changes to nav, other cards, or styles.

**Verification:** Home renders with new card; Playwright screenshot at 390×844; no console errors; existing Home features intact.

## Step 3 — Phase 7: Trigger Engine
**Schema migration** (new file) — extends `profiles` (Cloud rule: same file has GRANTs/policies already; only ADD COLUMN here):
```sql
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS preferred_workout_time time,
  ADD COLUMN IF NOT EXISTS workout_days text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS timezone text,
  ADD COLUMN IF NOT EXISTS reminder_enabled boolean NOT NULL DEFAULT true;
```
No new tables; RLS on `profiles` already applies.

**Onboarding UI** (`src/routes/_authenticated/onboarding.tsx`, 194 lines):
- Add three fields (time picker, day multi-select `Mon…Sun`, timezone — default `Intl.DateTimeFormat().resolvedOptions().timeZone`).
- Persist through the existing `saveProfile` server fn — extend its `zod` schema in `gym.functions.ts` to accept the new fields.

**Notification scheduling** (uses existing `push.functions.ts` + `push-sw.js`):
- New route `src/routes/api/public/hooks/send-daily-reminder.ts` already exists — audit and extend so it:
  - Runs hourly via `pg_cron`.
  - For each user whose `preferred_workout_time` is within the next hour on a `workout_days` weekday (respecting `timezone`), enqueues a push with title "Workout in 30 min".
  - For each user with no `exercise_logs` for 24h on a scheduled day, enqueues a "You missed today's workout" push.
  - For each user with no activity for 3d / 7d / 14d, enqueues the Recovery / Restart / Fresh Week variants (copy from Habit Formation PRD).
- Add pg_cron entry via the insert tool (not migration, per Cloud rules): hourly POST to `/api/public/hooks/send-daily-reminder` with `apikey` header.

**Verification:** New profile columns visible; onboarding form saves; `curl` the reminder endpoint locally and confirm it selects the right users (log-only in a test flag). Cron entry appears in `cron.job`.

## Step 4 — Phase 18: Refactor (residual)
After Step 1 the biggest duplication is gone. Remaining refactor items:
- Move dedupe-key generators (`workout_day:*`, `week_review:*`, `profile:*`, `SUNDAY_PLANNING:YYYY-Www`) into `src/lib/xp-config.ts` as pure helpers `dedupeKeys.workoutDay(id)` etc., so every call site (gym, home, checkin) uses the same generator.
- Extract the 10% surprise bonus & idempotency logic already in `awardXPInternal` into a small documented "Reward Engine" section header in `xp.functions.ts` (comments only — no logic change) so future engines (Achievement, Habit) sit next to it.
- Leave `habit-score.ts` and `achievements.ts` in place; already server-side and single-purpose.

No new tests in this pass (Phase 19 is deferred).

## Files touched
- **Fix:** `.env` (single line).
- **New:** `src/components/HabitDashboardCard.tsx`, `src/lib/dashboard.functions.ts`, one Supabase migration for profile columns, one migration making `xp_transactions` creation idempotent.
- **Edited:** `src/lib/xp-config.ts`, `src/lib/xp.functions.ts`, `src/lib/gym.functions.ts`, `src/lib/achievements.ts`, `src/lib/habit-stats.ts`, `src/lib/checkin.ts`, `src/routes/_authenticated/profile.tsx`, `src/routes/_authenticated/home.tsx`, `src/routes/_authenticated/onboarding.tsx`, `src/routes/api/public/hooks/send-daily-reminder.ts`.
- **Deleted:** `src/lib/xp.ts`.

## Non-goals
No UI redesign, no changes to workout generation, diet, calendar, weekly-review flows, achievement badge visuals, offline support (Phase 12), segmentation (Phase 14), tests (Phase 19), or the four AI helpers. Nothing outside the four steps above.
