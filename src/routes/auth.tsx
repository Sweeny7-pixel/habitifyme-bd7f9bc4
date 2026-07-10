import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Dumbbell } from "lucide-react";
import { toast } from "sonner";
import { lovable } from "@/integrations/lovable/index";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Sign in — HabitifyMe" },
      { name: "description", content: "Sign in or create your HabitifyMe account." },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  // Default to "signin" so the initial React render matches the SSR shell
  // (BUG-002 — otherwise the visible "Sign in" button silently POSTed /signup).
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) navigate({ to: "/home" });
    });
  }, [navigate]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      if (mode === "signup") {
        const { data, error } = await supabase.auth.signUp({
          email, password,
          options: { emailRedirectTo: window.location.origin + "/home" },
        });
        if (error) {
          if (/registered|exists/i.test(error.message)) {
            toast.error("That email is already registered. Please sign in.");
            setMode("signin");
            return;
          }
          throw error;
        }
        if (!data.session) {
          toast.info("Check your inbox to confirm your email, then sign in.");
          setMode("signin");
          setPassword("");
          return;
        }
        toast.success("Account created. Let's set you up.");
        navigate({ to: "/home" });
        return;
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        navigate({ to: "/home" });
        return;
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Something went wrong";
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-dvh bg-[var(--bg-base)] text-[var(--text-primary)]">
      <div className="mx-auto flex min-h-dvh w-full max-w-[480px] flex-col justify-center px-5 py-10">
        <Link to="/" className="mb-8 flex items-center gap-2">
          <div className="grid h-9 w-9 place-items-center rounded-[12px] bg-[var(--neon-orange)] text-white shadow-[0_0_18px_var(--neon-orange-glow)]">
            <Dumbbell className="h-5 w-5" />
          </div>
          <span className="text-lg font-extrabold tracking-tight">HabitifyMe</span>
        </Link>

        <h1 className="text-[26px] font-extrabold tracking-tight">
          {mode === "signup" ? "Create your account" : "Welcome back"}
        </h1>
        <p className="mt-1 text-sm text-[var(--text-secondary)]">
          {mode === "signup" ? "Takes 30 seconds. No card needed." : "Sign in to your weekly plan."}
        </p>

        <form onSubmit={handleSubmit} className="mt-7 space-y-3">
          <input
            type="email" required placeholder="Email" value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="glass-input"
          />
          <input
            type="password" required placeholder="Password (min 6 chars)" minLength={6} value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="glass-input"
          />
          <button type="submit" disabled={loading} className="glass-btn w-full">
            {loading ? "…" : mode === "signup" ? "Create account" : "Sign in"}
          </button>
        </form>

        <div className="my-5 flex items-center gap-3 text-xs text-[var(--text-secondary)]">
          <div className="h-px flex-1 bg-white/10" />
          <span>or</span>
          <div className="h-px flex-1 bg-white/10" />
        </div>

        <button
          type="button"
          onClick={async () => {
            setLoading(true);
            try {
              const result = await lovable.auth.signInWithOAuth("google", {
                redirect_uri: window.location.origin + "/auth",
              });
              if (result.error) throw result.error;
              if (result.redirected) return;
              navigate({ to: "/home" });
            } catch (err) {
              toast.error(err instanceof Error ? err.message : "Google sign-in failed");
            } finally {
              setLoading(false);
            }
          }}
          disabled={loading}
          className="glass-btn w-full flex items-center justify-center gap-2 !bg-white !text-black hover:!bg-white/90"
        >
          <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true">
            <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
            <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
            <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>
            <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
          </svg>
          Continue with Google
        </button>

        <button
          onClick={() => setMode(mode === "signup" ? "signin" : "signup")}
          className="mt-5 text-center text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
        >
          {mode === "signup" ? "Already have an account? Sign in" : "New here? Create account"}
        </button>
      </div>
    </div>
  );
}
