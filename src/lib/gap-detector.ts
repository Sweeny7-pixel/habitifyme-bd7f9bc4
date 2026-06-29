// Client-only gap detection. Reads gymbuddy_lastCheckin from localStorage
// and classifies the gap into a tier so the root layout can show a
// banner or a "what to do next" modal.

export type GapTier = "none" | "short" | "medium" | "long";

export interface GapResult {
  tier: GapTier;
  daysMissed: number | null;
  shouldShowBanner: boolean;
  bannerMessage: string | null;
  requiresUserChoice: boolean;
}

const LAST_CHECKIN_KEY = "gymbuddy_lastCheckin";
const GAP_CHOICE_KEY = "gymbuddy_gap_choice";

export function recordCheckin(date: Date = new Date()) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(LAST_CHECKIN_KEY, date.toISOString());
    localStorage.removeItem(GAP_CHOICE_KEY);
  } catch {
    /* ignore */
  }
}

export function readLastCheckin(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return localStorage.getItem(LAST_CHECKIN_KEY);
  } catch {
    return null;
  }
}

export function clearLastCheckin() {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(LAST_CHECKIN_KEY);
  } catch {
    /* ignore */
  }
}

export function detectGap(lastCheckinISO: string | null): GapResult {
  const none: GapResult = {
    tier: "none",
    daysMissed: null,
    shouldShowBanner: false,
    bannerMessage: null,
    requiresUserChoice: false,
  };
  if (!lastCheckinISO) return none;
  const last = new Date(lastCheckinISO);
  if (isNaN(last.getTime())) return none;
  const daysMissed = Math.floor((Date.now() - last.getTime()) / 86_400_000);
  if (daysMissed <= 0) return { ...none, daysMissed: 0 };
  if (daysMissed <= 3) {
    return { tier: "short", daysMissed, shouldShowBanner: false, bannerMessage: null, requiresUserChoice: false };
  }
  if (daysMissed <= 6) {
    return {
      tier: "medium",
      daysMissed,
      shouldShowBanner: true,
      bannerMessage: `You're back after ${daysMissed} days. Picking up where you left off 💪`,
      requiresUserChoice: false,
    };
  }
  return {
    tier: "long",
    daysMissed,
    shouldShowBanner: false,
    bannerMessage: null,
    requiresUserChoice: true,
  };
}

export function hasChosenTodayAlready(): boolean {
  if (typeof window === "undefined") return false;
  try {
    const raw = localStorage.getItem(GAP_CHOICE_KEY);
    if (!raw) return false;
    const { decidedAt } = JSON.parse(raw) as { decidedAt?: string };
    if (!decidedAt) return false;
    return new Date(decidedAt).toDateString() === new Date().toDateString();
  } catch {
    return false;
  }
}

export function saveGapChoice(choice: "reset" | "resume") {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(
      GAP_CHOICE_KEY,
      JSON.stringify({ choice, decidedAt: new Date().toISOString() }),
    );
  } catch {
    /* ignore */
  }
}