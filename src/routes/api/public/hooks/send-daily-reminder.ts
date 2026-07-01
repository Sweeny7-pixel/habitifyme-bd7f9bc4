/**
 * Cron target — daily 5am IST reminder to start today's workout.
 * Invoked by pg_cron at 23:30 UTC (= 05:00 IST next day). Public route,
 * gated by the Supabase `apikey` header.
 */
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/public/hooks/send-daily-reminder")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const apiKey = request.headers.get("apikey");
        const expected = process.env.SUPABASE_PUBLISHABLE_KEY;
        if (!expected || apiKey !== expected) {
          return new Response("Unauthorized", { status: 401 });
        }

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { sendPushToMany } = await import("@/lib/push.server");

        const { data: subs, error } = await supabaseAdmin
          .from("push_subscriptions")
          .select("id, endpoint, p256dh, auth");
        if (error) {
          console.error("[cron:daily] fetch subs failed", error);
          return Response.json({ ok: false, error: error.message }, { status: 500 });
        }

        const result = await sendPushToMany(subs ?? [], {
          title: "Time to train 💪",
          body: "Your workout for today is ready. Open the app to get started.",
          url: "/gym",
          tag: "daily-reminder",
        });

        if (result.gone.length > 0) {
          await supabaseAdmin
            .from("push_subscriptions")
            .delete()
            .in("endpoint", result.gone);
        }

        return Response.json({
          ok: true,
          total: subs?.length ?? 0,
          sent: result.sent,
          failed: result.failed,
          cleaned: result.gone.length,
        });
      },
    },
  },
});
