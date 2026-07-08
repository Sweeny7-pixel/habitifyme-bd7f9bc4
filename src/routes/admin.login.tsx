import { createFileRoute, redirect, useNavigate, Link } from "@tanstack/react-router";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/admin/login")({
  ssr: false,
  beforeLoad: async () => {
    const { data } = await supabase.auth.getUser();
    if (data.user) {
      const { data: role } = await supabase.rpc("has_role", {
        _user_id: data.user.id,
        _role: "admin",
      });
      if (role) throw redirect({ to: "/admin/dashboard" });
    }
  },
  component: AdminLogin,
});

function AdminLogin() {
  const [email, setEmail] = useState("admin@habitify.com");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const { data, error: signErr } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      if (signErr || !data.user) {
        throw new Error(signErr?.message ?? "Invalid credentials");
      }
      const { data: isAdmin } = await supabase.rpc("has_role", {
        _user_id: data.user.id,
        _role: "admin",
      });
      if (!isAdmin) {
        await supabase.auth.signOut();
        throw new Error("This account is not authorized to access the admin dashboard.");
      }
      navigate({ to: "/admin/dashboard" });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sign in failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-dvh grid place-items-center bg-slate-950 px-4">
      <div className="w-full max-w-md rounded-2xl border border-slate-800 bg-slate-900/80 p-8 shadow-2xl backdrop-blur">
        <div className="mb-6">
          <div className="text-xs font-semibold uppercase tracking-widest text-indigo-400">
            Habitify
          </div>
          <h1 className="mt-1 text-2xl font-bold text-white">Admin sign in</h1>
          <p className="mt-1 text-sm text-slate-400">
            Internal operations dashboard. Authorized admins only.
          </p>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-300">Email</label>
            <input
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="mt-1 w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-white outline-none focus:border-indigo-500"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-300">Password</label>
            <input
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="mt-1 w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-white outline-none focus:border-indigo-500"
              required
            />
          </div>
          {error && (
            <div className="rounded-md border border-red-900/50 bg-red-950/40 px-3 py-2 text-sm text-red-300">
              {error}
            </div>
          )}
          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-md bg-indigo-600 py-2 text-sm font-semibold text-white transition hover:bg-indigo-500 disabled:opacity-60"
          >
            {loading ? "Signing in…" : "Sign in"}
          </button>
        </form>
        <div className="mt-6 flex justify-between text-xs text-slate-500">
          <Link to="/" className="hover:text-slate-300">
            ← Back to app
          </Link>
          <span>Seed: admin@habitify.com</span>
        </div>
      </div>
    </div>
  );
}
