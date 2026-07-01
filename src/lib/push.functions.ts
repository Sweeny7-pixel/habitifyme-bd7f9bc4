import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

const SubscriptionInput = z.object({
  endpoint: z.string().url(),
  p256dh: z.string().min(1),
  auth: z.string().min(1),
  userAgent: z.string().optional(),
});

/** Upsert (by endpoint) a Web Push subscription for the current user. */
export const savePushSubscription = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => SubscriptionInput.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { error } = await supabase.from("push_subscriptions").upsert(
      {
        user_id: userId,
        endpoint: data.endpoint,
        p256dh: data.p256dh,
        auth: data.auth,
        user_agent: data.userAgent ?? null,
      },
      { onConflict: "endpoint" },
    );
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** Remove a subscription (called from the browser when the user opts out). */
export const deletePushSubscription = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ endpoint: z.string().url() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { error } = await supabase
      .from("push_subscriptions")
      .delete()
      .eq("endpoint", data.endpoint)
      .eq("user_id", userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** Sends a test notification to every device the caller has subscribed. */
export const sendTestPush = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data: subs, error } = await supabase
      .from("push_subscriptions")
      .select("id, endpoint, p256dh, auth")
      .eq("user_id", userId);
    if (error) throw new Error(error.message);
    if (!subs || subs.length === 0) {
      throw new Error("No devices subscribed yet — tap Enable notifications first.");
    }
    const { sendPushToMany } = await import("./push.server");
    const result = await sendPushToMany(subs, {
      title: "HabitifyMe",
      body: "Test notification working. You'll get real reminders next.",
      url: "/profile",
      tag: "test",
    });
    if (result.gone.length > 0) {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      await supabaseAdmin
        .from("push_subscriptions")
        .delete()
        .in("endpoint", result.gone);
    }
    return { sent: result.sent, failed: result.failed };
  });

/**
 * Evaluate the caller's achievements and send a push for any that haven't been
 * notified yet. Called from `submitWeekReview` right after the week is marked
 * complete. Safe to call multiple times — insert into `notified_achievements`
 * dedupes via a UNIQUE(user_id, achievement_key) constraint.
 */
export async function evaluateAndNotifyAchievements(
  supabase: import("@supabase/supabase-js").SupabaseClient,
  userId: string,
): Promise<void> {
  const [{ data: weeks }, { data: reviews }, { data: alreadyNotified }, { data: subs }] =
    await Promise.all([
      supabase.from("weeks").select("status").eq("user_id", userId),
      supabase.from("week_reviews").select("completion_pct").eq("user_id", userId),
      supabase.from("notified_achievements").select("achievement_key").eq("user_id", userId),
      supabase.from("push_subscriptions").select("id, endpoint, p256dh, auth").eq("user_id", userId),
    ]);

  if (!subs || subs.length === 0) return; // nothing to send to

  const weeksDone = (weeks ?? []).filter((w) => w.status === "completed").length;
  const reviewsDone = (reviews ?? []).length;
  const avg = reviewsDone
    ? Math.round((reviews ?? []).reduce((s, r) => s + r.completion_pct, 0) / reviewsDone)
    : 0;

  const notifiedSet = new Set((alreadyNotified ?? []).map((r) => r.achievement_key));

  const candidates: { key: string; title: string; body: string }[] = [];
  if (weeksDone >= 1 && !notifiedSet.has("first_week")) {
    candidates.push({
      key: "first_week",
      title: "🌱 Achievement unlocked: First Week",
      body: "You finished your first week. Momentum is real — keep going.",
    });
  }
  if (weeksDone >= 4 && !notifiedSet.has("four_week_streak")) {
    candidates.push({
      key: "four_week_streak",
      title: "🔥 Achievement unlocked: 4-Week Streak",
      body: "Four weeks done. This is where habits become identity.",
    });
  }
  if (avg >= 80 && !notifiedSet.has("eighty_percent_avg")) {
    candidates.push({
      key: "eighty_percent_avg",
      title: "🏆 Achievement unlocked: 80%+ Avg",
      body: "Your average completion crossed 80%. Consistency is winning.",
    });
  }
  if (reviewsDone >= 3 && !notifiedSet.has("review_pro")) {
    candidates.push({
      key: "review_pro",
      title: "⭐ Achievement unlocked: Review Pro",
      body: "3 week reviews submitted. Reflection is a superpower.",
    });
  }

  if (candidates.length === 0) return;

  const { sendPushToMany } = await import("./push.server");

  for (const c of candidates) {
    // Reserve the achievement first; if the insert conflicts, another concurrent
    // call already handled it, so skip.
    const { error: insertErr } = await supabase
      .from("notified_achievements")
      .insert({ user_id: userId, achievement_key: c.key });
    if (insertErr) continue; // unique_violation → already notified
    await sendPushToMany(subs, {
      title: c.title,
      body: c.body,
      url: "/profile",
      tag: `achievement-${c.key}`,
    });
  }
}
