import type { SupabaseClient } from "@supabase/supabase-js";

export type AnalyticsEvent =
  | "notification_opened"
  | "checkin_completed"
  | "workout_started"
  | "workout_completed"
  | "xp_awarded"
  | "badge_unlocked"
  | "habit_score_updated"
  | "weekly_review_submitted"
  | "plan_regenerated"
  | "restart_clicked"
  | "recovery_prompt_opened"
  | "sunday_planning_opened"
  | "sunday_planning_submitted";

/**
 * Fire-and-forget analytics insert. Never throws — never blocks the caller.
 * Call from server functions only (requires supabase + userId from context).
 */
export function trackEvent(
  supabase: SupabaseClient,
  userId: string,
  event: AnalyticsEvent,
  properties: Record<string, unknown> = {},
): void {
  Promise.resolve(
    supabase
      .from("analytics_events")
      .insert({ user_id: userId, event_name: event, properties }),
  )
    .then(() => {})
    .catch((err: unknown) => {
      console.warn("[analytics] event insert failed", event, err);
    });
}
