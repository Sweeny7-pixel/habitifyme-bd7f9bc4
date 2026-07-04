import { useState } from "react";
import { X, Zap, Heart } from "lucide-react";

interface RecoveryModalProps {
  daysMissed: number;
  onClose: () => void;
  onStartEasyWorkout?: () => void;
}

const BARRIER_OPTIONS = [
  "No time",
  "Low energy",
  "Soreness",
  "Sick or unwell",
  "Travelled",
  "Lost motivation",
  "Other",
];

const RECOVERY_TIPS: Record<number, string> = {
  3: "Three days off is normal — your body rested. Show up for 15 minutes today.",
  4: "Four days away is still recoverable. One small session resets the momentum.",
  5: "Five days. That's okay. One session today puts you back on track.",
  6: "Six days. Not a streak-killer — just a rest phase. Let's bounce back.",
};

/**
 * Shows when the user has been inactive for 3+ days (but less than 7 days).
 * Captures barrier reason and nudges a short recovery workout.
 */
export function RecoveryModal({ daysMissed, onClose, onStartEasyWorkout }: RecoveryModalProps) {
  const [selectedBarrier, setSelectedBarrier] = useState<string | null>(null);
  const [notes, setNotes] = useState("");
  const [submitted, setSubmitted] = useState(false);

  const tip =
    RECOVERY_TIPS[daysMissed] ??
    `You've been away ${daysMissed} days. A short session today counts.`;

  function handleSubmit() {
    // Store barrier locally for future analytics (server-side analytics can be added later)
    try {
      const existing = JSON.parse(localStorage.getItem("hm_recovery_log") ?? "[]");
      existing.push({
        daysMissed,
        barrier: selectedBarrier,
        notes,
        submittedAt: new Date().toISOString(),
      });
      localStorage.setItem("hm_recovery_log", JSON.stringify(existing.slice(-20)));
    } catch {}
    setSubmitted(true);
  }

  return (
    <div className="glass-modal-overlay" onClick={onClose}>
      <div className="glass-bottom-sheet" onClick={(e) => e.stopPropagation()}>
        <div className="glass-sheet-handle" />
        <div className="mb-3 flex items-start justify-between gap-2">
          <h3 className="text-base font-extrabold text-[var(--text-primary)]">
            {submitted ? "You've got this 💪" : `Back after ${daysMissed} days`}
          </h3>
          <button onClick={onClose} className="glass-sheet-close" aria-label="Close">
            <X className="h-4 w-4" />
          </button>
        </div>

        {!submitted ? (
          <>
            <p className="text-sm text-[var(--text-secondary)] mb-4">{tip}</p>

            <p className="text-xs font-bold uppercase tracking-wider text-[var(--text-muted)] mb-2">
              What got in the way?
            </p>
            <div className="flex flex-wrap gap-2 mb-4">
              {BARRIER_OPTIONS.map((b) => (
                <button
                  key={b}
                  onClick={() => setSelectedBarrier(b === selectedBarrier ? null : b)}
                  className={`glass-pill text-xs cursor-pointer transition-all ${
                    selectedBarrier === b
                      ? "border-[var(--neon-orange)] text-[var(--neon-orange)] bg-[rgba(255,107,53,0.12)]"
                      : ""
                  }`}
                >
                  {b}
                </button>
              ))}
            </div>

            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              maxLength={200}
              placeholder="Anything else on your mind? (optional)"
              className="glass-input mb-4"
            />

            <div className="flex gap-2">
              <button onClick={handleSubmit} className="glass-btn flex-1">
                <Heart className="h-3.5 w-3.5" /> Log & continue
              </button>
              {onStartEasyWorkout && (
                <button
                  onClick={() => {
                    handleSubmit();
                    onStartEasyWorkout();
                  }}
                  className="glass-btn flex-[2]"
                  style={{ background: "rgba(0,229,160,0.12)", borderColor: "rgba(0,229,160,0.35)" }}
                >
                  <Zap className="h-3.5 w-3.5 text-[var(--neon-green)]" />
                  <span className="text-[var(--neon-green)]">15-min workout +20 XP</span>
                </button>
              )}
            </div>
          </>
        ) : (
          <div className="text-center py-4">
            <p className="text-sm text-[var(--text-secondary)] mb-4">
              Thanks for checking in. Every comeback starts with one session. Your plan is waiting.
            </p>
            <button onClick={onClose} className="glass-btn w-full">
              Let's go →
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// localStorage helpers for recovery modal dismissal
const RECOVERY_KEY = "hm_recovery_dismissed";

export function hasSeenRecoveryToday(): boolean {
  if (typeof window === "undefined") return false;
  try {
    const raw = localStorage.getItem(RECOVERY_KEY);
    if (!raw) return false;
    const { date } = JSON.parse(raw) as { date?: string };
    return date === new Date().toDateString();
  } catch {
    return false;
  }
}

export function markRecoveryDismissed(): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(RECOVERY_KEY, JSON.stringify({ date: new Date().toDateString() }));
  } catch {}
}
