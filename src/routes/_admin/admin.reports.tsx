import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { adminListUsers } from "@/lib/admin.functions";
import { Link } from "@tanstack/react-router";
import { ScorePill } from "./admin.dashboard";

type SortKey =
  | "name"
  | "habit_score"
  | "habit_score_7d"
  | "checkins_14d"
  | "achievements_count"
  | "total_xp";

export const Route = createFileRoute("/_admin/admin/reports")({
  component: ReportsPage,
});

function ReportsPage() {
  const usersFn = useServerFn(adminListUsers);
  const q = useQuery({ queryKey: ["admin", "users"], queryFn: () => usersFn() });
  const [sort, setSort] = useState<SortKey>("habit_score");
  const [dir, setDir] = useState<"asc" | "desc">("desc");

  const rows = useMemo(() => {
    const all = [...(q.data?.users ?? [])];
    all.sort((a: any, b: any) => {
      const av = a[sort] ?? 0;
      const bv = b[sort] ?? 0;
      if (typeof av === "string") {
        return dir === "asc" ? av.localeCompare(bv) : bv.localeCompare(av);
      }
      return dir === "asc" ? av - bv : bv - av;
    });
    return all;
  }, [q.data, sort, dir]);

  function toggle(k: SortKey) {
    if (sort === k) setDir((d) => (d === "asc" ? "desc" : "asc"));
    else {
      setSort(k);
      setDir("desc");
    }
  }

  const H = ({ k, children }: { k: SortKey; children: React.ReactNode }) => (
    <th
      className="cursor-pointer px-4 py-3 text-left text-xs uppercase tracking-wide text-slate-500 hover:text-slate-200"
      onClick={() => toggle(k)}
    >
      {children} {sort === k ? (dir === "asc" ? "↑" : "↓") : ""}
    </th>
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Reports</h1>
        <p className="text-sm text-slate-400">
          Cross-user comparison — spot top performers and at-risk users.
        </p>
      </div>
      <div className="rounded-2xl border border-slate-800 bg-slate-900/40 overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr>
              <H k="name">User</H>
              <H k="habit_score">Habit score</H>
              <H k="habit_score_7d">7d score</H>
              <H k="checkins_14d">Check-ins 14d</H>
              <H k="achievements_count">Achievements</H>
              <H k="total_xp">Total XP</H>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/70">
            {rows.map((u: any) => (
              <tr key={u.id} className="hover:bg-slate-800/40">
                <td className="px-4 py-3">
                  <div className="font-medium">{u.name || "Unnamed"}</div>
                  <div className="text-xs text-slate-500">{u.email}</div>
                </td>
                <td className="px-4 py-3">
                  <ScorePill score={u.habit_score} />
                </td>
                <td className="px-4 py-3 text-slate-300">{u.habit_score_7d}</td>
                <td className="px-4 py-3 text-slate-300">{u.checkins_14d}</td>
                <td className="px-4 py-3 text-slate-300">{u.achievements_count}</td>
                <td className="px-4 py-3 text-slate-300">{u.total_xp}</td>
                <td className="px-4 py-3">
                  <Link
                    to="/admin/profile/$userId"
                    params={{ userId: u.id }}
                    className="rounded-md border border-slate-700 px-2 py-1 text-xs hover:bg-slate-800"
                  >
                    Open
                  </Link>
                </td>
              </tr>
            ))}
            {rows.length === 0 && !q.isLoading && (
              <tr>
                <td colSpan={7} className="px-4 py-10 text-center text-slate-400">
                  No users yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
