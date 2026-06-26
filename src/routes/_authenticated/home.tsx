import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import {
  getProfile,
  getAllPlanWeeks,
  generateFourWeekPlan,
  generatePlanFromPrompt,
} from "@/lib/gym.functions";
import {
  CheckCircle2,
  Circle,
  ChevronRight,
  Sparkles,
  RefreshCw,
  Utensils,
  Wand2,
  Flame,
  Target,
} from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/home")({
  head: () => ({
    meta: [
      { title: "Your plan — GymBuddy" },
      { name: "description", content: "Your 4-week training block, day by day." },
    ],
  }),
  component: HomePage,
});

type DietJson = {
  daily_calories: number;
  daily_protein_g: number;
  notes: string;
  meals: { name: string; items: string }[];
};

function HomePage() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const getProfileFn = useServerFn(getProfile);
  const getAllFn = useServerFn(getAllPlanWeeks);
  const generateFn = useServerFn(generateFourWeekPlan);
  const generatePromptFn = useServerFn(generatePlanFromPrompt);

  const profileQ = useQuery({ queryKey: ["profile"], queryFn: () => getProfileFn() });
  const planQ = useQuery({ queryKey: ["planWeeks"], queryFn: () => getAllFn() });

  useEffect(() => {
    if (profileQ.isSuccess && !profileQ.data) navigate({ to: "/onboarding" });
  }, [profileQ.isSuccess, profileQ.data, navigate]);

  const [selectedWeekNum, setSelectedWeekNum] = useState<number | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [promptOpen, setPromptOpen] = useState(false);
  const [customPrompt, setCustomPrompt] = useState("");

  const generate = useMutation({
    mutationFn: async () => generateFn(),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["planWeeks"] });
      qc.invalidateQueries({ queryKey: ["currentWeek"] });
      setSelectedWeekNum(null);
      setConfirmOpen(false);
      toast.success("Your 4-week plan is ready!");
    },
    onError: (e: Error) => {
      setConfirmOpen(false);
      toast.error(e.message);
    },
  });

  const generateFromPrompt = useMutation({
    mutationFn: async (prompt: string) => generatePromptFn({ data: { prompt } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["planWeeks"] });
      qc.invalidateQueries({ queryKey: ["currentWeek"] });
      setSelectedWeekNum(null);
      setPromptOpen(false);
      setCustomPrompt("");
      toast.success("Custom plan generated!");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const weeks = useMemo(() => planQ.data?.weeks ?? [], [planQ.data]);
  const days = planQ.data?.days ?? [];

  const activeWeek = useMemo(() => {
    if (weeks.length === 0) return null;
    const sel = selectedWeekNum != null
      ? weeks.find((w) => w.week_number === selectedWeekNum)
      : weeks.find((w) => w.status === "active") ?? weeks[0];
    return sel ?? weeks[0];
  }, [weeks, selectedWeekNum]);

  const activeDays = useMemo(
    () => days.filter((d) => activeWeek && d.week_id === activeWeek.id),
    [days, activeWeek],
  );

  if (profileQ.isLoading || planQ.isLoading) {
    return (
      <div className="space-y-3 pt-3">
        <div className="h-7 w-32 animate-pulse rounded bg-black/5" />
        <div className="h-20 w-full animate-pulse rounded-2xl bg-black/5" />
        <div className="h-16 w-full animate-pulse rounded-xl bg-black/5" />
      </div>
    );
  }

  if (weeks.length === 0) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center text-center px-4">
        <div className="grid h-14 w-14 place-items-center rounded-[18px] bg-[color:var(--clay-orange)] text-white shadow-[0_5px_0_0_var(--clay-orange-shadow)] mb-4">
          <Sparkles className="h-7 w-7" />
        </div>
        <h2 className="text-lg font-extrabold text-[color:var(--text-dark)]">No plan yet</h2>
        <p className="mt-1 max-w-xs text-sm text-[color:var(--text-mid)]">
          Generate a personalized 4-week training plan based on your profile.
        </p>
        <button
          disabled={generate.isPending}
          onClick={() => generate.mutate()}
          className="clay-btn mt-5 max-w-xs"
        >
          {generate.isPending ? "Generating…" : "Generate 4-week plan"}
        </button>
      </div>
    );
  }

  if (!activeWeek) return null;
  const diet = activeWeek.diet_json as DietJson | null;
  const totalDays = activeDays.length;
  const doneDays = activeDays.filter((d) => d.completed_at).length;
  const allDone = doneDays === totalDays && totalDays > 0;
  const streak = doneDays; // simple proxy for streak within the week

  return (
    <div className="space-y-4 pt-2">
      {/* Greeting */}
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-[22px] font-extrabold tracking-tight text-[color:var(--text-dark)] leading-tight">
            {profileQ.data?.name ? `Hey ${profileQ.data.name} 👋` : "Hey there 👋"}
          </h1>
          <span className="clay-pill mt-1.5">Week {activeWeek.week_number} of {weeks.length}</span>
        </div>
        <div className="flex shrink-0 flex-col gap-1.5">
          <button
            onClick={() => setPromptOpen(true)}
            disabled={generateFromPrompt.isPending}
            className="clay-btn clay-btn-outline clay-btn-sm"
            title="Generate from prompt"
          >
            <Wand2 className="h-3.5 w-3.5" /> Prompt
          </button>
          <button
            onClick={() => setConfirmOpen(true)}
            disabled={generate.isPending}
            className="clay-btn clay-btn-ghost clay-btn-sm"
            title="Regenerate"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${generate.isPending ? "animate-spin" : ""}`} />
            Reset
          </button>
        </div>
      </div>

      {/* Streak hero */}
      <div className="clay-card clay-card-orange flex items-center gap-3.5">
        <div className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-white/20 border-2 border-white/30">
          <Flame className="h-6 w-6 text-white" />
        </div>
        <div className="min-w-0">
          <div className="text-lg font-extrabold tracking-tight">{streak} day streak</div>
          <div className="text-xs text-white/75 mt-0.5">{doneDays}/{totalDays} workouts done this week</div>
        </div>
      </div>

      {/* Focus */}
      <div className="flex items-center gap-2 flex-wrap">
        <span className="focus-pill">
          <Target className="h-3.5 w-3.5" /> {activeWeek.plan_summary?.slice(0, 38) ?? "Your focus"}
        </span>
      </div>

      {/* Week switcher */}
      <div className="flex gap-2 overflow-x-auto no-scrollbar -mx-1 px-1">
        {weeks.map((w) => {
          const isActive = activeWeek.id === w.id;
          const wDays = days.filter((d) => d.week_id === w.id);
          const wDone = wDays.filter((d) => d.completed_at).length;
          return (
            <button
              key={w.id}
              onClick={() => setSelectedWeekNum(w.week_number)}
              className={`clay-day-btn min-w-[68px] ${isActive ? "clay-day-btn-active" : ""}`}
            >
              <div className="text-[9px] font-bold uppercase tracking-wider opacity-70">Week</div>
              <div className="text-base font-extrabold mt-0.5">{w.week_number}</div>
              <div className="text-[9px] opacity-80 mt-0.5">{wDone}/{wDays.length}</div>
            </button>
          );
        })}
      </div>

      {/* Progress */}
      <div className="clay-card">
        <div className="flex items-center justify-between text-sm">
          <span className="font-bold text-[color:var(--text-dark)]">Progress · Week {activeWeek.week_number}</span>
          <span className="text-[color:var(--clay-orange)] font-extrabold">{totalDays ? Math.round((doneDays/totalDays)*100) : 0}%</span>
        </div>
        <div className="prog-bar mt-2">
          <div
            className="h-full bg-[color:var(--clay-orange)] transition-all"
            style={{ width: totalDays ? `${(doneDays / totalDays) * 100}%` : "0%" }}
          />
        </div>
      </div>

      {/* Days */}
      <section>
        <div className="sec-label mb-2">Training days</div>
        <div className="clay-card divide-y divide-dashed divide-[color:var(--clay-border-soft)] p-0">
          {activeDays.map((d, i) => {
            const done = !!d.completed_at;
            const exCount = Array.isArray(d.exercises_json) ? d.exercises_json.length : 0;
            return (
              <Link
                key={d.id}
                to="/day/$dayId"
                params={{ dayId: d.id }}
                className="flex items-center gap-3 px-4 py-3.5 hover:bg-[color:var(--clay-orange-light)]/60 transition first:rounded-t-[20px] last:rounded-b-[20px]"
              >
                {done ? (
                  <CheckCircle2 className="h-5 w-5 text-[color:var(--clay-green)] shrink-0" />
                ) : (
                  <Circle className="h-5 w-5 text-[color:var(--text-light)] shrink-0" />
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-[color:var(--text-dark)] truncate">{d.title}</p>
                  <p className="text-[11px] text-[color:var(--text-mid)] mt-0.5">
                    {d.focus} · {exCount} exercises
                  </p>
                </div>
                <ChevronRight className="h-4 w-4 text-[color:var(--text-light)] shrink-0" />
                <span className="sr-only">{i}</span>
              </Link>
            );
          })}
        </div>
      </section>

      {allDone && activeWeek.status === "active" && (
        <Link to="/review/$weekId" params={{ weekId: activeWeek.id }} className="block">
          <div className="clay-card clay-card-soft-orange flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-[color:var(--clay-orange)]" />
            <span className="text-sm font-bold text-[color:var(--clay-orange-shadow)]">
              Week done — submit review →
            </span>
          </div>
        </Link>
      )}

      {/* Diet preview */}
      {diet && (
        <section>
          <div className="sec-label mb-2 flex items-center gap-1.5">
            <Utensils className="h-3.5 w-3.5" /> Today's diet target
          </div>
          <div className="clay-card">
            <div className="grid grid-cols-2 gap-3">
              <div className="clay-stat">
                <div className="text-[22px] font-extrabold text-[color:var(--text-dark)]">{diet.daily_calories}</div>
                <div className="sec-label mt-1">Kcal</div>
              </div>
              <div className="clay-stat">
                <div className="text-[22px] font-extrabold text-[color:var(--text-dark)]">{diet.daily_protein_g}g</div>
                <div className="sec-label mt-1">Protein</div>
              </div>
            </div>
            {diet.notes && (
              <p className="mt-3 text-xs text-[color:var(--text-mid)] leading-relaxed">{diet.notes}</p>
            )}
            <Link to="/diet" className="clay-btn clay-btn-outline clay-btn-sm mt-3 w-full">
              View 7-day diet plan
            </Link>
          </div>
        </section>
      )}

      {/* Confirm regenerate modal */}
      {confirmOpen && (
        <Modal onClose={() => setConfirmOpen(false)} title="Regenerate 4-week plan?">
          <p className="text-sm text-[color:var(--text-mid)]">
            This replaces your upcoming weeks with a freshly generated plan.
            Completed weeks stay in your history.
          </p>
          <div className="mt-4 flex gap-2">
            <button onClick={() => setConfirmOpen(false)} className="clay-btn clay-btn-ghost flex-1">
              Cancel
            </button>
            <button
              disabled={generate.isPending}
              onClick={() => generate.mutate()}
              className="clay-btn flex-[2]"
            >
              {generate.isPending ? "Generating…" : "Yes, regenerate"}
            </button>
          </div>
        </Modal>
      )}

      {/* Custom prompt modal */}
      {promptOpen && (
        <Modal onClose={() => { setPromptOpen(false); setCustomPrompt(""); }} title="Generate from a prompt">
          <p className="text-sm text-[color:var(--text-mid)]">
            Describe the plan you want. We'll match each exercise against the
            real exercise catalog (images + form videos).
          </p>
          <textarea
            value={customPrompt}
            onChange={(e) => setCustomPrompt(e.target.value)}
            rows={4}
            maxLength={500}
            placeholder="create a beginner friendly 5 day gym workout plan, include exercises, reps, sets and rest time"
            className="mt-3 w-full rounded-2xl border-[1.5px] border-[color:var(--clay-border)] bg-white px-3 py-2.5 text-sm outline-none focus:border-[color:var(--clay-orange)] text-[color:var(--text-dark)]"
          />
          <p className="mt-1 text-right text-[10px] text-[color:var(--text-light)]">
            {customPrompt.length}/500
          </p>
          <div className="mt-3 flex gap-2">
            <button onClick={() => { setPromptOpen(false); setCustomPrompt(""); }} className="clay-btn clay-btn-ghost flex-1">
              Cancel
            </button>
            <button
              disabled={generateFromPrompt.isPending || customPrompt.trim().length < 10}
              onClick={() => generateFromPrompt.mutate(customPrompt.trim())}
              className="clay-btn flex-[2]"
            >
              {generateFromPrompt.isPending ? "Generating…" : "Generate plan"}
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}

function Modal({ onClose, title, children }: { onClose: () => void; title: string; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/45 backdrop-blur-sm" onClick={onClose}>
      <div
        className="w-full max-w-[375px] rounded-t-[28px] bg-white p-5 pb-7 max-h-[85vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mx-auto mb-3 h-1 w-9 rounded-full bg-[color:var(--clay-border)]" />
        <h3 className="text-base font-extrabold text-[color:var(--text-dark)] mb-2">{title}</h3>
        {children}
      </div>
    </div>
  );
}
