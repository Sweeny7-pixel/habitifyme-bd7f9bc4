/**
 * Cron target — Sunday 9pm IST reminder to submit the week review and
 * prep for next week. Invoked by pg_cron at 15:30 UTC Sunday.
 */
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/public/hooks/send-weekly-review")({
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
          console.error("[cron:weekly] fetch subs failed", error);
          return Response.json({ ok: false, error: error.message }, { status: 500 });
        }

        const result = await sendPushToMany(subs ?? [], {
          title: "Sunday check-in 🗓️",
          body: "Review this week and get your plan ready for next week.",
          url: "/progress",
          tag: "weekly-review",
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
