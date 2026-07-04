## Fix QA bugs from 4 Jul report

Targeted fixes for the QA-reported bugs. No schema changes.

### BUG-002 · /auth hydration mismatch (Critical)
File: `src/routes/auth.tsx`
- Default `mode` state to `"signin"` so the initial React render matches the SSR shell and the visible "Sign in" button actually calls `signInWithPassword`.
- Keep the "New here? Create account" toggle so signup is still one tap away.

### BUG-005 / 006 / 008 · Calendar rolling-week desync (High, shared root)
File: `src/routes/_authenticated/calendar.tsx`
Move the Week view off Monday-anchored math and onto `weeks.start_date`:
- Delete `startOfWeekMon` usage in `WeekStrip`, `WeeklyProgressCard`, and `weekStartMap`.
- Pass the active week's `start_date` (parsed as local midnight) as the strip anchor; render 7 cells = `start_date + 0..6`.
- Day labels: derive `Mon/Tue/…` per cell from the actual date (`weekdayShort(iso)`), not the fixed `DAY_SHORT` array.
- `WeeklyProgressCard`: compute scheduled/completed against the same rolling 7-day window (start_date..+6), so Home and Calendar always agree.
- On mount / week change, set `selected = today` when today falls inside the active week's window; otherwise `selected = start_date`. Fixes today being outside the visible strip.
- Month view: leave the grid Monday-anchored (calendar grids are conventionally Mon-first), but continue keying workout dots off `dateToDay` (already rolling-week correct).
- `SelectedDayPanel` diet offset already uses `weekStartDate`; leave as-is.

### BUG-015 · Meal calorie totals disagree Home / Diet / Calendar (High)
Root cause: Home reads `dietStats` from `activeWeek.diet_json` (raw, possibly stale/legacy old-format), while Diet/Calendar call `getWeekDiet` which returns the up-to-date 7-day JSON.
- Home (`src/routes/_authenticated/home.tsx`): fetch the active week's diet via `getWeekDiet({ weekId: activeWeek.id })` with `useQuery(["weekDiet", activeWeek.id])` (same key Diet uses — cache is shared). Feed its `days[dietIndexForToday(start_date)].totalApproxCalories` into the Calories metric card. Fall back to legacy `daily_calories` only when the fetched diet is not the 7-day format.
- Calendar `SelectedDayPanel` meals list: it currently shows `meal.items.slice(0,3)` as a preview which can look different from Diet's full list. Change to show the full items list (same as Diet's `MealCard`) so the day content matches Diet exactly.

### BUG-003 · Home plan-description truncates mid-word (High)
File: `src/routes/_authenticated/home.tsx` (`focus-pill` line ~467)
- Replace `activeWeek.plan_summary?.slice(0, 38)` with a word-boundary truncation helper (cut at last space ≤ 60 chars, append `…`). Also add `max-w-full break-words` classes so long summaries wrap gracefully instead of being sliced.

### BUG-011 · "Longest: 1 days" (Medium)
File: `src/routes/_authenticated/home.tsx` (streak subtitle line ~343)
- Use a `pluralize(n, "day")` helper → `"1 day"`, `"2 days"`.

### BUG-012 · PERSONAL BEST badge always shown (Medium)
Same file, badge at line ~364.
- Only render when `stats.currentStreak > 0 && stats.currentStreak === stats.longestStreak`.

### BUG-021 · "At Risk" defaulted on for brand-new users (Medium)
File: `src/routes/_authenticated/home.tsx` — Habit segment pill (line ~469 and elsewhere).
- Guard segment display: if `stats.habitScore === 0` AND user has zero completed workouts (`stats.lastWorkoutAt == null`), suppress the "At Risk" pill and show the neutral "Building" state (or nothing).

### BUG-028 · "1 REVIEWS DONE" (Cosmetic)
- Grep for the string and swap to `pluralize(n, "review")`. Likely in `src/routes/_authenticated/profile.tsx`.

### Shared utility
Add a tiny `src/lib/format.ts` exporting:
- `pluralize(n, singular, plural?)` → `"1 day"` / `"2 days"`
- `truncateWords(str, max)` → cuts on last whitespace ≤ max, appends `…`

### Not in scope
- No DB migration, no server-function signature changes.
- BUG-001 (overweight4 diet stuck loading) is data-shaped and outside this fix batch — will be triaged separately after these ship.

### Verification
- Playwright: sign in as `Overweight@gmail.com`, confirm "Sign in" button submits without a 422 in Network tab.
- On Home + Calendar for the active week, assert the "Weekly progress" counter matches and today's cell is visible in the strip.
- Home Calories card matches Diet's today total for accounts `overweight3`, `overweight6`.
- Streak subtitle reads "1 day" for a 1-day streak; PERSONAL BEST hidden at streak 0.
