## Problem

Workout day cards show no exercise images. The current day's `exercises_json` in the DB only contains `name`, `sets`, `reps`, `rest_seconds`, `form_cue`, `youtube_query` — no `images`, `instructions`, `primaryMuscles`, `equipment`, `level`, or `youtubeLink`. The UI (`day.$dayId.tsx`) reads `ex.images?.[0]` and falls back to an empty placeholder, so nothing renders.

Root cause: `generateWeekPlan` in `src/lib/gym.functions.ts` inserts the AI's raw plan directly (lines 245–253) without matching against the free-exercise-db catalog. The prompt-based path (`generateFromPrompt`, ~line 878) and the multi-week path (line 682) both hydrate through the catalog — `generateWeekPlan` was skipped.

## Fix

### 1. Hydrate on write in `generateWeekPlan` (`src/lib/gym.functions.ts`)

Before inserting `workout_days`, run each AI-generated exercise through the same catalog match used by `generateFromPrompt`:

- Import `findExercise` / `searchExercises` from `./exercise-db.server`.
- For each exercise, try `findExercise({ name })`; fall back to `searchExercises({ muscle: derivedFromFocus, level: profile.experience, limit: 1 })`.
- Merge the AI's programming (`sets`, `reps`, `rest_seconds`, `form_cue`) with the catalog's `images` (mapped through `toImageUrl`), `instructions`, `primaryMuscles`, `equipment`, `level`, and `youtubeLink`.
- If no match, keep the AI exercise as-is (name/sets/reps/form_cue) so the workout still shows — the placeholder tile then renders instead of a broken image.

### 2. Backfill on read in `getDay` (same file)

Existing rows (like the currently-open Push Day) were saved without images. To avoid a migration or forced regeneration, hydrate on read:

- In `getDay`, after loading `day`, walk `day.exercises_json` and for any exercise missing `images`, look it up in the catalog by name and attach `images`, `instructions`, `primaryMuscles`, `equipment`, `level`, `youtubeLink` in-memory before returning.
- Do the same in `getWeek` / `getCurrentWeek` if the day list is consumed anywhere that shows images (calendar/home use titles only, so likely only `getDay` needs this — verify while implementing).

This keeps stored data untouched but makes the UI work immediately for old and new plans.

### 3. Verify

- Reload `/day/9e4beeaa-…` and confirm each row shows a thumbnail on the left.
- Open an exercise sheet and confirm the demo image carousel + "Watch form video on YouTube" link both work (the YouTube URL now comes from the catalog helper, not the raw `youtube_query`).
- Generate a fresh week to confirm new rows are stored with `images` populated.

## Files touched

- `src/lib/gym.functions.ts` — hydrate in `generateWeekPlan`; backfill in `getDay` (and `getWeek`/`getCurrentWeek` if needed).

No schema changes, no new files, no UI changes.
