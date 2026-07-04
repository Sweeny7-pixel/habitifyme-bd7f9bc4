# Rolling 7-day plan — implementation plan (v2)

## Change from v1

Adds an explicit **"When do you want to start?"** date-picker modal that opens right before the first plan is generated. Whatever date the user picks becomes `weeks.start_date` for Week 1; defaults to today. Every downstream date derives from it.

## Current state (audit)

- `weeks.start_date` exists (`date NOT NULL DEFAULT CURRENT_DATE`) but is **never explicitly set** on insert.
- `workout_days` has `day_index` (1..N) but **no `workout_date` column**.
- `weeks.diet_json` days carry a `"day": "Monday" | ... | "Sunday"` label; `diet.tsx` picks today via `getDay()`.
- `calendar.tsx` already derives dates from `start_date + (day_index - 1)`.
- Weekly-review cron fires for everyone at Sunday 15:30 UTC (Monday anchor).
- `xp.SUNDAY_PLANNING` is keyed on ISO week.

## Design decisions

1. **Source of truth = dates.** `weeks.start_date` + new `workout_days.workout_date`. `day_index` stays as relative 1..N. Weekday strings become display-only.
2. **Start date is user-chosen** (new). A modal collects it before every generate/regenerate. Default = today (IST). Min = today, Max = today + 14 days (guardrail — no back-dating history, no scheduling months out).
3. **Diet** stays as a 7-entry array on `weeks.diet_json`, indexed by position (`day_index` 1..7). Prompt/schema drops the weekday label.
4. **Backward compat.** Legacy weeks without `workout_date` render via `start_date + (day_index - 1)`. Legacy diets with `"day"` labels keep working because we index positionally.
5. **Week completion** already runs off `completed_at` count — no logic change; naturally becomes rolling.
6. **Weekly-review cron** filters recipients to `weeks WHERE status='active' AND start_date + 6 = today (IST)`.
7. **Sunday-planning XP** → `WEEK_PLANNING`, dedupe key `WEEK_PLANNING:<weekId>`.

## New: Start-date modal

- Component: `src/components/StartDateModal.tsx`. Shadcn `Dialog` + `Calendar` (`mode="single"`, `pointer-events-auto`).
- Copy: title *"When do you want to start?"*, sub *"Day 1 of your plan will be this date. You can start today or pick a day in the next two weeks."*, primary button *"Generate my plan"*, secondary *"Cancel"*.
- Default selected date: today (IST). `disabled`: dates before today or after today+14.
- Props: `open`, `onOpenChange`, `onConfirm(startDateIso: string)`, `busy: boolean` (spinner on the primary button while generation runs).
- Trigger points (three call sites, same modal):
  1. `onboarding.tsx` — after profile save, before the first `generateFourWeekPlan` call.
  2. `home.tsx` / plan page — the existing "Regenerate plan" button opens the modal instead of firing directly.
  3. `plan-week.tsx` (or wherever `generateWeek` is invoked) — same pattern.
- Server API: all three generators accept a new optional `startDate?: string` (ISO date). Missing → server uses today (IST). Present → server uses that date verbatim, validated `>= today (IST)` and `<= today + 14`.

## Changes by file

### Migration

```sql
ALTER TABLE public.workout_days ADD COLUMN workout_date date;
CREATE INDEX workout_days_user_date_idx ON public.workout_days (user_id, workout_date);
UPDATE public.workout_days wd
SET workout_date = (w.start_date + (wd.day_index - 1))::date
FROM public.weeks w
WHERE wd.week_id = w.id AND wd.workout_date IS NULL;
```

No new grants (column inherits table grants), no RLS change.

### `src/lib/gym.functions.ts`

- Add `startDate` to `inputValidator` on `generateWeek`, `generateFourWeekPlan`, `generateAdaptivePlan` (Zod: ISO date string, ≥ today IST, ≤ today+14 IST; default today).
- Prompt inputs: replace weekday names with a `dates` array `[{ day_index, date_iso, weekday }]` (weekday for context, not scheduling).
- Schemas: drop `day: enum("Monday"..)` from diet-day schema.
- Insert `weeks`: `start_date = <resolved start>`. Multi-week plans: week N `start_date = firstStart + 7*(N-1)`.
- Insert `workout_days`: `workout_date = week.start_date + (day_index - 1)`.
- `callGeminiForSevenDayDiet`: same date-array prompt, drop weekday label from output schema.

### `src/routes/_authenticated/onboarding.tsx`
After profile save, open `StartDateModal`. On confirm, call `generateFourWeekPlan({ data: { startDate } })`, then navigate to `/home`.

### `src/routes/_authenticated/home.tsx`
Regenerate button → open modal → pass `startDate` to the generator. Today's workout resolution: find active week's day where `workout_date = today (IST)`, else fallback `start_date + day_index - 1`.

### `src/routes/_authenticated/diet.tsx`
Replace hardcoded `DAYS` array + `getDay()` logic with derived weekday labels from the active week's `start_date`. `dayIdx` computed as `daysBetween(startDate, todayIST) + 1`, clamped 1..7. Diet lookup by position/`day_index`.

### `src/routes/_authenticated/calendar.tsx`
Prefer `wd.workout_date` when present; keep `start_date + day_index` fallback. Replace `(getDay()+6)%7` diet lookup with date→day_index resolution within the owning week.

### `src/routes/_authenticated/day.$dayId.tsx`
Show weekday + short date from `workout_date` next to the `Day N` chip.

### `src/routes/api/public/hooks/send-weekly-review.ts`
Recipient query changes to active weeks whose `start_date + 6 = today (IST)`, joined to `push_subscriptions`. Same daily cron fire, filtered per-user.

### `src/lib/xp.ts`
Rename `SUNDAY_PLANNING` → `WEEK_PLANNING`; dedupe key `WEEK_PLANNING:<weekId>`. Keep old constant as alias for one release for `xp_transactions` history readability.

### Copy tweaks
- `profile.tsx` L502: "Daily 5am · Sunday 9pm · Achievements" → "Daily 5am · End-of-week 9pm · Achievements".
- Weekly-review push title stays "Weekly check-in 🗓️".

## What is NOT changing

Streak, habit score, achievements, XP-for-workout, exercise-log flow, onboarding fields, auth, cron schedules, all other tables, all component design/layout/nav. Existing weeks stay readable via backfill.

## Verification

1. `tsgo` clean.
2. Fresh sign-up on Sat Jul 4 → modal shows, default today, pick Sun Jul 5 → Day 1 renders "Sun · 5 Jul", Day 7 = "Sat · 11 Jul", calendar highlights those seven, diet pills start on "Sun".
3. Same flow, keep default today → Day 1 = "Sat · 4 Jul".
4. SQL: `SELECT day_index, workout_date FROM workout_days WHERE week_id=<new>` → 1..N consecutive dates from chosen start.
5. Legacy week still renders correctly (backfill).
6. Cron dry-run query returns only users whose active-week Day-7 = today.
