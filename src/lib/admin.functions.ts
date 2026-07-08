import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function assertAdmin(supabase: any, userId: string) {
  const { data, error } = await supabase.rpc("has_role", {
    _user_id: userId,
    _role: "admin",
  });
  if (error || !data) throw new Error("Forbidden: admin only");
}

export const checkIsAdmin = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "admin" as const,
    });
    return { isAdmin: !!data };
  });

export const adminListUsers = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: profiles } = await supabaseAdmin
      .from("profiles")
      .select("id, name, goal, experience, created_at, updated_at");

    const ids = (profiles ?? []).map((p) => p.id);
    if (ids.length === 0) return { users: [] };

    const [
      { data: authData },
      { data: scores },
      { data: recentCheckins },
      { data: achievements },
      { data: xp },
      { data: flags },
    ] = await Promise.all([
      supabaseAdmin.auth.admin.listUsers({ perPage: 1000 }),
      supabaseAdmin.from("habit_scores").select("user_id, score, score_7d, score_30d").in("user_id", ids),
      supabaseAdmin
        .from("checkins")
        .select("user_id, created_at")
        .in("user_id", ids)
        .gte("created_at", new Date(Date.now() - 14 * 86400000).toISOString()),
      supabaseAdmin.from("achievements").select("user_id").in("user_id", ids),
      supabaseAdmin.from("xp_transactions").select("user_id, amount").in("user_id", ids),
      supabaseAdmin.from("user_flags").select("user_id").in("user_id", ids).is("resolved_at", null),
    ]);

    const emailById = new Map<string, string>();
    for (const u of authData?.users ?? []) if (u.email) emailById.set(u.id, u.email);

    const lastActiveById = new Map<string, string>();
    const checkinCount = new Map<string, number>();
    for (const c of recentCheckins ?? []) {
      const prev = lastActiveById.get(c.user_id);
      if (!prev || prev < c.created_at) lastActiveById.set(c.user_id, c.created_at);
      checkinCount.set(c.user_id, (checkinCount.get(c.user_id) ?? 0) + 1);
    }
    const scoreById = new Map((scores ?? []).map((s) => [s.user_id, s]));
    const achCount = new Map<string, number>();
    for (const a of achievements ?? []) achCount.set(a.user_id, (achCount.get(a.user_id) ?? 0) + 1);
    const xpById = new Map<string, number>();
    for (const t of xp ?? []) xpById.set(t.user_id, (xpById.get(t.user_id) ?? 0) + (t.amount ?? 0));
    const flaggedSet = new Set((flags ?? []).map((f) => f.user_id));

    const users = (profiles ?? []).map((p) => ({
      id: p.id,
      name: p.name,
      email: emailById.get(p.id) ?? "—",
      goal: p.goal,
      experience: p.experience,
      joined_date: p.created_at,
      last_active: lastActiveById.get(p.id) ?? null,
      is_active: !!lastActiveById.get(p.id),
      habit_score: scoreById.get(p.id)?.score ?? 0,
      habit_score_7d: scoreById.get(p.id)?.score_7d ?? 0,
      habit_score_30d: scoreById.get(p.id)?.score_30d ?? 0,
      achievements_count: achCount.get(p.id) ?? 0,
      total_xp: xpById.get(p.id) ?? 0,
      checkins_14d: checkinCount.get(p.id) ?? 0,
      flagged: flaggedSet.has(p.id),
    }));

    return { users };
  });

export const adminOverviewKPIs = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const weekAgo = new Date(Date.now() - 7 * 86400000).toISOString();
    const [{ count: totalUsers }, { count: weekCheckins }, { data: scores }, { count: totalAch }] =
      await Promise.all([
        supabaseAdmin.from("profiles").select("*", { count: "exact", head: true }),
        supabaseAdmin
          .from("checkins")
          .select("*", { count: "exact", head: true })
          .gte("created_at", weekAgo),
        supabaseAdmin.from("habit_scores").select("score"),
        supabaseAdmin.from("achievements").select("*", { count: "exact", head: true }),
      ]);
    const avgScore =
      scores && scores.length
        ? Math.round(scores.reduce((s, r) => s + (r.score ?? 0), 0) / scores.length)
        : 0;
    return {
      totalUsers: totalUsers ?? 0,
      weekCheckins: weekCheckins ?? 0,
      avgHabitScore: avgScore,
      totalAchievements: totalAch ?? 0,
    };
  });

export const adminGetUserDetail = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { userId: string }) => d)
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const uid = data.userId;

    const [
      { data: profile },
      { data: authUser },
      { data: score },
      { data: history },
      { data: achievements },
      { data: checkins },
      { data: exercises },
      { data: reviews },
      { data: weeks },
      { data: workoutDays },
      { data: xpTx },
      { data: notes },
      { data: flags },
    ] = await Promise.all([
      supabaseAdmin.from("profiles").select("*").eq("id", uid).maybeSingle(),
      supabaseAdmin.auth.admin.getUserById(uid),
      supabaseAdmin.from("habit_scores").select("*").eq("user_id", uid).maybeSingle(),
      supabaseAdmin
        .from("habit_score_history")
        .select("score, calculated_at")
        .eq("user_id", uid)
        .order("calculated_at", { ascending: true })
        .limit(180),
      supabaseAdmin
        .from("achievements")
        .select("achievement_key, unlocked_at")
        .eq("user_id", uid)
        .order("unlocked_at", { ascending: false }),
      supabaseAdmin
        .from("checkins")
        .select("id, created_at, location")
        .eq("user_id", uid)
        .order("created_at", { ascending: false })
        .limit(500),
      supabaseAdmin
        .from("exercise_logs")
        .select("*")
        .eq("user_id", uid)
        .order("logged_at", { ascending: false })
        .limit(500),
      supabaseAdmin
        .from("week_reviews")
        .select("*")
        .eq("user_id", uid)
        .order("created_at", { ascending: false }),
      supabaseAdmin
        .from("weeks")
        .select("id, week_number, start_date, status, plan_summary")
        .eq("user_id", uid)
        .order("week_number", { ascending: true }),
      supabaseAdmin
        .from("workout_days")
        .select("id, week_id, day_index, title, focus, completed_at, workout_date")
        .eq("user_id", uid),
      supabaseAdmin
        .from("xp_transactions")
        .select("amount, reason, created_at")
        .eq("user_id", uid)
        .order("created_at", { ascending: false })
        .limit(500),
      supabaseAdmin
        .from("admin_notes")
        .select("id, note, author_id, created_at")
        .eq("user_id", uid)
        .order("created_at", { ascending: false }),
      supabaseAdmin
        .from("user_flags")
        .select("*")
        .eq("user_id", uid)
        .order("created_at", { ascending: false }),
    ]);

    return {
      profile,
      email: authUser?.user?.email ?? null,
      score,
      history: history ?? [],
      achievements: achievements ?? [],
      checkins: checkins ?? [],
      exercises: exercises ?? [],
      reviews: reviews ?? [],
      weeks: weeks ?? [],
      workoutDays: workoutDays ?? [],
      xpTx: xpTx ?? [],
      notes: notes ?? [],
      flags: flags ?? [],
    };
  });

export const adminAddNote = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { userId: string; note: string }) => d)
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { error } = await context.supabase.from("admin_notes").insert({
      user_id: data.userId,
      author_id: context.userId,
      note: data.note,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const adminDeleteNote = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { noteId: string }) => d)
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { error } = await context.supabase.from("admin_notes").delete().eq("id", data.noteId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const adminFlagUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { userId: string; reason: string }) => d)
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { error } = await context.supabase.from("user_flags").insert({
      user_id: data.userId,
      flagged_by: context.userId,
      reason: data.reason,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const adminResolveFlag = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { flagId: string }) => d)
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { error } = await context.supabase
      .from("user_flags")
      .update({ resolved_at: new Date().toISOString(), resolved_by: context.userId })
      .eq("id", data.flagId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
