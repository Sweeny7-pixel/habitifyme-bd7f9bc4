import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";

// ============ XP Configuration (never hardcode elsewhere) ============

export const XP_RULES = {
  WORKOUT_COMPLETE: 50,
  GYM_CHECKIN: 20,
  WEEKLY_REVIEW: 40,
  SEVEN_DAY_STREAK: 150,
  PROFILE_COMPLETION: 25,
  SUNDAY_PLANNING: 30,
  DIET_LOGGING: 15,
  BONUS_SURPRISE: 150,
} as const;

export type XPReason = keyof typeof XP_RULES;

// ============ Level System ============

const LEVEL_THRESHOLDS = [0, 150, 400, 800, 1400, 2200, 3200, 4500, 6000, 8000];

const LEVEL_TITLES = [
  "Rookie",
  "Beginner",
  "Athlete",
  "Warrior",
  "Champion",
  "Legend",
  "Elite",
  "Master",
  "Grandmaster",
  "God Mode",
];

export function getCurrentLevel(totalXP: number): number {
  let level = 1;
  for (let i = 0; i < LEVEL_THRESHOLDS.length; i++) {
    if (totalXP >= LEVEL_THRESHOLDS[i]) level = i + 1;
    else break;
  }
  return level;
}

export function getLevelProgress(totalXP: number): {
  level: number;
  currentXP: number;
  nextLevelXP: number;
  progress: number;
} {
  const level = getCurrentLevel(totalXP);
  const currentThreshold = LEVEL_THRESHOLDS[level - 1] ?? 0;
  const nextThreshold =
    LEVEL_THRESHOLDS[level] ?? (LEVEL_THRESHOLDS[LEVEL_THRESHOLDS.length - 1] ?? 0) + 5000;
  const currentXP = totalXP - currentThreshold;
  const nextLevelXP = nextThreshold - currentThreshold;
  const progress = Math.min(100, Math.round((currentXP / nextLevelXP) * 100));
  return { level, currentXP, nextLevelXP, progress };
}

export function getLevelTitle(level: number): string {
  return LEVEL_TITLES[Math.min(level - 1, LEVEL_TITLES.length - 1)] ?? "Champion";
}

// ============ Internal helper (call from other server functions) ============

export async function awardXPInternal(
  supabase: SupabaseClient,
  userId: string,
  reason: string,
  amount: number,
  metadata: Record<string, unknown> = {},
  /** Optional dedupe key. When set, a UNIQUE index on (user_id, dedupe_key) ensures
   *  concurrent calls silently return 0 XP instead of awarding twice. */
  dedupeKey?: string,
): Promise<{ xpAwarded: number; bonusTriggered: boolean; bonusXP: number; alreadyAwarded: boolean }> {
  // 10% chance surprise bonus
  const bonusTriggered = Math.random() < 0.1;
  const bonusXP = bonusTriggered ? XP_RULES.BONUS_SURPRISE : 0;
  const totalAmount = amount + bonusXP;

  const row: Record<string, unknown> = {
    user_id: userId,
    reason,
    amount: totalAmount,
    metadata: { ...metadata, bonusXP: bonusTriggered ? bonusXP : 0 },
  };
  if (dedupeKey) row.dedupe_key = dedupeKey;

  const { error } = await supabase.from("xp_transactions").insert(row);

  if (error) {
    // PostgreSQL unique_violation = "23505" on the dedupe_key index → already awarded
    if (dedupeKey && error.code === "23505") {
      return { xpAwarded: 0, bonusTriggered: false, bonusXP: 0, alreadyAwarded: true };
    }
    throw new Error(error.message);
  }

  return { xpAwarded: totalAmount, bonusTriggered, bonusXP, alreadyAwarded: false };
}

export async function getTotalXPInternal(
  supabase: SupabaseClient,
  userId: string,
): Promise<number> {
  const { data } = await supabase
    .from("xp_transactions")
    .select("amount")
    .eq("user_id", userId);
  return (data ?? []).reduce((sum: number, row: { amount: number }) => sum + (row.amount ?? 0), 0);
}

// ============ Server Functions ============

/**
 * Public surface for client-initiated XP grants.
 * Only accepts reasons in XP_RULES; amount is derived server-side — clients
 * cannot inflate it.
 */
export const awardXP = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        // Only allow valid XP_RULES keys — never a client-supplied amount
        reason: z.enum(Object.keys(XP_RULES) as [XPReason, ...XPReason[]]),
        metadata: z.record(z.unknown()).optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    // Amount always comes from the server-side config — never from the client
    const amount = XP_RULES[data.reason];
    const result = await awardXPInternal(
      supabase,
      userId,
      data.reason,
      amount,
      data.metadata ?? {},
    );
    const totalXP = await getTotalXPInternal(supabase, userId);
    const levelInfo = getLevelProgress(totalXP);
    const title = getLevelTitle(levelInfo.level);
    return { ...result, totalXP, ...levelInfo, title };
  });

/**
 * Awards Sunday-planning XP at most once per calendar week.
 * Idempotency is enforced at the DB level via a unique index on
 * (user_id, dedupe_key) in xp_transactions — concurrent calls silently
 * return 0 XP instead of awarding twice (no application-level TOCTOU race).
 */
export const awardSundayPlanningXP = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;

    // ISO week number key, e.g. "SUNDAY_PLANNING:2026-W27"
    const now = new Date();
    const jan4 = new Date(now.getUTCFullYear(), 0, 4);
    const weekNum = Math.ceil(
      ((now.getTime() - jan4.getTime()) / 86_400_000 + jan4.getUTCDay() + 1) / 7,
    );
    const dedupeKey = `SUNDAY_PLANNING:${now.getUTCFullYear()}-W${String(weekNum).padStart(2, "0")}`;

    const result = await awardXPInternal(
      supabase,
      userId,
      "SUNDAY_PLANNING",
      XP_RULES.SUNDAY_PLANNING,
      {},
      dedupeKey,
    );

    const totalXP = await getTotalXPInternal(supabase, userId);
    const levelInfo = getLevelProgress(totalXP);
    const title = getLevelTitle(levelInfo.level);
    return { ok: true, ...result, totalXP, ...levelInfo, title };
  });

export const getTotalXP = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const totalXP = await getTotalXPInternal(supabase, userId);
    const levelInfo = getLevelProgress(totalXP);
    const title = getLevelTitle(levelInfo.level);
    return { totalXP, ...levelInfo, title };
  });

export const getXPHistory = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data, error } = await supabase
      .from("xp_transactions")
      .select("id, reason, amount, created_at, metadata")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(20);
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const getWeeklyXP = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const weekAgo = new Date(Date.now() - 7 * 86_400_000).toISOString();
    const { data } = await supabase
      .from("xp_transactions")
      .select("amount, created_at")
      .eq("user_id", userId)
      .gte("created_at", weekAgo)
      .order("created_at", { ascending: true });

    const weeklyXP = (data ?? []).reduce(
      (s: number, r: { amount: number }) => s + (r.amount ?? 0),
      0,
    );

    // Build per-day buckets (Mon–Sun relative to today)
    const days: { date: string; xp: number }[] = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date(Date.now() - i * 86_400_000);
      days.push({ date: d.toLocaleDateString(undefined, { weekday: "short" }), xp: 0 });
    }
    for (const row of data ?? []) {
      const rowDate = new Date(row.created_at);
      const diffDays = Math.floor((Date.now() - rowDate.getTime()) / 86_400_000);
      const idx = 6 - diffDays;
      if (idx >= 0 && idx < 7) {
        days[idx].xp += row.amount ?? 0;
      }
    }

    return { weeklyXP, days };
  });
