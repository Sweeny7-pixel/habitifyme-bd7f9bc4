import {
  createFileRoute,
  Outlet,
  redirect,
  Link,
  useNavigate,
  useRouterState,
} from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { LayoutDashboard, Users, BarChart3, LogOut, Shield } from "lucide-react";

export const Route = createFileRoute("/_admin")({
  ssr: false,
  beforeLoad: async () => {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) throw redirect({ to: "/admin/login" });
    const { data: isAdmin } = await supabase.rpc("has_role", {
      _user_id: data.user.id,
      _role: "admin",
    });
    if (!isAdmin) {
      await supabase.auth.signOut();
      throw redirect({ to: "/admin/login" });
    }
    return { user: data.user };
  },
  component: AdminShell,
});

function AdminShell() {
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  async function signOut() {
    await supabase.auth.signOut();
    navigate({ to: "/admin/login" });
  }

  const navItems = [
    { to: "/admin/dashboard", label: "Dashboard", icon: LayoutDashboard },
    { to: "/admin/reports", label: "Reports", icon: BarChart3 },
  ] as const;

  return (
    <div className="min-h-dvh bg-slate-950 text-slate-100">
      <div className="flex min-h-dvh">
        <aside className="hidden md:flex w-60 shrink-0 flex-col border-r border-slate-800 bg-slate-900/60 p-4">
          <div className="mb-8 flex items-center gap-2">
            <div className="grid h-9 w-9 place-items-center rounded-lg bg-gradient-to-br from-indigo-500 to-violet-600">
              <Shield className="h-5 w-5" />
            </div>
            <div>
              <div className="text-xs font-semibold uppercase tracking-widest text-indigo-400">
                Habitify
              </div>
              <div className="text-sm font-semibold">Admin</div>
            </div>
          </div>
          <nav className="flex-1 space-y-1">
            {navItems.map((it) => {
              const active =
                pathname === it.to || pathname.startsWith(it.to + "/");
              return (
                <Link
                  key={it.to}
                  to={it.to}
                  className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition ${
                    active
                      ? "bg-indigo-500/10 text-indigo-300 ring-1 ring-indigo-500/30"
                      : "text-slate-300 hover:bg-slate-800/60"
                  }`}
                >
                  <it.icon className="h-4 w-4" />
                  {it.label}
                </Link>
              );
            })}
          </nav>
          <button
            onClick={signOut}
            className="mt-4 flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-slate-400 hover:bg-slate-800/60 hover:text-slate-100"
          >
            <LogOut className="h-4 w-4" />
            Log out
          </button>
        </aside>

        <div className="flex-1 flex flex-col min-w-0">
          <header className="flex h-14 items-center justify-between border-b border-slate-800 bg-slate-900/40 px-6">
            <div className="flex items-center gap-2 md:hidden">
              <Users className="h-4 w-4 text-indigo-400" />
              <span className="text-sm font-semibold">Habitify Admin</span>
            </div>
            <div className="ml-auto flex items-center gap-3 text-sm text-slate-400">
              <span>admin@habitify.com</span>
              <button
                onClick={signOut}
                className="md:hidden rounded-md border border-slate-700 px-2 py-1 text-xs hover:bg-slate-800"
              >
                Log out
              </button>
            </div>
          </header>
          <main className="flex-1 overflow-x-hidden p-6">
            <Outlet />
          </main>
        </div>
      </div>
    </div>
  );
}
