/**
 * Tiny string helpers shared across the app.
 */

/** "1 day" / "2 days". Optional custom plural for irregular words. */
export function pluralize(n: number, singular: string, plural?: string): string {
  const word = n === 1 ? singular : plural ?? `${singular}s`;
  return `${n} ${word}`;
}

/**
 * Truncate at the last whitespace ≤ `max` chars, appending `…`.
 * Never cuts mid-word. Returns the input unchanged when short enough.
 */
export function truncateWords(input: string | null | undefined, max = 60): string {
  if (!input) return "";
  const s = input.trim();
  if (s.length <= max) return s;
  const slice = s.slice(0, max);
  const lastSpace = slice.lastIndexOf(" ");
  const cut = lastSpace > 20 ? slice.slice(0, lastSpace) : slice;
  return `${cut.trimEnd()}…`;
}
