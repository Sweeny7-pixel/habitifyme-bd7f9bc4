import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";
import { ArrowLeft, Flag, Trash2 } from "lucide-react";
import {
  adminGetUserDetail,
  adminAddNote,
  adminDeleteNote,
  adminFlagUser,
  adminResolveFlag,
} from "@/lib/admin.functions";
import { ACHIEVEMENT_DEFS } from "@/lib/achievements";

export const Route = createFileRoute("/_admin/admin/profile/$userId")({
  component: ProfilePage,
});

type Tab =
  | "overview"
  | "trend"
  | "achievements"
  | "checkins"
  | "exercise"
  | "reviews"
  | "weekly-exercises"
  | "admin";

function ProfilePage() {
  const { userId } = Route.useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const detailFn = useServerFn(adminGetUserDetail);
  const q = useQuery({
    queryKey: ["admin", "user", userId],
    queryFn: () => detailFn({ data: { userId } }),
  });
  const [tab, setTab] = useState<Tab>("overview");
  const [trendRange, setTrendRange] = useState<30 | 90>(30);

  const d = q.data;

  const invalidate = () =>
    qc.invalidateQueries({ queryKey: ["admin", "user", userId] });

  if (q.isLoading) return <div className="p-8 text-slate-400">Loading…</div>;
  if (!d?.profile)
    return <div className="p-8 text-slate-400">User not found.</div>;

  const totalXP = d.xpTx.reduce((s: number, t: any) => s + (t.amount ?? 0), 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <button
          onClick={() => navigate({ to: "/admin/dashboard" })}
          className="rounded-md border border-slate-700 p-2 hover:bg-slate-800"
        >
          <ArrowLeft className="h-4 w-4" />
        </button>
        <div>
          <div className="text-xs text-slate-500">User report</div>
          <h1 className="text-2xl font-bold">{d.profile.name || "Unnamed"}</h1>
        </div>
      </div>

      {/* HEADER CARD */}
      <div className="rounded-2xl border border-slate-800 bg-slate-900/40 p-6">
        <div className="flex flex-wrap items-center gap-6">
          <div className="grid h-20 w-20 place-items-center rounded-full bg-gradient-to-br from-indigo-500 to-violet-600 text-2xl font-bold">
            {(d.profile.name || "?").trim()[0]?.toUpperCase()}
          </div>
          <div className="flex-1 min-w-[240px]">
            <div className="text-lg font-semibold">{d.profile.name}</div>
            <div className="text-sm text-slate-400">{d.email ?? "—"}</div>
            <div className="mt-1 text-xs text-slate-500">
              Joined {new Date(d.profile.created_at).toLocaleDateString()} · Goal:{" "}
              {d.profile.goal} · {d.profile.experience}
            </div>
          </div>
          <StatBlock label="Habit score" value={d.score?.score ?? 0} kind="gauge" />
          <StatBlock label="Score (7d)" value={d.score?.score_7d ?? 0} />
          <StatBlock label="Score (30d)" value={d.score?.score_30d ?? 0} />
          <StatBlock label="Total XP" value={totalXP} />
          <StatBlock label="Achievements" value={d.achievements.length} />
        </div>
      </div>

      {/* TAB NAV */}
      <div className="flex flex-wrap gap-1 border-b border-slate-800">
        {(
          [
            ["overview", "Overview"],
            ["trend", "Habit Trend"],
            ["achievements", "Achievements"],
            ["checkins", "Check-ins"],
            ["exercise", "Exercise Logs"],
            ["reviews", "Week Reviews"],
            ["weekly-exercises", "All Weeks' Exercises"],
            ["admin", "Admin"],
          ] as [Tab, string][]
        ).map(([k, label]) => (
          <button
            key={k}
            onClick={() => setTab(k)}
            className={`px-3 py-2 text-sm border-b-2 transition ${
              tab === k
                ? "border-indigo-500 text-indigo-300"
                : "border-transparent text-slate-400 hover:text-slate-200"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* OVERVIEW */}
      {tab === "overview" && (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <Section title="Recent achievements">
            {d.achievements.slice(0, 6).length === 0 ? (
              <Empty>No achievements yet.</Empty>
            ) : (
              <div className="grid grid-cols-2 gap-3">
                {d.achievements.slice(0, 6).map((a: any) => {
                  const def = ACHIEVEMENT_DEFS.find((x) => x.key === a.achievement_key);
                  return (
                    <div
                      key={a.achievement_key}
                      className="rounded-lg border border-slate-800 bg-slate-900/60 p-3"
                    >
                      <div className="text-xl">{def?.icon ?? "🏅"}</div>
                      <div className="mt-1 text-sm font-medium">{def?.label ?? a.achievement_key}</div>
                      <div className="text-xs text-slate-500">
                        {new Date(a.unlocked_at).toLocaleDateString()}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </Section>
          <Section title="Last 14 check-ins">
            <div className="space-y-1 text-sm">
              {d.checkins.slice(0, 14).map((c: any) => (
                <div key={c.id} className="flex justify-between text-slate-300">
                  <span>{new Date(c.created_at).toLocaleString()}</span>
                  <span className="text-slate-500">{c.location ?? "—"}</span>
                </div>
              ))}
              {d.checkins.length === 0 && <Empty>No check-ins yet.</Empty>}
            </div>
          </Section>
        </div>
      )}

      {/* TREND */}
      {tab === "trend" && (
        <Section
          title="Habit score over time"
          right={
            <div className="flex gap-1 text-xs">
              {[30, 90].map((n) => (
                <button
                  key={n}
                  onClick={() => setTrendRange(n as 30 | 90)}
                  className={`rounded px-2 py-1 ${
                    trendRange === n
                      ? "bg-indigo-500/20 text-indigo-300"
                      : "text-slate-400 hover:bg-slate-800"
                  }`}
                >
                  {n}d
                </button>
              ))}
            </div>
          }
        >
          <TrendChart history={d.history} days={trendRange} xpTx={d.xpTx} />
        </Section>
      )}

      {/* ACHIEVEMENTS */}
      {tab === "achievements" && (
        <AchievementsGrid unlocked={d.achievements} />
      )}

      {/* CHECK-INS */}
      {tab === "checkins" && <CheckinsSection checkins={d.checkins} />}

      {/* EXERCISE */}
      {tab === "exercise" && <ExerciseSection logs={d.exercises} />}

      {/* REVIEWS */}
      {tab === "reviews" && <ReviewsSection reviews={d.reviews} weeks={d.weeks} />}

      {/* WEEKLY EXERCISES */}
      {tab === "weekly-exercises" && (
        <WeeklyExercisesSection
          exercises={d.exercises}
          weeks={d.weeks}
          workoutDays={d.workoutDays}
        />
      )}

      {/* ADMIN */}
      {tab === "admin" && (
        <AdminSection
          userId={userId}
          notes={d.notes}
          flags={d.flags}
          onChanged={invalidate}
        />
      )}
    </div>
  );
}

function StatBlock({
  label,
  value,
  kind,
}: {
  label: string;
  value: number;
  kind?: "gauge";
}) {
  return (
    <div className="min-w-[100px]">
      <div className="text-xs uppercase tracking-wide text-slate-500">{label}</div>
      <div className="mt-1 flex items-baseline gap-1">
        <span className="text-2xl font-bold">{value}</span>
        {kind === "gauge" && <span className="text-xs text-slate-500">/100</span>}
      </div>
      {kind === "gauge" && (
        <div className="mt-1 h-1.5 w-24 overflow-hidden rounded-full bg-slate-800">
          <div
            className="h-full bg-gradient-to-r from-indigo-500 to-violet-500"
            style={{ width: `${Math.min(100, value)}%` }}
          />
        </div>
      )}
    </div>
  );
}

function Section({
  title,
  right,
  children,
}: {
  title: string;
  right?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900/40 p-6">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="font-semibold">{title}</h2>
        {right}
      </div>
      {children}
    </div>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return <div className="py-6 text-center text-sm text-slate-500">{children}</div>;
}

function TrendChart({
  history,
  days,
  xpTx,
}: {
  history: { score: number; calculated_at: string }[];
  days: 30 | 90;
  xpTx: { amount: number; created_at: string }[];
}) {
  const data = useMemo(() => {
    const cutoff = Date.now() - days * 86400000;
    const byDay = new Map<string, { date: string; score?: number; xp: number }>();
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date(Date.now() - i * 86400000);
      const key = d.toISOString().slice(0, 10);
      byDay.set(key, { date: key, xp: 0 });
    }
    for (const h of history) {
      const t = new Date(h.calculated_at).getTime();
      if (t < cutoff) continue;
      const key = h.calculated_at.slice(0, 10);
      const row = byDay.get(key);
      if (row) row.score = h.score;
    }
    for (const tx of xpTx) {
      const t = new Date(tx.created_at).getTime();
      if (t < cutoff) continue;
      const key = tx.created_at.slice(0, 10);
      const row = byDay.get(key);
      if (row) row.xp += tx.amount;
    }
    return Array.from(byDay.values());
  }, [history, days, xpTx]);

  if (data.every((d) => d.score === undefined && d.xp === 0))
    return <Empty>No trend data yet.</Empty>;

  return (
    <div className="h-72 w-full">
      <ResponsiveContainer>
        <LineChart data={data}>
          <CartesianGrid stroke="#1e293b" strokeDasharray="3 3" />
          <XAxis dataKey="date" stroke="#64748b" fontSize={11} />
          <YAxis stroke="#64748b" fontSize={11} domain={[0, 100]} />
          <Tooltip
            contentStyle={{
              background: "#0f172a",
              border: "1px solid #334155",
              borderRadius: 8,
            }}
          />
          <Line
            type="monotone"
            dataKey="score"
            stroke="#818cf8"
            strokeWidth={2}
            dot={false}
            connectNulls
            name="Habit score"
          />
          <Line
            type="monotone"
            dataKey="xp"
            stroke="#f59e0b"
            strokeWidth={1.5}
            dot={false}
            name="Daily XP"
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

function AchievementsGrid({
  unlocked,
}: {
  unlocked: { achievement_key: string; unlocked_at: string }[];
}) {
  const unlockedMap = new Map(unlocked.map((u) => [u.achievement_key, u.unlocked_at]));
  return (
    <Section title="Achievements">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {ACHIEVEMENT_DEFS.map((a) => {
          const at = unlockedMap.get(a.key);
          const isUnlocked = !!at;
          return (
            <div
              key={a.key}
              className={`rounded-lg border p-4 ${
                isUnlocked
                  ? "border-indigo-500/30 bg-indigo-500/5"
                  : "border-slate-800 bg-slate-900/40 opacity-50"
              }`}
            >
              <div className="text-2xl">{a.icon}</div>
              <div className="mt-2 text-sm font-semibold">{a.label}</div>
              <div className="mt-1 text-xs text-slate-400">{a.description}</div>
              <div className="mt-2 text-[11px] text-slate-500">
                {isUnlocked ? `Unlocked ${new Date(at!).toLocaleDateString()}` : "Locked"}
              </div>
            </div>
          );
        })}
      </div>
    </Section>
  );
}

function CheckinsSection({
  checkins,
}: {
  checkins: { id: string; created_at: string; location: string | null }[];
}) {
  const [filter, setFilter] = useState("");
  const heatmap = useMemo(() => {
    const days = 105; // 15 weeks × 7
    const buckets: Record<string, number> = {};
    for (const c of checkins) {
      const key = c.created_at.slice(0, 10);
      buckets[key] = (buckets[key] ?? 0) + 1;
    }
    const cells: { date: string; count: number }[] = [];
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date(Date.now() - i * 86400000);
      const key = d.toISOString().slice(0, 10);
      cells.push({ date: key, count: buckets[key] ?? 0 });
    }
    return cells;
  }, [checkins]);

  const filtered = filter
    ? checkins.filter((c) =>
        (c.location ?? "").toLowerCase().includes(filter.toLowerCase()),
      )
    : checkins;

  return (
    <div className="space-y-6">
      <Section title="Activity heatmap (15 weeks)">
        <div className="flex flex-wrap gap-[3px]">
          {heatmap.map((c) => (
            <div
              key={c.date}
              title={`${c.date}: ${c.count}`}
              className="h-3.5 w-3.5 rounded-[3px]"
              style={{
                background:
                  c.count === 0
                    ? "#1e293b"
                    : c.count === 1
                      ? "#4338ca80"
                      : c.count === 2
                        ? "#6366f1"
                        : "#a78bfa",
              }}
            />
          ))}
        </div>
      </Section>
      <Section
        title="Check-in log"
        right={
          <input
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            placeholder="Filter location…"
            className="rounded-md border border-slate-700 bg-slate-950 px-2 py-1 text-xs"
          />
        }
      >
        {filtered.length === 0 ? (
          <Empty>No check-ins.</Empty>
        ) : (
          <div className="max-h-96 overflow-y-auto">
            <table className="w-full text-sm">
              <thead className="text-left text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-2 py-2">Date</th>
                  <th className="px-2 py-2">Location</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {filtered.map((c) => (
                  <tr key={c.id}>
                    <td className="px-2 py-2">{new Date(c.created_at).toLocaleString()}</td>
                    <td className="px-2 py-2 text-slate-400">{c.location ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Section>
    </div>
  );
}

function ExerciseSection({ logs }: { logs: any[] }) {
  const weekly = useMemo(() => {
    const buckets: Record<string, { week: string; sessions: number; sets: number }> = {};
    for (const l of logs) {
      const d = new Date(l.logged_at);
      const start = new Date(d);
      start.setDate(d.getDate() - d.getDay());
      const key = start.toISOString().slice(0, 10);
      if (!buckets[key]) buckets[key] = { week: key, sessions: 0, sets: 0 };
      buckets[key].sessions += 1;
      buckets[key].sets += l.sets_completed ?? 0;
    }
    return Object.values(buckets).sort((a, b) => a.week.localeCompare(b.week)).slice(-12);
  }, [logs]);

  return (
    <div className="space-y-6">
      <Section title="Weekly exercise volume">
        {weekly.length === 0 ? (
          <Empty>No exercise logs yet this week.</Empty>
        ) : (
          <div className="h-56">
            <ResponsiveContainer>
              <BarChart data={weekly}>
                <CartesianGrid stroke="#1e293b" strokeDasharray="3 3" />
                <XAxis dataKey="week" stroke="#64748b" fontSize={11} />
                <YAxis stroke="#64748b" fontSize={11} />
                <Tooltip
                  contentStyle={{
                    background: "#0f172a",
                    border: "1px solid #334155",
                    borderRadius: 8,
                  }}
                />
                <Bar dataKey="sets" fill="#818cf8" name="Sets" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </Section>
      <Section title="Exercise log">
        {logs.length === 0 ? (
          <Empty>No exercises logged.</Empty>
        ) : (
          <div className="max-h-[500px] overflow-y-auto">
            <table className="w-full text-sm">
              <thead className="text-left text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-2 py-2">Date</th>
                  <th className="px-2 py-2">Exercise</th>
                  <th className="px-2 py-2">Sets</th>
                  <th className="px-2 py-2">Reps</th>
                  <th className="px-2 py-2">Weight</th>
                  <th className="px-2 py-2">RPE</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {logs.map((l) => (
                  <tr key={l.id}>
                    <td className="px-2 py-2">{new Date(l.logged_at).toLocaleDateString()}</td>
                    <td className="px-2 py-2">{l.exercise_name}</td>
                    <td className="px-2 py-2">{l.sets_completed}</td>
                    <td className="px-2 py-2 text-slate-400">{l.reps ?? "—"}</td>
                    <td className="px-2 py-2 text-slate-400">
                      {l.weight_kg ? `${l.weight_kg} kg` : "—"}
                    </td>
                    <td className="px-2 py-2 text-slate-400">{l.rpe ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Section>
    </div>
  );
}

function ReviewsSection({ reviews, weeks }: { reviews: any[]; weeks: any[] }) {
  const weekById = new Map(weeks.map((w) => [w.id, w]));
  return (
    <Section title="Weekly reviews">
      {reviews.length === 0 ? (
        <Empty>No weekly reviews yet.</Empty>
      ) : (
        <div className="space-y-3">
          {reviews.map((r) => {
            const w = weekById.get(r.week_id);
            return (
              <details
                key={r.id}
                className="rounded-lg border border-slate-800 bg-slate-900/40 p-4"
              >
                <summary className="cursor-pointer list-none">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-sm font-semibold">
                        Week {w?.week_number ?? "?"} ·{" "}
                        {w?.start_date
                          ? new Date(w.start_date).toLocaleDateString()
                          : ""}
                      </div>
                      <div className="text-xs text-slate-500">
                        Completion {r.completion_pct}% · Energy {r.energy ?? "—"} · Soreness{" "}
                        {r.soreness ?? "—"}
                      </div>
                    </div>
                    <div className="text-xs text-slate-500">expand</div>
                  </div>
                </summary>
                <div className="mt-3 space-y-2 text-sm text-slate-300">
                  {w?.plan_summary && (
                    <div>
                      <span className="text-slate-500">Plan:</span> {w.plan_summary}
                    </div>
                  )}
                  {r.notes && (
                    <div>
                      <span className="text-slate-500">Notes:</span> {r.notes}
                    </div>
                  )}
                  {r.difficulty_pref && (
                    <div>
                      <span className="text-slate-500">Difficulty preference:</span>{" "}
                      {r.difficulty_pref}
                    </div>
                  )}
                </div>
              </details>
            );
          })}
        </div>
      )}
    </Section>
  );
}

function WeeklyExercisesSection({
  exercises,
  weeks,
  workoutDays,
}: {
  exercises: any[];
  weeks: any[];
  workoutDays: any[];
}) {
  const dayToWeek = new Map(workoutDays.map((d) => [d.id, d.week_id]));
  const weekMeta = new Map(weeks.map((w) => [w.id, w]));

  const grouped = useMemo(() => {
    const byWeek: Record<string, any[]> = {};
    for (const ex of exercises) {
      const wid = dayToWeek.get(ex.workout_day_id) ?? "unassigned";
      if (!byWeek[wid]) byWeek[wid] = [];
      byWeek[wid].push(ex);
    }
    return Object.entries(byWeek)
      .map(([wid, items]) => ({
        weekId: wid,
        week: weekMeta.get(wid),
        items,
        sets: items.reduce((s, i) => s + (i.sets_completed ?? 0), 0),
        sessions: items.length,
      }))
      .sort((a, b) => (b.week?.week_number ?? 0) - (a.week?.week_number ?? 0));
  }, [exercises, dayToWeek, weekMeta]);

  return (
    <Section title="All weeks' exercises">
      {grouped.length === 0 ? (
        <Empty>No exercise history.</Empty>
      ) : (
        <div className="space-y-3">
          {grouped.map((g) => (
            <details
              key={g.weekId}
              className="rounded-lg border border-slate-800 bg-slate-900/40"
            >
              <summary className="cursor-pointer list-none p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-sm font-semibold">
                      {g.week
                        ? `Week ${g.week.week_number} · ${new Date(g.week.start_date).toLocaleDateString()}`
                        : "Unassigned"}
                    </div>
                    <div className="text-xs text-slate-500">
                      {g.sessions} sessions · {g.sets} sets logged
                    </div>
                  </div>
                </div>
              </summary>
              <div className="max-h-80 overflow-y-auto border-t border-slate-800 p-4">
                <table className="w-full text-sm">
                  <thead className="text-left text-xs uppercase tracking-wide text-slate-500">
                    <tr>
                      <th className="px-2 py-2">Date</th>
                      <th className="px-2 py-2">Exercise</th>
                      <th className="px-2 py-2">Sets</th>
                      <th className="px-2 py-2">Reps</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60">
                    {g.items.map((l: any) => (
                      <tr key={l.id}>
                        <td className="px-2 py-2">
                          {new Date(l.logged_at).toLocaleDateString()}
                        </td>
                        <td className="px-2 py-2">{l.exercise_name}</td>
                        <td className="px-2 py-2">{l.sets_completed}</td>
                        <td className="px-2 py-2 text-slate-400">{l.reps ?? "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </details>
          ))}
        </div>
      )}
    </Section>
  );
}

function AdminSection({
  userId,
  notes,
  flags,
  onChanged,
}: {
  userId: string;
  notes: any[];
  flags: any[];
  onChanged: () => void;
}) {
  const [note, setNote] = useState("");
  const [reason, setReason] = useState("");
  const addFn = useServerFn(adminAddNote);
  const delFn = useServerFn(adminDeleteNote);
  const flagFn = useServerFn(adminFlagUser);
  const resolveFn = useServerFn(adminResolveFlag);

  const addNote = useMutation({
    mutationFn: () => addFn({ data: { userId, note } }),
    onSuccess: () => {
      setNote("");
      onChanged();
    },
  });
  const del = useMutation({
    mutationFn: (id: string) => delFn({ data: { noteId: id } }),
    onSuccess: onChanged,
  });
  const flag = useMutation({
    mutationFn: () => flagFn({ data: { userId, reason } }),
    onSuccess: () => {
      setReason("");
      onChanged();
    },
  });
  const resolve = useMutation({
    mutationFn: (id: string) => resolveFn({ data: { flagId: id } }),
    onSuccess: onChanged,
  });

  const openFlags = flags.filter((f) => !f.resolved_at);

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
      <Section title="Admin notes">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (note.trim()) addNote.mutate();
          }}
          className="mb-4 flex gap-2"
        >
          <input
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Add an internal note…"
            className="flex-1 rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm"
          />
          <button
            type="submit"
            disabled={addNote.isPending || !note.trim()}
            className="rounded-md bg-indigo-600 px-3 py-2 text-sm font-semibold hover:bg-indigo-500 disabled:opacity-50"
          >
            Add
          </button>
        </form>
        {notes.length === 0 ? (
          <Empty>No notes yet.</Empty>
        ) : (
          <ul className="space-y-2">
            {notes.map((n) => (
              <li
                key={n.id}
                className="flex items-start justify-between rounded-md border border-slate-800 bg-slate-900/60 p-3 text-sm"
              >
                <div>
                  <div className="text-slate-200">{n.note}</div>
                  <div className="mt-1 text-xs text-slate-500">
                    {new Date(n.created_at).toLocaleString()}
                  </div>
                </div>
                <button
                  onClick={() => del.mutate(n.id)}
                  className="ml-2 rounded p-1 text-slate-500 hover:bg-slate-800 hover:text-red-400"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </Section>

      <Section
        title="Flag user"
        right={
          openFlags.length > 0 ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-red-500/15 px-2 py-0.5 text-xs text-red-300 ring-1 ring-red-500/30">
              <Flag className="h-3 w-3" /> {openFlags.length} open
            </span>
          ) : null
        }
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (reason.trim()) flag.mutate();
          }}
          className="mb-4 flex gap-2"
        >
          <input
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Reason for flagging"
            className="flex-1 rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm"
          />
          <button
            type="submit"
            disabled={flag.isPending || !reason.trim()}
            className="rounded-md bg-red-600 px-3 py-2 text-sm font-semibold hover:bg-red-500 disabled:opacity-50"
          >
            Flag
          </button>
        </form>
        {flags.length === 0 ? (
          <Empty>No flags.</Empty>
        ) : (
          <ul className="space-y-2">
            {flags.map((f) => (
              <li
                key={f.id}
                className="rounded-md border border-slate-800 bg-slate-900/60 p-3 text-sm"
              >
                <div className="flex items-start justify-between">
                  <div>
                    <div className="text-slate-200">{f.reason}</div>
                    <div className="mt-1 text-xs text-slate-500">
                      Raised {new Date(f.created_at).toLocaleString()}
                      {f.resolved_at &&
                        ` · Resolved ${new Date(f.resolved_at).toLocaleString()}`}
                    </div>
                  </div>
                  {!f.resolved_at && (
                    <button
                      onClick={() => resolve.mutate(f.id)}
                      className="ml-2 rounded-md border border-slate-700 px-2 py-1 text-xs hover:bg-slate-800"
                    >
                      Resolve
                    </button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </Section>
    </div>
  );
}
