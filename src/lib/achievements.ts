import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getTotalXPInternal } from "./xp";

// ============ Achievement Definitions ============

export interface AchievementDef {
  key: string;
  label: string;
  icon: string;
  description: string;
}

export const ACHIEVEMENT_DEFS: AchievementDef[] = [
  { key: "first_workout", label: "First Workout", icon: "💪", description: "Completed your first workout" },
  { key: "checkin_streak_3", label: "3-Day Streak", icon: "🔥", description: "3 consecutive gym check-ins" },
  { key: "checkin_streak_7", label: "7-Day Streak", icon: "⚡", description: "7 consecutive gym check-ins" },
  { key: "week_complete", label: "Week Complete", icon: "🌱", description: "Finished your first training week" },
  { key: "workouts_10", label: "10 Workouts", icon: "🏋️", description: "Logged 10 total workouts" },
  { key: "xp_1000", label: "1000 XP", icon: "💎", description: "Earned 1,000 total XP" },
  { key: "perfect_week", label: "Perfect Week", icon: "🏆", description: "Completed every workout in a week" },
  { key: "habit_champion", label: "Habit Champion", icon: "👑", description: "Habit Score above 80" },
  { key: "four_week_streak", label: "4-Week Streak", icon: "🔱", description: "Completed 4 training weeks" },
  { key: "eighty_pct_avg", label: "80%+ Avg", icon: "⭐", description: "Average completion above 80%" },
  { key: "review_pro", label: "Review Pro", icon: "📊", description: "Submitted 3 weekly reviews" },
];

export const ACHIEVEMENT_MAP = new Map(ACHIEVEMENT_DEFS.map((a) => [a.key, a]));

// ============ Internal engine ============

export async function checkAndUnlockAchievements(
  supabase: SupabaseClient,
  userId: string,
): Promise<string[]> {
  // Gather all necessary data in parallel
  const [
    { data: workoutDays },
    { data: weeks },
    { data: reviews },
    { data: checkins },
    { data: alreadyUnlocked },
    habitScoreRes,
  ] = await Promise.all([
    supabase
      .from("workout_days")
      .select("completed_at, week_id")
      .eq("user_id", userId),
    supabase.from("weeks").select("id, status").eq("user_id", userId),
    supabase
      .from("week_reviews")
      .select("completion_pct")
      .eq("user_id", userId),
    supabase
      .from("checkins")
      .select("created_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(60),
    supabase
      .from("achievements")
      .select("achievement_key")
      .eq("user_id", userId),
    supabase
      .from("habit_scores")
      .select("score")
      .eq("user_id", userId)
      .maybeSingle(),
  ]);

  const unlockedSet = new Set(
    (alreadyUnlocked ?? []).map((r: { achievement_key: string }) => r.achievement_key),
  );

  const completedWorkouts = (workoutDays ?? []).filter(
    (d: { completed_at: string | null }) => d.completed_at,
  );
  const completedWeeks = (weeks ?? []).filter(
    (w: { status: string }) => w.status === "completed",
  );
  const reviewsDone = reviews?.length ?? 0;
  const avgCompletion =
    reviewsDone > 0
      ? Math.round(
          (reviews ?? []).reduce(
            (s: number, r: { completion_pct: number }) => s + r.completion_pct,
            0,
          ) / reviewsDone,
        )
      : 0;
  const habitScore = (habitScoreRes.data as { score?: number } | null)?.score ?? 0;
  const totalXP = await getTotalXPInternal(supabase, userId);

  // Compute checkin streak
  const checkinStreak = computeCheckinStreak(
    (checkins ?? []).map((c: { created_at: string }) => c.created_at),
  );

  // Check perfect week: any week where all workout_days are completed
  const hasPerfectWeek = (() => {
    if (!weeks || !workoutDays) return false;
    for (const week of weeks) {
      const weekDays = workoutDays.filter(
        (d: { week_id: string }) => d.week_id === week.id,
      );
      if (weekDays.length > 0 && weekDays.every((d: { completed_at: string | null }) => d.completed_at)) {
        return true;
      }
    }
    return false;
  })();

  // Evaluate candidates
  const candidates: string[] = [];
  const check = (key: string, condition: boolean) => {
    if (condition && !unlockedSet.has(key)) candidates.push(key);
  };

  check("first_workout", completedWorkouts.length >= 1);
  check("checkin_streak_3", checkinStreak >= 3);
  check("checkin_streak_7", checkinStreak >= 7);
  check("week_complete", completedWeeks.length >= 1);
  check("workouts_10", completedWorkouts.length >= 10);
  check("xp_1000", totalXP >= 1000);
  check("perfect_week", hasPerfectWeek);
  check("habit_champion", habitScore >= 80);
  check("four_week_streak", completedWeeks.length >= 4);
  check("eighty_pct_avg", avgCompletion >= 80);
  check("review_pro", reviewsDone >= 3);

  if (candidates.length === 0) return [];

  // Unlock new achievements (UNIQUE constraint dedupes concurrency)
  const rows = candidates.map((key) => ({
    user_id: userId,
    achievement_key: key,
    metadata: {},
  }));
  await supabase.from("achievements").upsert(rows, { onConflict: "user_id,achievement_key" });

  return candidates;
}

function computeCheckinStreak(checkinISOs: string[]): number {
  if (checkinISOs.length === 0) return 0;
  const sorted = [...checkinISOs].sort((a, b) => new Date(b).getTime() - new Date(a).getTime());
  let streak = 0;
  let cursor = new Date();
  cursor.setHours(23, 59, 59, 999);

  for (const iso of sorted) {
    const day = new Date(iso);
    day.setHours(0, 0, 0, 0);
    const cursorDay = new Date(cursor);
    cursorDay.setHours(0, 0, 0, 0);
    const diff = Math.round((cursorDay.getTime() - day.getTime()) / 86_400_000);
    if (diff === 0) {
      if (streak === 0) streak = 1;
      cursor = day;
    } else if (diff === 1) {
      streak++;
      cursor = day;
    } else {
      break;
    }
  }
  return streak;
}

// ============ Server Functions ============

export const getAchievements = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data } = await supabase
      .from("achievements")
      .select("achievement_key, unlocked_at")
      .eq("user_id", userId)
      .order("unlocked_at", { ascending: false });

    const unlocked = new Set(
      (data ?? []).map((r: { achievement_key: string }) => r.achievement_key),
    );

    return ACHIEVEMENT_DEFS.map((def) => ({
      ...def,
      unlocked: unlocked.has(def.key),
      unlockedAt:
        (data ?? []).find(
          (r: { achievement_key: string; unlocked_at: string }) =>
            r.achievement_key === def.key,
        )?.unlocked_at ?? null,
    }));
  });
