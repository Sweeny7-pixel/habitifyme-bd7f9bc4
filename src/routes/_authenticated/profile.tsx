import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState, useEffect } from "react";
import { getProfile, getAllWeeks, updateAllergies } from "@/lib/gym.functions";
import { supabase } from "@/integrations/supabase/client";
import {
  Loader2,
  User as UserIcon,
  Activity,
  Ruler,
  Scale,
  Target,
  Award,
  CalendarDays,
  Dumbbell,
  AlertTriangle,
  X,
  Plus,
  Heart,
  LogOut,
  TrendingUp,
  Settings,
} from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/profile")({
  head: () => ({
    meta: [
      { title: "Profile — GymBuddy" },
      { name: "description", content: "Your training profile, stats, and preferences." },
    ],
  }),
  component: ProfilePage,
});

function ProfilePage() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const getProfileFn = useServerFn(getProfile);
  const getAllWeeksFn = useServerFn(getAllWeeks);
  const updateAllergiesFn = useServerFn(updateAllergies);

  const profileQ = useQuery({ queryKey: ["profile"], queryFn: () => getProfileFn() });
  const weeksQ = useQuery({ queryKey: ["allWeeks"], queryFn: () => getAllWeeksFn() });

  const [tags, setTags] = useState<string[]>([]);
  const [draft, setDraft] = useState("");

  useEffect(() => {
    if (profileQ.data?.allergies) {
      setTags(
        profileQ.data.allergies
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean),
      );
    } else {
      setTags([]);
    }
  }, [profileQ.data?.allergies]);

  const saveAllergies = useMutation({
    mutationFn: async (next: string[]) =>
      updateAllergiesFn({ data: { allergies: next.join(", ") } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["profile"] });
      toast.success("Allergies updated. Diet will regenerate on refresh.");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const stats = useMemo(() => {
    const weeks = weeksQ.data?.weeks ?? [];
    const reviews = weeksQ.data?.reviews ?? [];
    const avg = reviews.length
      ? Math.round(reviews.reduce((s, r) => s + r.completion_pct, 0) / reviews.length)
      : 0;
    return {
      weeksStarted: weeks.length,
      weeksDone: weeks.filter((w) => w.status === "completed").length,
      avgCompletion: avg,
      reviewsDone: reviews.length,
      weeks,
      reviews,
    };
  }, [weeksQ.data]);

  if (profileQ.isLoading) {
    return (
      <div className="flex justify-center pt-16">
        <Loader2 className="h-6 w-6 animate-spin text-[color:var(--clay-orange)]" />
      </div>
    );
  }

  const p = profileQ.data;
  if (!p) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center text-center px-4">
        <UserIcon className="mb-3 h-8 w-8 text-[color:var(--text-light)]" />
        <h2 className="text-lg font-extrabold text-[color:var(--text-dark)]">No profile yet</h2>
        <p className="mt-1 max-w-xs text-sm text-[color:var(--text-mid)]">
          Set up your profile to personalize your plan.
        </p>
        <Link to="/onboarding" className="clay-btn clay-btn-sm mt-4">Start onboarding</Link>
      </div>
    );
  }

  const initial = (p.name?.trim()?.[0] ?? "G").toUpperCase();

  function addTag() {
    const v = draft.trim();
    if (!v || tags.includes(v)) {
      setDraft("");
      return;
    }
    const next = [...tags, v];
    setTags(next);
    setDraft("");
    saveAllergies.mutate(next);
  }
  function removeTag(t: string) {
    const next = tags.filter((x) => x !== t);
    setTags(next);
    saveAllergies.mutate(next);
  }

  async function signOut() {
    await supabase.auth.signOut();
    navigate({ to: "/auth" });
  }

  return (
    <div className="space-y-4 pt-2">
      {/* Hero */}
      <div className="clay-card clay-card-orange flex items-center gap-4">
        <div className="grid h-14 w-14 shrink-0 place-items-center rounded-full bg-white/25 border-[3px] border-white/50 text-white font-extrabold text-xl shadow-[0_4px_0_0_rgba(0,0,0,0.2)]">
          {initial}
        </div>
        <div className="min-w-0">
          <div className="text-xl font-extrabold tracking-tight truncate">{p.name}</div>
          <div className="text-xs text-white/80 mt-0.5 capitalize">
            {p.goal} · {p.experience}
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-2.5">
        <StatCard label="Weeks started" value={String(stats.weeksStarted)} />
        <StatCard label="Weeks done" value={String(stats.weeksDone)} />
        <StatCard label="Avg completion" value={`${stats.avgCompletion}%`} />
        <StatCard label="Reviews done" value={String(stats.reviewsDone)} />
      </div>

      {/* Details */}
      <section>
        <div className="sec-label mb-2">Profile details</div>
        <div className="clay-card divide-y divide-dashed divide-[color:var(--clay-border-soft)] p-0">
          <DetailRow icon={<UserIcon className="h-3.5 w-3.5" />} k="Age" v={p.age ? `${p.age}` : "—"} />
          <DetailRow icon={<Ruler className="h-3.5 w-3.5" />} k="Height" v={p.height_cm ? `${p.height_cm} cm` : "—"} />
          <DetailRow icon={<Scale className="h-3.5 w-3.5" />} k="Weight" v={p.weight_kg ? `${p.weight_kg} kg` : "—"} />
          <DetailRow icon={<Activity className="h-3.5 w-3.5" />} k="Experience" v={p.experience} />
          <DetailRow icon={<Dumbbell className="h-3.5 w-3.5" />} k="Equipment" v={p.equipment} />
          <DetailRow icon={<CalendarDays className="h-3.5 w-3.5" />} k="Days / week" v={`${p.days_per_week}`} />
          <DetailRow icon={<Target className="h-3.5 w-3.5" />} k="Goal" v={p.goal} />
          {p.injuries && (
            <DetailRow icon={<Heart className="h-3.5 w-3.5" />} k="Injuries" v={p.injuries} />
          )}
        </div>
      </section>

      {/* Allergies */}
      <section>
        <div className="sec-label mb-2 flex items-center gap-1.5">
          <AlertTriangle className="h-3.5 w-3.5" /> Food allergies
        </div>
        <div className="clay-card clay-card-soft-red">
          <p className="text-xs text-[color:var(--clay-red-shadow)] leading-relaxed">
            Add foods we should never include in your diet. Regenerate the diet plan
            after changes.
          </p>
          {tags.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-3">
              {tags.map((t) => (
                <span key={t} className="allergy-tag">
                  {t}
                  <button onClick={() => removeTag(t)} aria-label={`Remove ${t}`} className="text-[color:var(--clay-red-shadow)]">
                    <X className="h-3 w-3" />
                  </button>
                </span>
              ))}
            </div>
          )}
          <div className="flex gap-2 mt-3">
            <input
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  addTag();
                }
              }}
              placeholder="e.g. peanuts"
              className="flex-1 rounded-full border-[1.5px] border-[color:var(--clay-border)] bg-white px-3.5 py-2 text-xs font-semibold text-[color:var(--text-dark)] outline-none focus:border-[color:var(--clay-orange)]"
            />
            <button
              onClick={addTag}
              className="rounded-full bg-[color:var(--clay-orange)] text-white px-3 py-2 text-xs font-bold shadow-[0_3px_0_0_var(--clay-orange-shadow)] inline-flex items-center gap-1"
            >
              <Plus className="h-3.5 w-3.5" /> Add
            </button>
          </div>
        </div>
      </section>

      {/* Weekly progress */}
      <section>
        <div className="sec-label mb-2 flex items-center gap-1.5">
          <TrendingUp className="h-3.5 w-3.5" /> Weekly progress
        </div>
        <div className="clay-card space-y-2.5">
          {stats.weeks.length === 0 && (
            <p className="text-xs text-[color:var(--text-mid)]">
              Complete your first week to see your progress here.
            </p>
          )}
          {stats.weeks.map((w) => {
            const r = stats.reviews.find((x) => x.week_id === w.id);
            const pct = r?.completion_pct ?? 0;
            return (
              <div key={w.id} className="flex items-center gap-3">
                <div className="w-14 shrink-0 text-[11px] font-bold text-[color:var(--text-mid)]">
                  Week {w.week_number}
                </div>
                <div className="flex-1 prog-bar">
                  <div className="h-full bg-[color:var(--clay-orange)]" style={{ width: `${pct}%` }} />
                </div>
                <div className="w-9 text-right text-[11px] font-extrabold text-[color:var(--clay-orange)]">
                  {pct}%
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* Actions */}
      <section className="space-y-2">
        <Link to="/progress" className="clay-btn clay-btn-outline">
          <Award className="h-4 w-4" /> View full progress
        </Link>
        <Link to="/onboarding" className="clay-btn clay-btn-ghost">
          <Settings className="h-4 w-4" /> Edit profile
        </Link>
        <button onClick={signOut} className="clay-btn clay-btn-ghost">
          <LogOut className="h-4 w-4" /> Sign out
        </button>
      </section>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="clay-stat">
      <div className="text-[22px] font-extrabold text-[color:var(--text-dark)] tracking-tight">{value}</div>
      <div className="sec-label mt-1">{label}</div>
    </div>
  );
}

function DetailRow({ icon, k, v }: { icon: React.ReactNode; k: string; v: string }) {
  return (
    <div className="flex items-center justify-between px-4 py-2.5">
      <div className="flex items-center gap-2 text-xs font-semibold text-[color:var(--text-mid)]">
        <span className="text-[color:var(--text-light)]">{icon}</span> {k}
      </div>
      <div className="text-[13px] font-extrabold text-[color:var(--text-dark)] capitalize">{v}</div>
    </div>
  );
}
