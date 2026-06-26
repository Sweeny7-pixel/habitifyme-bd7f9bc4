import { createFileRoute, Outlet, redirect, Link, useRouterState, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { getProfile, getAllPlanWeeks } from "@/lib/gym.functions";
import {
  House,
  CalendarDays,
  Dumbbell,
  Utensils,
  User as UserIcon,
  LogOut,
} from "lucide-react";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async () => {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) throw redirect({ to: "/auth" });
    return { user: data.user };
  },
  component: AuthedShell,
});

function AuthedShell() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const navigate = useNavigate();
  const getProfileFn = useServerFn(getProfile);
  const getPlanFn = useServerFn(getAllPlanWeeks);

  const profileQ = useQuery({ queryKey: ["profile"], queryFn: () => getProfileFn() });
  const planQ = useQuery({ queryKey: ["planWeeks"], queryFn: () => getPlanFn() });

  const initial = (profileQ.data?.name?.trim()?.[0] ?? "G").toUpperCase();

  async function handleSignOut() {
    await supabase.auth.signOut();
    window.location.href = "/auth";
  }

  function openTodayWorkout() {
    const weeks = planQ.data?.weeks ?? [];
    const days = planQ.data?.days ?? [];
    if (!weeks.length) {
      navigate({ to: "/home" });
      return;
    }
    const active = weeks.find((w) => w.status === "active") ?? weeks[0];
    const activeDays = days.filter((d) => d.week_id === active.id);
    const next = activeDays.find((d) => !d.completed_at) ?? activeDays[0];
    if (next) navigate({ to: "/day/$dayId", params: { dayId: next.id } });
    else navigate({ to: "/home" });
  }

  const isActive = (prefix: string) => pathname === prefix || pathname.startsWith(prefix + "/");

  return (
    <div className="clay-shell pb-24">
      {/* Topbar */}
      <header className="sticky top-0 z-20 bg-[color:var(--shell-bg)]/95 backdrop-blur px-4 pt-4 pb-3">
        <div className="flex items-center justify-between">
          <Link to="/home" className="flex items-center gap-2">
            <div className="grid h-9 w-9 place-items-center rounded-[14px] bg-[color:var(--clay-orange)] text-white shadow-[0_3px_0_0_var(--clay-orange-shadow)]">
              <Dumbbell className="h-5 w-5" />
            </div>
            <span className="text-base font-extrabold tracking-tight text-[color:var(--text-dark)]">
              GymBuddy
            </span>
          </Link>
          <div className="flex items-center gap-2">
            <button
              onClick={handleSignOut}
              className="grid h-9 w-9 place-items-center rounded-full bg-white border-[1.5px] border-[color:var(--clay-border)] text-[color:var(--text-mid)] shadow-[0_2px_0_0_var(--clay-border)]"
              aria-label="Sign out"
            >
              <LogOut className="h-4 w-4" />
            </button>
            <Link
              to="/profile"
              className="grid h-9 w-9 place-items-center rounded-full bg-[color:var(--clay-orange)] text-white font-extrabold text-sm shadow-[0_3px_0_0_var(--clay-orange-shadow)] border-[1.5px] border-[color:var(--clay-orange-shadow)]"
              aria-label="Profile"
            >
              {initial}
            </Link>
          </div>
        </div>
      </header>

      {/* Scrollable content */}
      <main className="flex-1 px-4 pb-6">
        <Outlet />
      </main>

      {/* Bottom nav */}
      <nav className="sticky bottom-0 z-20 mx-2 mb-2 rounded-[24px] bg-white border-[1.5px] border-[color:var(--clay-border)] shadow-[0_5px_0_0_var(--clay-border)] pb-[max(0px,env(safe-area-inset-bottom))]">
        <div className="flex items-stretch justify-around px-2 py-1.5">
          <NavBtn to="/home" active={isActive("/home")} icon={<House className="h-5 w-5" />} label="Home" />
          <NavBtn to="/calendar" active={isActive("/calendar")} icon={<CalendarDays className="h-5 w-5" />} label="Calendar" />
          <button
            type="button"
            onClick={openTodayWorkout}
            className={`clay-nav-item ${isActive("/day") ? "clay-nav-item-active" : ""}`}
            aria-label="Today's workout"
          >
            <Dumbbell className="h-5 w-5" />
            <span className={`mt-1 h-[5px] w-[5px] rounded-full ${isActive("/day") ? "bg-[color:var(--clay-orange)]" : "bg-transparent"}`} />
          </button>
          <NavBtn to="/diet" active={isActive("/diet")} icon={<Utensils className="h-5 w-5" />} label="Diet" />
          <NavBtn to="/profile" active={isActive("/profile")} icon={<UserIcon className="h-5 w-5" />} label="Profile" />
        </div>
      </nav>
    </div>
  );
}

function NavBtn({
  to,
  active,
  icon,
  label,
}: {
  to: "/home" | "/calendar" | "/diet" | "/profile";
  active: boolean;
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <Link to={to} className={`clay-nav-item ${active ? "clay-nav-item-active" : ""}`} aria-label={label}>
      {icon}
      <span className={`mt-1 h-[5px] w-[5px] rounded-full ${active ? "bg-[color:var(--clay-orange)]" : "bg-transparent"}`} />
    </Link>
  );
}
