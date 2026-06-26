
# Step 1 — Global Tokens & Locked Mobile Shell

Pure styling + layout architecture. No backend, no server functions, no per-page rewrites. Legacy `clay-*` class references on home/diet/calendar/profile/day pages keep rendering through `@utility` aliases while Steps 2–4 restyle each screen.

---

## 1. `src/styles.css` — full rewrite

### Tokens

Drop the warm clay palette and define the Dark Glassmorphism tokens.

**Raw vars in `:root`:**
- Base: `--bg-base #0A0C0F`, `--bg-layer #0F1318`, `--bg-mesh` (3-stop radial: indigo / emerald / wine over `#0A0C0F`)
- Glass: `--glass-1/2/3` (white 4 / 7 / 11 %), `--glass-border` 10 %, `--glass-border-bright` 18 %
- Neon: `--neon-orange #FF6B35`, `--neon-green #00E5A0`, `--neon-blue #4D9EFF`, `--neon-amber #FFB830`, `--neon-purple #A67BFF` (each with `-glow` rgba)
- Text: `--text-primary #F0EEF8`, `--text-secondary` 60 %, `--text-muted` 35 %

**`@theme inline` additions** (so Tailwind utilities exist):
- `--color-neon-orange/green/blue/amber/purple`, `--color-bg-base`, `--color-bg-layer` → enables `bg-neon-orange`, `text-neon-green`, `bg-bg-base`, etc.
- shadcn semantic remap: `--background → bg-base`, `--foreground → text-primary`, `--card → glass-2`, `--popover → #15191F`, `--primary → neon-orange`, `--secondary → glass-2`, `--muted → glass-1`, `--accent → glass-3`, `--destructive → #FF6B6B`, `--border → glass-border`, `--input → glass-border-bright`, `--ring → neon-orange`, chart 1-5 → neon palette, sidebar → `bg-layer + glass-2`.
- Legacy alias vars: `--color-clay-orange/green/blue/amber/red(+shadow/light)` and `--color-text-dark/mid/light` retained → existing `bg-clay-orange`, `text-clay-amber-shadow`, `text-text-mid` utilities keep resolving.

**Legacy raw-var aliases in `:root`** (so `bg-[color:var(--clay-orange)]` and `text-[color:var(--text-dark)]` references in unconverted pages keep working):
- `--page-bg → bg-base`, `--shell-bg → transparent`
- `--text-dark/mid/light → text-primary/secondary/muted`
- `--clay-border → glass-border`, `--clay-border-soft → white 6 %`
- `--clay-orange/green/blue/amber/red(+shadow/light)` → neon equivalents + low-opacity tints

**`.dark` block becomes a no-op** — dark is the default.

### Base layer

```css
html, body, #root { height: 100%; }
html { background: var(--bg-base); color-scheme: dark; }
body {
  background-image: var(--bg-mesh);
  background-attachment: fixed;
  color: var(--text-primary);
  font-family: 'Inter', ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
  -webkit-font-smoothing: antialiased;
  overscroll-behavior-y: none;
}
* { border-color: var(--color-border); }
```

### Glass primitives (all written as top-level `@utility`)

- **`glass-shell`** — flex column, `width:100%`, `max-width:375px`, `height:100%`, `margin-inline:auto`, `background-image: var(--bg-mesh)`, `overflow:hidden`. On `≥420px`: `height: min(100dvh - 32px, 860px)`, `border-radius:32px`, `border:1px solid var(--glass-border)`, layered drop + inset highlight shadow.
- **`glass-card`** — `var(--glass-2)`, `backdrop-filter: blur(20px) saturate(1.4)`, radius 20, 1px glass border. Adds a top-edge highlight via `&::before` (gradient line). Standard `backdrop-filter` only — no `-webkit-` prefix (Lightning CSS adds it).
- **Tint variants** `glass-card-orange / green / blue / amber / purple` — neon border + inset glow only (`box-shadow: inset 0 0 24px …`). Same names exposed as `clay-card-*` aliases via `@apply`.
- **Buttons:** `glass-btn` (orange gradient pill, `box-shadow: 0 4px 24px var(--neon-orange-glow)`, spring-eased active state), `glass-btn-green`, `glass-btn-ghost`, `glass-btn-sm`. Aliases: `clay-btn`, `clay-btn-green`, `clay-btn-red` (red gradient variant), `clay-btn-outline → ghost`, `clay-btn-ghost → ghost`, `clay-btn-sm`.
- **Chips/pills:** `glass-pill`, `focus-pill` (neon-blue tint), `muscle-pill`, `kcal-pill` (amber tint), `allergy-tag` (red glass).
- **`glass-stat`** — glass surface, radius 18, blur, centered.
- **`glass-day-btn`** + `-active` (orange tint + glow ring) + `-completed` (green tint). Aliases: `clay-day-btn(+-active/-completed)`.
- **`prog-bar`** — height 6, track `rgba(255,255,255,0.08)`.
- **`glass-nav-item`** + `-active` (orange tint pill). Aliases: `clay-nav-item(+-active)`.
- **`sec-label`** — 10 px uppercase, `var(--text-muted)`, 0.1 em tracking.
- **`scrollbar-none`** — `scrollbar-width: none` + `::-webkit-scrollbar { display:none }`. Plain class `.no-scrollbar` also kept for back-compat.
- Keyframes `pulse-glow`, `shimmer`.

> Note: nested `&::before` / `&:active` / `&::-webkit-scrollbar` lives inside the utility body (Tailwind v4 disallows pseudo-element suffixes in utility names). The `glass-shell` desktop refinement uses a normal `@media` block on `.glass-shell`, not nested apply-shorthands, since v4 utility bodies don't accept media-nested `max-w-*` shorthands.

### Legacy `clay-*` alias bridges
One-line `@utility name { @apply target }` for every old name still referenced across pages: `clay-shell`, `clay-card`, `clay-card-orange/green/blue/amber/soft-orange/soft-red/soft-green`, `clay-btn(+-green/-red/-outline/-ghost/-sm)`, `clay-pill`, `clay-stat`, `clay-day-btn(+-active/-completed)`, `clay-nav-item(+-active)`. Pages compile unchanged in Step 1.

---

## 2. `src/routes/__root.tsx`

- Append Inter to `head().links` (preconnect to `fonts.googleapis.com` + `fonts.gstatic.com` crossOrigin, then the stylesheet for `Inter:wght@400;500;600;700;800;900`). Never `@import` it in CSS — Tailwind v4 Lightning CSS resolves `@import` from disk.
- Set `<html lang="en" className="dark">` in `RootShell` so `dark:` variants resolve.
- Update `theme-color` meta `#E8E0D8` → `#0A0C0F`.

---

## 3. `src/routes/_authenticated/route.tsx` — locked mobile shell

Replace today's `clay-shell pb-24` scrolling layout with a frozen page-shell:

```tsx
<div
  className="fixed inset-0 overflow-hidden flex items-stretch sm:items-center justify-center"
  style={{ backgroundImage: 'var(--bg-mesh)' }}
>
  <div className="glass-shell">
    {/* FROZEN HEADER */}
    <header
      className="shrink-0 z-50 px-4 pb-3
                 pt-[calc(env(safe-area-inset-top)+14px)]
                 border-b border-[color:var(--glass-border)]
                 bg-[rgba(10,12,15,0.85)] backdrop-blur-xl"
    >
      {/* logo tile (36×36 orange gradient + neon-orange glow) · "GymBuddy"
          · sign-out (28×28 glass circle) · avatar (orange→purple gradient, initial) */}
    </header>

    {/* SCROLL-ONLY MAIN — the only overflow surface */}
    <main
      className="flex-1 w-full overflow-y-auto overflow-x-hidden
                 overscroll-contain scrollbar-none px-4 py-4"
    >
      <Outlet />
    </main>

    {/* FROZEN BOTTOM NAV */}
    <footer
      className="shrink-0 z-50 pt-2
                 pb-[calc(env(safe-area-inset-bottom)+10px)]
                 border-t border-white/10
                 bg-[rgba(10,12,15,0.90)] backdrop-blur-xl"
    >
      <nav className="flex items-stretch justify-around px-2">
        {/* 5 icon-only tabs: Home / Workout / Nutrition / Calendar / Profile
            (lucide: House, Dumbbell, Utensils, CalendarDays, User).
            Active = `bg-[rgba(255,107,53,0.12)]` rounded pill + neon-orange
            icon + 5×5 glowing dot beneath. */}
      </nav>
    </footer>
  </div>
</div>
```

How the architecture requirements are met:

- **No page bounce / no horizontal scroll** — outer `fixed inset-0 overflow-hidden`, body adds `overscroll-behavior-y: none`; main has `overflow-x-hidden`.
- **Frozen header & footer** — `shrink-0` siblings of the scroll container; physically cannot scroll.
- **Independent content scroll** — only `<main>` has `overflow-y-auto` + `overscroll-contain`.
- **Live viewport sizing** — fixed wrapper always matches the visible viewport (handles mobile address-bar collapse); `100dvh` caps the desktop "phone" preview at `min(100dvh - 32px, 860px)`.
- **Safe areas** — header `pt-[env(safe-area-inset-top)+14px]`, footer `pb-[env(safe-area-inset-bottom)+10px]`.
- **Desktop preview** — `glass-shell` centers at 375 px on ≥420 px screens with rounded 32 px, glass border, soft drop shadow.

Tab order now follows the new design prompt (Home / Workout / Nutrition / Calendar / Profile). The Workout tab keeps the existing `openTodayWorkout()` resolver pointing to today's day route, Nutrition → `/diet`, Calendar → `/calendar`. The signed-out action and profile avatar live in the header (kept from current shell).

---

## 4. Files touched

```text
EDIT  src/styles.css                         # dark-glass tokens + glass primitives + clay aliases
EDIT  src/routes/__root.tsx                  # Inter <link>, html.dark, theme-color #0A0C0F
EDIT  src/routes/_authenticated/route.tsx    # locked mobile shell (fixed wrapper · scroll-only main · safe-area · glass header & nav)
```

No new dependencies, no DB migrations, no server-function changes. After Step 1 the entire app renders on the dark-glass theme inside a frozen mobile shell; Steps 2–4 restyle Home, Workout/Day, Nutrition/Diet, Calendar, and Profile to their per-screen specs.
