import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { getWeekDiet, getAllWeeks } from "@/lib/gym.functions";
import { Utensils, Flame, Loader2, Dumbbell, Moon, RefreshCw, Coffee, Soup, Apple, ChefHat } from "lucide-react";

export const Route = createFileRoute("/_authenticated/diet")({
  head: () => ({
    meta: [
      { title: "Diet — GymBuddy" },
      { name: "description", content: "Your 7-day India-friendly diet plan, tuned for workout and rest days." },
    ],
  }),
  component: DietPage,
});

const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"] as const;
const DAY_SHORT = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
type DayName = (typeof DAYS)[number];

type Meal = { items: string[]; approxCalories: number };
type DietDay = {
  day: DayName;
  isWorkoutDay: boolean;
  meals: { breakfast: Meal; lunch: Meal; eveningSnack: Meal; dinner: Meal };
  totalApproxCalories: number;
  proteinNote: string;
};
type SevenDayDiet = { days: DietDay[] };

function isSevenDayDiet(value: unknown): value is SevenDayDiet {
  const v = value as { days?: unknown } | null;
  return !!v && Array.isArray(v.days) && v.days.length === 7 && !!(v.days[0] as DietDay)?.meals;
}

function todayIndex() {
  const js = new Date().getDay();
  return (js + 6) % 7;
}

function DietPage() {
  const getAllWeeksFn = useServerFn(getAllWeeks);
  const allQ = useQuery({ queryKey: ["allWeeksDiet"], queryFn: () => getAllWeeksFn() });

  const weeks = useMemo(() => (allQ.data?.weeks ?? []).slice().sort((a, b) => a.week_number - b.week_number), [allQ.data]);
  const defaultWeekId = useMemo(() => {
    const active = weeks.find((w) => w.status === "active");
    return active?.id ?? weeks[weeks.length - 1]?.id ?? null;
  }, [weeks]);

  const [selectedWeekId, setSelectedWeekId] = useState<string | null>(null);
  const weekId = selectedWeekId ?? defaultWeekId;

  if (allQ.isLoading) return <CenterSpinner label="Loading your diet plan…" />;
  if (!weeks.length) {
    return (
      <EmptyState
        title="No diet plan yet"
        body="Generate your first week and your 7-day diet plan will show up here."
        cta={<Link to="/home" className="clay-btn clay-btn-sm">Go to home</Link>}
      />
    );
  }

  return (
    <div className="space-y-4 pt-2">
      <header>
        <h1 className="text-[22px] font-extrabold tracking-tight text-[color:var(--text-dark)] leading-tight">
          7-day Indian plan 🍛
        </h1>
        <p className="mt-1 text-sm text-[color:var(--text-mid)]">Workout-day vs rest-day meals tuned to your goal.</p>
      </header>

      <div className="flex gap-2 overflow-x-auto no-scrollbar -mx-1 px-1">
        {weeks.map((w) => {
          const active = w.id === weekId;
          return (
            <button
              key={w.id}
              onClick={() => setSelectedWeekId(w.id)}
              className={`whitespace-nowrap rounded-full border-[1.5px] px-4 py-2 text-xs font-bold transition shadow-[0_3px_0_0_var(--clay-border)] ${
                active
                  ? "bg-[color:var(--clay-orange)] border-[color:var(--clay-orange-shadow)] text-white shadow-[0_3px_0_0_var(--clay-orange-shadow)]"
                  : "bg-white border-[color:var(--clay-border)] text-[color:var(--text-mid)]"
              }`}
            >
              Week {w.week_number}
            </button>
          );
        })}
      </div>

      {weekId && <WeekDietView weekId={weekId} />}
    </div>
  );
}

function WeekDietView({ weekId }: { weekId: string }) {
  const qc = useQueryClient();
  const getDietFn = useServerFn(getWeekDiet);
  const dietQ = useQuery({
    queryKey: ["weekDiet", weekId],
    queryFn: () => getDietFn({ data: { weekId } }),
    retry: 1,
  });

  const [dayIdx, setDayIdx] = useState<number>(() => todayIndex());

  if (dietQ.isLoading || dietQ.isFetching) return <CenterSpinner label="Generating your diet plan…" />;
  if (dietQ.isError) {
    return (
      <div className="clay-card clay-card-soft-red text-sm">
        Couldn't load your diet plan. {(dietQ.error as Error)?.message}
        <button onClick={() => dietQ.refetch()} className="clay-btn clay-btn-sm mt-3">
          Try again
        </button>
      </div>
    );
  }
  if (!dietQ.data) return <EmptyState title="No diet for this week" body="Try selecting another week." />;

  const diet = dietQ.data.diet as SevenDayDiet | undefined;
  if (!diet || !isSevenDayDiet(diet)) {
    return (
      <div className="clay-card">
        <p className="font-bold text-[color:var(--text-dark)]">Upgrade to the new 7-day plan?</p>
        <p className="mt-1 text-sm text-[color:var(--text-mid)]">
          Your old plan was a single daily target. The new plan gives you Mon–Sun meals tuned for workout vs rest days.
        </p>
        <button
          onClick={async () => {
            await getDietFn({ data: { weekId, regenerate: true } });
            qc.invalidateQueries({ queryKey: ["weekDiet", weekId] });
          }}
          className="clay-btn clay-btn-sm mt-3"
        >
          <RefreshCw className="h-3.5 w-3.5" /> Generate 7-day plan
        </button>
      </div>
    );
  }

  const day = diet.days[dayIdx];
  const isToday = dayIdx === todayIndex();

  return (
    <div className="space-y-4">
      {/* Day strip */}
      <div className="grid grid-cols-7 gap-1.5">
        {DAY_SHORT.map((label, i) => {
          const active = i === dayIdx;
          const isWorkout = diet.days[i]?.isWorkoutDay;
          return (
            <button
              key={label}
              onClick={() => setDayIdx(i)}
              className={`clay-day-btn ${active ? "clay-day-btn-active" : ""}`}
            >
              <div className={`text-[9px] font-bold uppercase tracking-wider ${active ? "text-white/80" : "text-[color:var(--text-light)]"}`}>
                {label}
              </div>
              <div className={`mx-auto mt-1 h-[5px] w-[5px] rounded-full ${
                isWorkout
                  ? active ? "bg-white/70" : "bg-[color:var(--clay-orange)]"
                  : "bg-transparent"
              }`} />
            </button>
          );
        })}
      </div>

      {/* Day badge */}
      <div className="flex items-center gap-2 flex-wrap">
        {day.isWorkoutDay ? (
          <span className="focus-pill"><Dumbbell className="h-3.5 w-3.5" /> Workout day</span>
        ) : (
          <span className="clay-pill"><Moon className="h-3 w-3" /> Rest day</span>
        )}
        {isToday && <span className="clay-pill">Today</span>}
        <span className="ml-auto text-[11px] font-semibold text-[color:var(--text-mid)]">{day.day}</span>
      </div>

      {/* Meals */}
      <div className="space-y-3">
        <MealCard title="Breakfast" icon={<Coffee className="h-3.5 w-3.5" />} meal={day.meals.breakfast} />
        <MealCard title="Lunch" icon={<Soup className="h-3.5 w-3.5" />} meal={day.meals.lunch} />
        <MealCard title="Evening Snack" icon={<Apple className="h-3.5 w-3.5" />} meal={day.meals.eveningSnack} />
        <MealCard title="Dinner" icon={<ChefHat className="h-3.5 w-3.5" />} meal={day.meals.dinner} />
      </div>

      {/* Total */}
      <div className="clay-card clay-card-soft-orange flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm text-[color:var(--clay-orange-shadow)] font-bold">
          <Flame className="h-4 w-4" /> Total today
        </div>
        <div className="text-lg font-extrabold tracking-tight text-[color:var(--clay-orange-shadow)]">
          ~{day.totalApproxCalories} kcal
        </div>
      </div>

      {/* Protein note */}
      {day.proteinNote && (
        <div className="clay-card clay-card-soft-green text-sm leading-relaxed text-[color:var(--clay-green-shadow)]">
          💪 {day.proteinNote}
        </div>
      )}

      <button
        onClick={async () => {
          await getDietFn({ data: { weekId, regenerate: true } });
          qc.invalidateQueries({ queryKey: ["weekDiet", weekId] });
        }}
        className="clay-btn clay-btn-ghost clay-btn-sm"
      >
        <RefreshCw className="h-3.5 w-3.5" /> Regenerate this week
      </button>
    </div>
  );
}

function MealCard({ title, icon, meal }: { title: string; icon: React.ReactNode; meal: Meal }) {
  return (
    <div className="clay-card">
      <div className="flex items-baseline justify-between">
        <h3 className="text-sm font-extrabold text-[color:var(--text-dark)] flex items-center gap-1.5">
          <span className="text-[color:var(--clay-orange)]">{icon}</span> {title}
        </h3>
        <span className="kcal-pill">~{meal.approxCalories} kcal</span>
      </div>
      <div className="mt-2.5 flex flex-wrap gap-1.5">
        {meal.items.map((item, i) => (
          <span key={i} className="muscle-pill">{item}</span>
        ))}
      </div>
    </div>
  );
}

function CenterSpinner({ label }: { label: string }) {
  return (
    <div className="flex min-h-[40vh] flex-col items-center justify-center gap-3 text-center">
      <Loader2 className="h-6 w-6 animate-spin text-[color:var(--clay-orange)]" />
      <p className="text-sm text-[color:var(--text-mid)]">{label}</p>
    </div>
  );
}

function EmptyState({ title, body, cta }: { title: string; body: string; cta?: React.ReactNode }) {
  return (
    <div className="flex min-h-[50vh] flex-col items-center justify-center text-center px-4">
      <Utensils className="mb-3 h-8 w-8 text-[color:var(--text-light)]" />
      <h2 className="text-lg font-extrabold text-[color:var(--text-dark)]">{title}</h2>
      <p className="mt-1 max-w-xs text-sm text-[color:var(--text-mid)]">{body}</p>
      {cta && <div className="mt-4">{cta}</div>}
    </div>
  );
}
