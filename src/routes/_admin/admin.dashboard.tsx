import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { adminOverviewKPIs, adminListUsers } from "@/lib/admin.functions";
import { Users, Activity, Award, Gauge, Search, Flag } from "lucide-react";

export const Route = createFileRoute("/_admin/admin/dashboard")({
  component: DashboardPage,
});

function DashboardPage() {
  const kpiFn = useServerFn(adminOverviewKPIs);
  const usersFn = useServerFn(adminListUsers);
  const kpiQ = useQuery({ queryKey: ["admin", "kpis"], queryFn: () => kpiFn() });
  const usersQ = useQuery({ queryKey: ["admin", "users"], queryFn: () => usersFn() });

  const [q, setQ] = useState("");
  const [status, setStatus] = useState<"all" | "active" | "inactive">("all");
  const [minScore, setMinScore] = useState(0);

  const filtered = useMemo(() => {
    const all = usersQ.data?.users ?? [];
    return all.filter((u) => {
      if (status === "active" && !u.is_active) return false;
      if (status === "inactive" && u.is_active) return false;
      if (u.habit_score < minScore) return false;
      if (q) {
        const s = q.toLowerCase();
        if (!u.name?.toLowerCase().includes(s) && !u.email.toLowerCase().includes(s))
          return false;
      }
      return true;
    });
  }, [usersQ.data, q, status, minScore]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Overview</h1>
        <p className="text-sm text-slate-400">
          Product-wide activity, habit trends, and per-user reports.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Kpi
          label="Total users"
          value={kpiQ.data?.totalUsers ?? "—"}
          icon={<Users className="h-4 w-4" />}
          loading={kpiQ.isLoading}
        />
        <Kpi
          label="Check-ins (7d)"
          value={kpiQ.data?.weekCheckins ?? "—"}
          icon={<Activity className="h-4 w-4" />}
          loading={kpiQ.isLoading}
        />
        <Kpi
          label="Avg habit score"
          value={kpiQ.data?.avgHabitScore ?? "—"}
          icon={<Gauge className="h-4 w-4" />}
          loading={kpiQ.isLoading}
        />
        <Kpi
          label="Achievements unlocked"
          value={kpiQ.data?.totalAchievements ?? "—"}
          icon={<Award className="h-4 w-4" />}
          loading={kpiQ.isLoading}
        />
      </div>

      <div className="rounded-2xl border border-slate-800 bg-slate-900/40">
        <div className="flex flex-wrap items-center gap-3 border-b border-slate-800 p-4">
          <div className="relative flex-1 min-w-[220px]">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search name or email"
              className="w-full rounded-md border border-slate-700 bg-slate-950 pl-9 pr-3 py-2 text-sm outline-none focus:border-indigo-500"
            />
          </div>
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value as any)}
            className="rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm"
          >
            <option value="all">All users</option>
            <option value="active">Active (14d)</option>
            <option value="inactive">Inactive</option>
          </select>
          <div className="flex items-center gap-2 text-xs text-slate-400">
            <span>Min score: {minScore}</span>
            <input
              type="range"
              min={0}
              max={100}
              value={minScore}
              onChange={(e) => setMinScore(Number(e.target.value))}
            />
          </div>
        </div>

        {usersQ.isLoading ? (
          <div className="p-8 text-center text-slate-400">Loading users…</div>
        ) : filtered.length === 0 ? (
          <div className="p-8 text-center text-slate-400">No users match these filters.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-left text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-4 py-3">User</th>
                  <th className="px-4 py-3">Goal</th>
                  <th className="px-4 py-3">Score</th>
                  <th className="px-4 py-3">XP</th>
                  <th className="px-4 py-3">Ach.</th>
                  <th className="px-4 py-3">Check-ins 14d</th>
                  <th className="px-4 py-3">Last active</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/70">
                {filtered.map((u) => (
                  <tr key={u.id} className="hover:bg-slate-800/40">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="grid h-9 w-9 place-items-center rounded-full bg-gradient-to-br from-indigo-500 to-violet-600 text-xs font-bold">
                          {(u.name || "?").trim()[0]?.toUpperCase()}
                        </div>
                        <div>
                          <div className="font-medium flex items-center gap-2">
                            {u.name || "Unnamed"}
                            {u.flagged && (
                              <Flag className="h-3 w-3 text-red-400" />
                            )}
                          </div>
                          <div className="text-xs text-slate-500">{u.email}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-slate-300">{u.goal}</td>
                    <td className="px-4 py-3">
                      <ScorePill score={u.habit_score} />
                    </td>
                    <td className="px-4 py-3 text-slate-300">{u.total_xp}</td>
                    <td className="px-4 py-3 text-slate-300">{u.achievements_count}</td>
                    <td className="px-4 py-3 text-slate-300">{u.checkins_14d}</td>
                    <td className="px-4 py-3 text-slate-400">
                      {u.last_active
                        ? new Date(u.last_active).toLocaleDateString()
                        : "—"}
                    </td>
                    <td className="px-4 py-3">
                      <Link
                        to="/admin/profile/$userId"
                        params={{ userId: u.id }}
                        className="rounded-md border border-slate-700 px-2 py-1 text-xs hover:bg-slate-800"
                      >
                        View
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

function Kpi({
  label,
  value,
  icon,
  loading,
}: {
  label: string;
  value: number | string;
  icon: React.ReactNode;
  loading?: boolean;
}) {
  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900/40 p-4">
      <div className="flex items-center justify-between text-slate-400">
        <span className="text-xs uppercase tracking-wide">{label}</span>
        <span className="text-indigo-400">{icon}</span>
      </div>
      <div className="mt-2 text-2xl font-bold">
        {loading ? <span className="text-slate-600">…</span> : value}
      </div>
    </div>
  );
}

export function ScorePill({ score }: { score: number }) {
  const tone =
    score >= 80
      ? "bg-emerald-500/15 text-emerald-300 ring-emerald-500/30"
      : score >= 50
        ? "bg-amber-500/15 text-amber-300 ring-amber-500/30"
        : "bg-rose-500/15 text-rose-300 ring-rose-500/30";
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold ring-1 ${tone}`}
    >
      {score}
    </span>
  );
}
