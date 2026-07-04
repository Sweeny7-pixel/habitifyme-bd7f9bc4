import { useState } from "react";
import { X, CalendarCheck, Plane } from "lucide-react";

interface SundayPlanningModalProps {
  onClose: () => void;
  onConfirm: (opts: { travelMode: boolean; unavailableDays: string[] }) => void;
}

const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

/**
 * Sunday evening planning modal.
 * Awards XP and allows user to flag travel / unavailable days for next week.
 */
export function SundayPlanningModal({ onClose, onConfirm }: SundayPlanningModalProps) {
  const [travelMode, setTravelMode] = useState(false);
  const [unavailableDays, setUnavailableDays] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);

  function toggleDay(day: string) {
    setUnavailableDays((prev) =>
      prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day],
    );
  }

  async function handleConfirm() {
    setSubmitting(true);
    try {
      await onConfirm({ travelMode, unavailableDays });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="glass-modal-overlay" onClick={onClose}>
      <div className="glass-bottom-sheet" onClick={(e) => e.stopPropagation()}>
        <div className="glass-sheet-handle" />
        <div className="mb-3 flex items-start justify-between gap-2">
          <h3 className="text-base font-extrabold text-[var(--text-primary)]">
            Ready for next week? 📅
          </h3>
          <button onClick={onClose} className="glass-sheet-close" aria-label="Close">
            <X className="h-4 w-4" />
          </button>
        </div>

        <p className="text-sm text-[var(--text-secondary)] mb-4">
          Set yourself up for a great week. +30 XP for planning ahead.
        </p>

        {/* Travel mode toggle */}
        <button
          onClick={() => setTravelMode(!travelMode)}
          className={`flex items-center gap-2 w-full glass-pill mb-4 py-2.5 px-3 text-left transition-all ${
            travelMode
              ? "border-[var(--neon-blue)] text-[var(--neon-blue)] bg-[rgba(77,158,255,0.12)]"
              : ""
          }`}
        >
          <Plane className="h-4 w-4 shrink-0" />
          <span className="text-sm font-semibold">Travel mode next week</span>
          <span className="ml-auto text-xs text-[var(--text-muted)]">
            {travelMode ? "On" : "Off"}
          </span>
        </button>

        {/* Unavailable days */}
        <p className="text-xs font-bold uppercase tracking-wider text-[var(--text-muted)] mb-2">
          Days I can't train
        </p>
        <div className="flex flex-wrap gap-2 mb-5">
          {DAYS.map((day) => (
            <button
              key={day}
              onClick={() => toggleDay(day)}
              className={`glass-pill text-xs cursor-pointer transition-all ${
                unavailableDays.includes(day)
                  ? "border-[var(--neon-orange)] text-[var(--neon-orange)] bg-[rgba(255,107,53,0.12)]"
                  : ""
              }`}
            >
              {day.slice(0, 3)}
            </button>
          ))}
        </div>

        <div className="flex gap-2">
          <button onClick={onClose} className="glass-btn glass-btn-ghost flex-1">
            Later
          </button>
          <button disabled={submitting} onClick={handleConfirm} className="glass-btn flex-[2]">
            <CalendarCheck className="h-3.5 w-3.5" />
            {submitting ? "Saving…" : "Confirm plan +30 XP"}
          </button>
        </div>
      </div>
    </div>
  );
}

// localStorage helpers
const SUNDAY_KEY = "hm_sunday_planning";

export function hasCompletedSundayPlanningThisWeek(): boolean {
  if (typeof window === "undefined") return false;
  try {
    const raw = localStorage.getItem(SUNDAY_KEY);
    if (!raw) return false;
    const { weekOf } = JSON.parse(raw) as { weekOf?: string };
    // weekOf is the ISO string of the Sunday
    const thisWeekSunday = getThisSunday().toDateString();
    return weekOf === thisWeekSunday;
  } catch {
    return false;
  }
}

export function markSundayPlanningDone(): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(
      SUNDAY_KEY,
      JSON.stringify({ weekOf: getThisSunday().toDateString() }),
    );
  } catch {}
}

export function isSundayEvening(): boolean {
  const now = new Date();
  return now.getDay() === 0 && now.getHours() >= 18; // Sunday after 6pm
}

function getThisSunday(): Date {
  const d = new Date();
  d.setDate(d.getDate() - d.getDay() + 7); // next Sunday (or today if Sunday)
  d.setHours(0, 0, 0, 0);
  return d;
}
