## Fix: Week Review page — dark-glass consistency

The Week Review page (`src/routes/_authenticated/review.$weekId.tsx`) still uses legacy white backgrounds and lime accents. Bring it in line with the rest of the app (dark glass + neon orange).

### Changes in `src/routes/_authenticated/review.$weekId.tsx`

1. **"Easier / Same / Harder" pills**
   - Unselected: replace `bg-white text-[var(--text-mid)]` with `glass-card` styling — subtle dark surface, muted text, hairline border.
   - Selected: keep neon-orange highlight (border + tinted fill + orange text) consistent with other active chips in the app.

2. **Notes textarea**
   - Replace `bg-white border-[var(--clay-border)]` with the shared `glass-input` utility (dark surface, subtle border, white text, orange focus ring). Add `text-white placeholder:text-[var(--text-mid)] resize-none`.

3. **Range sliders**
   - Swap `accent-lime-400` for the neon-orange custom slider styling already defined globally (uses `--neon-orange`), so the thumb/track match the onboarding sliders.

4. **Submit button**
   - Remove the stray `hover:bg-lime-300`; use the orange hover from `glass-btn`-style treatment (darker orange on hover) to stay on-palette.

5. **Section labels**
   - Update `text-[var(--clay-orange)]` → `text-[var(--neon-orange)]` for the "Week review" eyebrow, matching tokens used elsewhere.

No logic changes — presentation only. No new files.
