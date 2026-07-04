import { useMemo, useState } from "react";
import { Calendar } from "@/components/ui/calendar";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Loader2, CalendarDays } from "lucide-react";
import {
  MAX_START_DATE_OFFSET_DAYS,
  addDaysIso,
  parseIsoDate,
  shortDateLabel,
  todayIstIso,
  toIsoDate,
} from "@/lib/plan-dates";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (startDateIso: string) => void;
  busy?: boolean;
  title?: string;
  description?: string;
  confirmLabel?: string;
};

/**
 * Modal that captures the user's desired plan start date before any
 * generate/regenerate call. Day 1 of the plan will be this date.
 */
export function StartDateModal({
  open,
  onOpenChange,
  onConfirm,
  busy,
  title = "When do you want to start?",
  description = "Day 1 of your plan will be this date. Start today or pick a day in the next two weeks.",
  confirmLabel = "Generate my plan",
}: Props) {
  const today = todayIstIso();
  const maxIso = addDaysIso(today, MAX_START_DATE_OFFSET_DAYS);
  const [selected, setSelected] = useState<Date | undefined>(() => parseIsoDate(today));

  const minDate = useMemo(() => parseIsoDate(today), [today]);
  const maxDate = useMemo(() => parseIsoDate(maxIso), [maxIso]);

  const selectedIso = selected ? toIsoDate(selected) : today;

  return (
    <Dialog open={open} onOpenChange={(v) => !busy && onOpenChange(v)}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base font-extrabold">
            <CalendarDays className="h-4 w-4 text-[var(--neon-orange)]" />
            {title}
          </DialogTitle>
          <DialogDescription className="text-xs text-[var(--text-secondary)]">
            {description}
          </DialogDescription>
        </DialogHeader>

        <div className="rounded-xl border border-white/10 bg-white/[0.02] p-2 pointer-events-auto">
          <Calendar
            mode="single"
            selected={selected}
            onSelect={setSelected}
            initialFocus
            disabled={(d) => d < minDate || d > maxDate}
            className="p-1 pointer-events-auto"
          />
        </div>

        <div className="rounded-lg bg-[rgba(255,107,53,0.08)] px-3 py-2 text-xs text-[var(--text-secondary)]">
          Day 1 → <span className="font-extrabold text-[var(--neon-orange)]">{shortDateLabel(selectedIso)}</span>
        </div>

        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            disabled={busy}
            className="glass-btn glass-btn-ghost flex-1"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => onConfirm(selectedIso)}
            disabled={busy || !selected}
            className="glass-btn flex-[2]"
          >
            {busy ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin" /> Generating…
              </>
            ) : (
              confirmLabel
            )}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
