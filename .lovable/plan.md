
# Habitify Admin Dashboard (adapted)

Add an admin-only reporting area to the existing HabitifyMe app under `/admin/*`. Read-only, adapts to current tables, uses TanStack Router (not React Router) and Recharts. Nothing about the existing user app changes.

## 1. Auth & roles

- New `app_role` enum (`admin`, `user`) + `user_roles` table with `has_role(uuid, app_role)` security-definer function (canonical Supabase pattern — roles stored separately from profiles to avoid privilege escalation).
- Seed migration: create auth user `admin@habitify.com` / `Admin@12345` via `auth.admin`, insert `admin` role. Note: the user should rotate this password immediately after first login — a known password in git is a real risk.
- `/admin/login` — email+password sign-in. After sign-in, verify `has_role(uid, 'admin')`; if not admin, sign out and show "Not authorized".
- Routes live under `src/routes/_admin/` — a new pathless layout that runs a client-only `beforeLoad` calling `supabase.auth.getUser()` + admin-role check, redirecting to `/admin/login` otherwise. Independent from the existing `_authenticated` layout so the user app is unaffected.
- Sidebar shows a "Log out" that clears the session and returns to `/admin/login`.

## 2. Schema adaptation (no destructive changes)

Reuse existing tables; no new `habits` table, no changes to existing columns.

- Users list = `profiles` joined with `auth.users` (email) via a security-definer server function `admin_list_users()` — profiles has no email column, and we won't add one.
- "Status active/inactive" = derived (checkin in last 14 days).
- "Streak" = existing `streak` logic in `src/lib/streak.ts` (call per user).
- "Habit score" = `habit_scores.score` + `habit_score_history` for the trend chart.
- "Achievements" = `achievements` table (title/description/icon derived from `achievement_key` via existing `src/lib/achievements.ts` catalog; locked ones from catalog minus unlocked).
- "Check-ins" = `checkins` table (no per-habit link exists — heatmap is per-day generic).
- "Exercise logs" = `exercise_logs` (already has duration/reps/weight, no calories column — omit calories or show "—").
- "Week reviews" = `week_reviews` joined with `weeks` for date range and `plan_summary`.
- **New** stretch tables: `admin_notes` (user_id, author_id, note, created_at), `user_flags` (user_id, flagged_by, reason, resolved_at). Full RLS: only admins can read/write.
- XP tracking: `xp_transactions` already exists — surface daily XP in the profile page.

All queries go through server functions (`src/lib/admin.functions.ts`) using `requireSupabaseAuth` + an in-handler `has_role` check. No `supabaseAdmin` on the client graph.

## 3. Routes

```text
src/routes/
  _admin.tsx                  (pathless layout: role gate + AdminShell)
  admin.login.tsx             (public)
  _admin/admin.dashboard.tsx  → /admin/dashboard
  _admin/admin.profile.$userId.tsx
  _admin/admin.reports.tsx
```

### /admin/dashboard
KPI cards: total users, checkins this week, avg habit score, achievements unlocked (all-time). User grid with search + filter (active/inactive, score range). Row click → profile.

### /admin/profile/:userId
Tabs (anchored) to avoid endless scroll:
1. **Header** — avatar (initials fallback, no `avatar_url` column), name, join date, current streak, habit score gauge, XP total.
2. **Habit Score Trend** — Recharts line from `habit_score_history`, 30d / 90d toggle. Overlay daily XP from `xp_transactions`.
3. **Achievements** — grid; unlocked from `achievements`, locked from catalog.
4. **Check-ins** — GitHub-style heatmap (custom, no extra dep) + filterable table.
5. **Exercise Logs** — table + weekly-minutes bar chart (sum of `sets_completed × reps`-based duration proxy, or just count of logs per week if duration isn't reliable).
6. **Week Reviews** — expandable cards from `week_reviews` + `weeks`.
7. **All Weeks' Exercises** — accordion grouped by `weeks.week_number`, sessions count + volume totals.
8. **Admin Notes** / **Flag** — add note, toggle flag with reason.

### /admin/reports
Sortable table across all users: habit score, streak, checkins per week, achievements count, flagged?.

## 4. UI

- Sidebar layout with shadcn `sidebar` primitives (Dashboard / Profiles / Reports / Logout).
- Calm ops palette using existing design tokens; introduce an "admin" surface variant in `src/styles.css`. No hardcoded colors.
- Recharts for line/bar/gauge; custom SVG for heatmap.
- Loading skeletons + empty states per section.
- Desktop-first, still responsive.

## 5. Data flow

- Loader in each admin route calls `context.queryClient.ensureQueryData(...)` against the admin server fns; components use `useSuspenseQuery`.
- Bearer attacher already registered in `src/start.ts`, so protected fns work.
- Every admin server fn checks `has_role(userId, 'admin')` in-handler and returns 403 otherwise — defense in depth on top of the route gate.

## 6. Tech notes for the user (plain terms)

- Your project runs on TanStack Router, not React Router — I'll use TanStack throughout; navigation and routing behave the same.
- The existing tables don't have every field the spec listed (no `avatar_url`, no calories, no `habits` table, no email on profiles). I'll adapt: avatars become initials, email comes from the auth account, "habit" grouping is skipped where it doesn't exist. If you later want a full `habits` table + linked check-ins, that's a separate migration.
- Seeding the admin password `Admin@12345` into a migration commits it to your repo history. Please change it right after first sign-in.

## 7. Out of scope

- No changes to the existing user-facing routes, home dashboard, onboarding, or workout flows.
- No CRUD on user data (read-only + admin notes/flags only).
- No new mock user seed data — the dashboard renders against real production data. If you want demo users, tell me and I'll add a seed migration.
