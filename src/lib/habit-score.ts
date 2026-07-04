import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { SupabaseClient } from "@supabase/supabase-js";

// Weights from PRD (must sum to 1.0)
const WEIGHTS = {
  WORKOUT_COMPLETION: 0.4,
  GYM_CHECKINS: 0.25,
  DIET_LOGGING: 0.2,
  WEEKLY_REVIEW: 0.15,
} as const;

// ============ Internal calculation helpers ============

async function computeHabitScore(
  supabase: SupabaseClient,
  userId: string,
  since: string,
): Promise<number> {
  const dayRange = Math.max(
    7,
    Math.floor((Date.now() - new Date(since).getTime()) / 86_400_000),
  );

  const [workoutRes, checkinRes, reviewRes] = await Promise.all([
    supabase
      .from("workout_days")
      .select("completed_at, created_at")
      .eq("user_id", userId)
      .gte("created_at", since),
    supabase.from("checkins").select("id").eq("user_id", userId).gte("created_at", since),
    supabase
      .from("week_reviews")
      .select("completion_pct, created_at")
      .eq("user_id", userId)
      .gte("created_at", since),
  ]);

  const workoutDays = workoutRes.data ?? [];
  const workoutScore =
    workoutDays.length > 0
      ? Math.round(
          (workoutDays.filter((d: { completed_at: string | null }) => d.completed_at).length /
            workoutDays.length) *
            100,
        )
      : 0;

  // Check-in score: target 3+ per week
  const checkinCount = checkinRes.data?.length ?? 0;
  const expectedCheckins = Math.max(1, Math.ceil(dayRange / 7) * 3);
  const checkinScore = Math.min(100, Math.round((checkinCount / expectedCheckins) * 100));

  // Diet logging proxy (no dedicated diet log table yet — use workout consistency)
  const dietScore = workoutScore;

  // Review score: each review = 25 points, cap at 100
  const reviewScore = Math.min(100, (reviewRes.data?.length ?? 0) * 25);

  const composite = Math.round(
    workoutScore * WEIGHTS.WORKOUT_COMPLETION +
      checkinScore * WEIGHTS.GYM_CHECKINS +
      dietScore * WEIGHTS.DIET_LOGGING +
      reviewScore * WEIGHTS.WEEKLY_REVIEW,
  );

  return Math.min(100, Math.max(0, composite));
}

export async function calculateHabitScoreInternal(
  supabase: SupabaseClient,
  userId: string,
): Promise<{ score: number; score_7d: number; score_30d: number }> {
  const now = new Date();
  const sevenDaysAgo = new Date(now.getTime() - 7 * 86_400_000).toISOString();
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 86_400_000).toISOString();

  const [score7d, score30d] = await Promise.all([
    computeHabitScore(supabase, userId, sevenDaysAgo),
    computeHabitScore(supabase, userId, thirtyDaysAgo),
  ]);

  const score = score7d; // primary score is 7-day window

  await supabase
    .from("habit_scores")
    .upsert(
      { user_id: userId, score, score_7d: score7d, score_30d: score30d, calculated_at: now.toISOString() },
      { onConflict: "user_id" },
    );

  // Append history row (at most once per day — ignore duplicates gracefully)
  await supabase.from("habit_score_history").insert({
    user_id: userId,
    score,
    calculated_at: now.toISOString(),
  });

  return { score, score_7d: score7d, score_30d: score30d };
}

// ============ Segmentation ============

export function getHabitSegment(score: number): {
  label: string;
  color: string;
  description: string;
} {
  if (score <= 20)
    return {
      label: "At Risk",
      color: "var(--neon-orange)",
      description: "Easy wins build momentum — start small",
    };
  if (score <= 60)
    return {
      label: "Building",
      color: "var(--neon-amber)",
      description: "You're forming a habit — keep going",
    };
  if (score <= 80)
    return {
      label: "Strong Habit",
      color: "var(--neon-green)",
      description: "Great consistency — push harder",
    };
  return {
    label: "Champion",
    color: "var(--neon-purple)",
    description: "Top tier — you lead by example",
  };
}

// ============ Server Functions ============

export const calculateAndSaveHabitScore = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    return calculateHabitScoreInternal(supabase, userId);
  });

export const getHabitScore = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data } = await supabase
      .from("habit_scores")
      .select("*")
      .eq("user_id", userId)
      .maybeSingle();

    if (data) return data as { score: number; score_7d: number; score_30d: number; calculated_at: string };

    // Compute on demand if no cached score
    const computed = await calculateHabitScoreInternal(supabase, userId);
    return { ...computed, calculated_at: new Date().toISOString() };
  });

export const getHabitScoreHistory = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data } = await supabase
      .from("habit_score_history")
      .select("score, calculated_at")
      .eq("user_id", userId)
      .order("calculated_at", { ascending: false })
      .limit(30);
    return (data ?? []) as { score: number; calculated_at: string }[];
  });
