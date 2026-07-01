## Why both issues are still happening

`toImageUrl` and `youtubeLink` are only applied **at plan-generation time** (in `src/lib/gym.functions.ts`), then written into `workout_days.exercises_json`. Any plan generated before those fields were added — or where the catalog lookup didn't match — has rows in the DB with empty `images: []` and no `youtubeLink`. The display code in `src/routes/_authenticated/day.$dayId.tsx` reads those fields verbatim, so:

- Exercise cards show a blank gray tile (no thumbnail) — matches screenshot 1.
- The "Watch form video on YouTube" button in the exercise sheet is gated by `exercise.youtubeLink && (...)` and never renders — matches screenshot 2.

Fixing `toImageUrl` again won't help existing rows. We need (a) a display-time fallback so the YouTube button is always available, and (b) a one-shot backfill that re-hydrates `images` + `youtubeLink` from the catalog for stored plans.

## Changes

### 1. Always render the YouTube button (client fallback)
File: `src/routes/_authenticated/day.$dayId.tsx`

- Add a tiny helper `buildYouTubeSearchUrl(name, equipment)` (same shape as the server helper: `https://www.youtube.com/results?search_query=` + `encodeURIComponent("how to do <name> [<equipment>] form").replaceAll("+","%20")`).
- Compute `const ytUrl = exercise.youtubeLink || buildYouTubeSearchUrl(exercise.name, exercise.equipment)`.
- Drop the `exercise.youtubeLink &&` gate — always render the button, using `ytUrl`. Guarantees it appears for every exercise on every day, even for legacy rows.

### 2. Backfill images + youtubeLink for existing plans
File: `src/lib/gym.functions.ts`

- Add `backfillPlanMedia = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth]).handler(async ({ context }) => { ... })`:
  1. Load the enriched catalog (`loadCatalog` / `findExercise` from `./exercise-db.server`).
  2. Select all `workout_days` for `userId`.
  3. For each day, walk `exercises_json`. If an exercise is missing `images` (empty array) OR missing `youtubeLink`, run `findExercise({ name, muscle: primaryMuscles?.[0], equipment })`. If matched, patch that exercise object with the enriched `images` + `youtubeLink`. If unmatched, at minimum set `youtubeLink` via the same client helper's server twin so the sheet button link is stable in the DB too.
  4. If any exercise in a day was patched, update that row's `exercises_json`.
  5. Return `{ updatedDays: n }`.
- Idempotent: rows that already have both fields are skipped.

### 3. Trigger the backfill once per session
File: `src/routes/_authenticated/home.tsx` (or `route.tsx` under `_authenticated`)

- In a `useEffect` on mount, read `localStorage.getItem("gymbuddy_mediaBackfilledAt")`. If missing or older than 7 days, call `backfillPlanMedia` via `useServerFn`, then set the timestamp. Fire-and-forget with a `.catch(() => {})` so it never blocks the UI.
- On success, `queryClient.invalidateQueries({ queryKey: ["day"] })` and `["dashboard"]` so the day pages re-fetch with the newly patched JSON.

## Verification (browser test with user `overweight2@gmail.com`)

1. Log in → visit `/` → wait ~2s → refresh → open Workout → Day 3 → each exercise card now shows a thumbnail (or a stable placeholder if the catalog has no image for that exercise).
2. Tap "Goblet Squats" → the exercise sheet shows the **Watch form video on YouTube** button between the form cue and the sliders.
3. Repeat on Day 1 and Day 2 — button is present on every exercise, on every day.
4. Confirm no console errors and that a second visit is a no-op (backfill skipped by the localStorage guard).

## Out of scope
- No changes to plan-generation logic (`toImageUrl` and enrichment there already work for new plans).
- No schema changes; the fix is JSON-in-place inside `workout_days.exercises_json`.
