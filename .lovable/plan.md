# Claymorphism Redesign + Profile & Calendar Tabs (1:1 mobile shell)

Port the attached `gymbuddy_v2.html` mock 1:1 — a fixed **375px wide mobile shell**, centered on desktop against the warm beige page background. All app screens render inside that shell.

## 1. Design tokens (`src/styles.css`)

Replace current palette with clay tokens from the mock, mapped via `@theme inline` so shadcn utilities keep working:

- Page bg `#E8E0D8`, shell bg `#F0EAE2`, card `#FFFFFF`, border `#DDD8D0`
- Text: dark `#1E1C1A`, mid `#5A5855`, light `#9A9690`
- Clay accents (each with `-shadow` + `-light`): orange `#D85A30`/`#8C3218`/`#FAECE7`, green `#2E8B57`, blue `#3A7BD5`, amber `#C9820A`, red `#C0392B`
- Map to shadcn tokens: `--primary`=orange, `--background`=shell bg, `--card`=white, `--destructive`=red, etc.

Custom utilities via `@utility`:
- `clay-card` + `.orange/.green/.blue/.amber/.soft-orange/.soft-red` variants
- `clay-btn` + `.green-btn/.red-btn/.outline-btn/.sm`
- `clay-pill`, `clay-stat`, `clay-day-btn`, `prog-bar`, `focus-pill`, `week-pill`, `muscle-pill`, `feedback-btn`, `allergy-tag`, `meal-cal-badge`, `cal-toggle-btn`, `cal-month-day`

Dark mode kept but retuned to muted clay (not pure black). No hardcoded `text-white`/`bg-black` in components.

## 2. Fixed mobile shell

Update `src/routes/_authenticated/route.tsx` to render the 375px shell exactly like the mock:

```text
body (page bg #E8E0D8, min-h-screen, center)
└── .shell  (width: 375px, bg #F0EAE2, rounded-[28px], overflow-hidden, relative, min-height: 100vh on mobile / 812px on desktop)
    ├── .topbar    (sticky, white, logo tile + avatar pill)
    ├── .content   (scrollable, padding, contains <Outlet />)
    └── .bottomnav (sticky, 5 icon items with active orange dot)
```

- On screens <420px: shell is full-width, no outer padding (fills the phone)
- On screens ≥420px: shell stays at 375px, centered, with the body bg showing around it (true mock fidelity)
- Set viewport meta + default preview viewport to mobile

Bottom nav (5 items, lucide icons):
1. **Home** → `/home` (`House`)
2. **Calendar** → `/calendar` (`CalendarDays`) — NEW
3. **Workout** → `/day/today` (`Dumbbell`) — resolves to today's workout day, falls back to first day of current week
4. **Diet** → `/diet` (`Utensils`)
5. **Profile** → `/profile` (`User`) — NEW

Progress moves into Profile; the existing `/progress` route remains reachable from a Profile button.

## 3. Icons

Use `lucide-react` (already installed) — closest match per Tabler icon used in the mock (Dumbbell, Flame, CalendarDays, User, Home, Utensils, Apple, Coffee, Soup, ChevronDown, X, Play, Plus, CheckCircle2, TrendingUp, Heart, AlertTriangle, Award, Target, Activity, Bed). No new package.

## 4. NEW: `/calendar`

`src/routes/_authenticated/calendar.tsx` — combined day view, all inside the 375px shell.

- Header: "Calendar" greeting + week pill (current week #)
- Week/Month toggle (`cal-toggle-btn`)
- **Week strip**: 7 `clay-day-btn` (day name, num, dot). States: active (orange), completed (green), rest (muted), today (orange ring)
- **Month grid**: 6×7 cells (`cal-month-day`) with same state styling
- Selecting a day reveals stacked preview cards:
  - **Workout card** (`clay-card`) — focus pill + exercise name chips (`cal-exercise-chip`, read-only). Button "Open workout" → `/day/{dayId}`
  - **Diet card** (`clay-card`) — 4 compact `cal-meal-row` (Breakfast/Lunch/Snack/Dinner) with kcal pill + total footer
  - **Progress card** (`clay-card soft-orange`) — bar + "X / Y sets logged · NN%"

Data: new server fn `getCalendarDay({ date })` returns `{ workoutDay, dietForDay, completionPct }`, joining `workout_days`, `weeks.diet_json`, `exercise_logs`.

## 5. NEW: `/profile`

`src/routes/_authenticated/profile.tsx` (all clay):

- **Profile hero** (`clay-card orange`): big avatar initial, name, goal tag pill
- **Stats row** (2-col `clay-stat`): Streak, Total workouts, Avg completion %, Weeks done
- **Details card** (`clay-card`): rows for Age, Height, Weight, Experience, Equipment, Days/week, Injuries — each row icon + key/value
- **Allergies card** (`clay-card soft-red`): `allergy-tag` chips with × + input + Add. Persists via existing `updateProfile` (allergies col already exists). Hint banner: "Diet will regenerate on next refresh"
- **Weekly progress card**: per-week label + bar + % from `week_reviews`
- **Footer buttons**: "View detailed progress" (→ `/progress`), "Sign out" (outline)

Reuses `getProfile`, `updateProfile`, `getAllWeeks`. No schema changes.

## 6. Redesign existing pages to clay (frontend only)

- **Home** (`home.tsx`): greeting + week pill, streak hero (orange clay), today's focus pill, `ex-row` list with chevron-expand for steps + YouTube link, check-in clay-btn, 2-col `clay-stat` cards, meal preview rows (clickable → bottom sheet modal with food breakdown)
- **Day detail** (`day.$dayId.tsx`): keep all existing logic. Restyle headers, set/rep inputs, RPE chips, log buttons with clay tokens. YouTube link as `yt-link` style with existing breakout `window.open`.
- **Diet** (`diet.tsx`): week tabs + day tabs as `clay-day-btn`; meal sections as `clay-card`; food chips; total kcal footer; protein note banner; "Add allergy / Regenerate diet" modal (`redo-hint` style)
- **Review** + **Progress**: clay stat cards + week progress bars

No business-logic changes — purely classes, structure, icons.

## 7. Files touched

```text
EDIT  src/styles.css                              (palette + clay utilities + shell)
EDIT  src/routes/__root.tsx                       (viewport meta, body bg)
EDIT  src/routes/_authenticated/route.tsx         (375px shell + 5-tab bottom nav)
NEW   src/routes/_authenticated/calendar.tsx
NEW   src/routes/_authenticated/profile.tsx
EDIT  src/routes/_authenticated/home.tsx
EDIT  src/routes/_authenticated/day.$dayId.tsx
EDIT  src/routes/_authenticated/diet.tsx
EDIT  src/routes/_authenticated/progress.tsx
EDIT  src/routes/_authenticated/review.$weekId.tsx
EDIT  src/lib/gym.functions.ts                    (add getCalendarDay)
```

No DB migrations, no new dependencies. Preview viewport will be set to mobile on implementation.
