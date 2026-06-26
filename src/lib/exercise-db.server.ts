/**
 * Server-only helper around the free-exercise-db catalog.
 *
 * Prefers a locally-enriched JSON at `src/data/exercises-enriched.json`
 * (produced by `npm run build:exercises`). If that file isn't present,
 * falls back to fetching the upstream raw JSON and synthesizing the same
 * enriched shape on the fly so the rest of the app keeps working.
 */

export type EnrichedExercise = {
  id: string;
  name: string;
  force?: string | null;
  level: string;
  mechanic?: string | null;
  equipment?: string | null;
  primaryMuscles: string[];
  secondaryMuscles: string[];
  instructions: string[] | string;
  category: string;
  images: string[]; // already absolute URLs
  youtubeLink: string;
};

const IMAGE_BASE =
  "https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/";
const CATALOG_URL =
  "https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/dist/exercises.json";
const YT_BASE = "https://www.youtube.com/results?search_query=";

function youtubeLink(name: string, equipment?: string | null) {
  const parts = ["how to do", String(name || "").trim()];
  const eq = String(equipment || "").trim().toLowerCase();
  if (eq && eq !== "body only" && eq !== "none" && eq !== "null") {
    parts.push(String(equipment).trim());
  }
  parts.push("form");
  const query = parts.filter(Boolean).join(" ");
  return YT_BASE + encodeURIComponent(query).replaceAll("+", "%20");
}

type RawExercise = Omit<EnrichedExercise, "images" | "youtubeLink"> & {
  images: string[];
  youtubeLink?: string;
};

let cachePromise: Promise<EnrichedExercise[]> | null = null;
let indexCache: {
  byNormName: Map<string, EnrichedExercise>;
  all: EnrichedExercise[];
} | null = null;

async function loadCatalog(): Promise<EnrichedExercise[]> {
  if (cachePromise) return cachePromise;

  cachePromise = (async () => {
    // Try the locally-enriched file first (committed by the user after running
    // `npm run build:exercises`). Use Vite's glob import so the build doesn't
    // fail when the file doesn't exist yet.
    const locals = import.meta.glob("@/data/exercises-enriched.json", {
      eager: false,
      import: "default",
    }) as Record<string, () => Promise<EnrichedExercise[]>>;
    const loader = Object.values(locals)[0];
    if (loader) {
      try {
        const data = await loader();
        if (Array.isArray(data) && data.length > 0) return data;
      } catch {
        // fall through to network
      }
    }

    const res = await fetch(CATALOG_URL);
    if (!res.ok) {
      throw new Error(`Exercise catalog fetch failed: ${res.status}`);
    }
    const raw = (await res.json()) as RawExercise[];
    return raw.map((ex) => ({
      ...ex,
      images: Array.isArray(ex.images)
        ? ex.images.map((p) => (p.startsWith("http") ? p : IMAGE_BASE + p))
        : [],
      youtubeLink: ex.youtubeLink ?? youtubeLink(ex.name, ex.equipment),
    }));
  })().catch((err) => {
    cachePromise = null;
    throw err;
  });

  return cachePromise;
}

function normalize(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function tokenize(s: string): Set<string> {
  return new Set(normalize(s).split(" ").filter((w) => w.length > 1));
}

function jaccard(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 || b.size === 0) return 0;
  let inter = 0;
  for (const t of a) if (b.has(t)) inter++;
  return inter / (a.size + b.size - inter);
}

async function getIndex() {
  if (indexCache) return indexCache;
  const all = await loadCatalog();
  const byNormName = new Map<string, EnrichedExercise>();
  for (const ex of all) byNormName.set(normalize(ex.name), ex);
  indexCache = { all, byNormName };
  return indexCache;
}

export type FindOpts = {
  name?: string;
  muscle?: string;
  equipment?: string;
  level?: string;
};

/** Best single match for an exercise hint, or null if nothing reasonable. */
export async function findExercise(opts: FindOpts): Promise<EnrichedExercise | null> {
  const idx = await getIndex();
  const wantName = opts.name ? normalize(opts.name) : "";
  if (wantName) {
    const exact = idx.byNormName.get(wantName);
    if (exact) return exact;
  }

  const wantMuscle = opts.muscle ? normalize(opts.muscle) : "";
  const wantEq = opts.equipment ? normalize(opts.equipment) : "";
  const wantLevel = opts.level ? normalize(opts.level) : "";
  const wantTokens = wantName ? tokenize(wantName) : new Set<string>();

  let best: { score: number; ex: EnrichedExercise } | null = null;
  for (const ex of idx.all) {
    let score = 0;
    if (wantTokens.size > 0) {
      score += jaccard(wantTokens, tokenize(ex.name)) * 3;
    }
    if (wantMuscle && ex.primaryMuscles.some((m) => normalize(m) === wantMuscle)) {
      score += 1;
    }
    if (wantEq && ex.equipment && normalize(ex.equipment) === wantEq) {
      score += 0.5;
    }
    if (wantLevel && normalize(ex.level) === wantLevel) {
      score += 0.25;
    }
    if (!best || score > best.score) best = { score, ex };
  }

  // Require a reasonable score so we don't return a totally unrelated exercise
  // when the AI invented a name with no real match.
  return best && best.score >= 0.4 ? best.ex : null;
}

export type SearchOpts = {
  muscle?: string;
  equipment?: string;
  level?: string;
  limit?: number;
};

/** Ranked substitutes when an exact match couldn't be found. */
export async function searchExercises(opts: SearchOpts): Promise<EnrichedExercise[]> {
  const idx = await getIndex();
  const wantMuscle = opts.muscle ? normalize(opts.muscle) : "";
  const wantEq = opts.equipment ? normalize(opts.equipment) : "";
  const wantLevel = opts.level ? normalize(opts.level) : "";

  const scored: { score: number; ex: EnrichedExercise }[] = [];
  for (const ex of idx.all) {
    let score = 0;
    if (wantMuscle && ex.primaryMuscles.some((m) => normalize(m) === wantMuscle)) score += 2;
    if (wantEq && ex.equipment && normalize(ex.equipment) === wantEq) score += 1;
    if (wantLevel && normalize(ex.level) === wantLevel) score += 0.5;
    if (score > 0) scored.push({ score, ex });
  }
  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, opts.limit ?? 5).map((s) => s.ex);
}
