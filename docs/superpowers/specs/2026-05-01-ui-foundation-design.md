# UI Foundation — Design Tokens, Primitives Library, Builder Pattern

**Date:** 2026-05-01
**Sub-project:** A (of N — UI refactor)
**Status:** Approved (brainstorming)
**Source design bundle:** `https://api.anthropic.com/v1/design/h/xdfSZ5oLo5Cg4NIsv_5apA` — extracted to `c:/tmp/design-bootcamp/bootcamp/`

## Context

The current `web/` app is a Next.js 14 + Tailwind codebase organized by domain feature (`components/dashboard/`, `components/lesson/renderers/`, `components/instructor/`, etc.). It has **no primitive layer**: every component reaches directly for `bg-gray-*`/`dark:bg-gray-*` Tailwind classes. There is no shared design language, no token system, no library/builder split.

A peacock-inspired dark-mode-first design system was authored in the Claude Design tool and exported as a handoff bundle. The bundle ships:

- `tokens.css` — color, typography, radius, spacing, shadow, motion, density, and gradient CSS custom properties; theme switching via `[data-theme="dark|light"]`; density switching via `[data-density="comfortable|compact"]`.
- `components.css` — class-based primitives (`.btn`, `.card`, `.input`, `.badge`, `.chip`, `.bar`, `.ring`, `.code-block`, `.kpi`, `.node`, `.avatar`, `.dnd-slot`, `.dnd-token`, `.medal`, `.eyebrow`, `.h-display`, `.h1`–`.h4`, layout helpers).
- `app.css` — page-layout styles for the eventual app shell, dashboard, skill tree, and lesson player.
- React/JSX prototypes (`app-shell.jsx`, `app-dashboard.jsx`, `app-tree.jsx`, `app-lesson.jsx`, `app-profile.jsx`, `tweaks-panel.jsx`) demonstrating composition.

This sub-project introduces the **foundation only** — tokens, primitives, builder pattern, and a showcase route. App-shell migration and per-page refactors get their own specs.

## Goal

Stand up a primitives library + design tokens that future page-refactor PRs can consume. Ship without breaking any current page.

## In scope

- Port `tokens.css` and `components.css` from the design bundle into `web/styles/`.
- Build a primitives library at `web/components/ui/` — typed React components that emit the design's class names (the "builder" layer over the CSS).
- Wire global `data-theme` and `data-density` attributes on `<html>`, alongside the existing `dark` class (back-compat).
- Add a `/design-system` route rendering every primitive in every variant — proof-of-life and living reference.
- A floating `TweaksPanel` (theme + density) on the `/design-system` route, gated by `NODE_ENV === 'development'` for any other use.

## Out of scope (later sub-projects)

- AppShell rewrite (Sidebar / Topbar) — must reconcile with `AuthProvider`, `SettingsMenu`, `RevisitIcon`, `CohortBadge`.
- Refactors of any existing page: Dashboard, Tracks, Lesson, Profile, Instructor, Auth.
- Removal of the `dark`-class theming — kept compatible until AppShell migration retires it.
- A11y audit and screenshot-diff visual regression — added piecemeal as pages refactor.

## Decisions

### CSS strategy

Port the design bundle's CSS as-is. React primitives are thin wrappers that accept variant props and emit the corresponding class names. Tailwind remains available for layout utilities (`grid`, `flex`, `gap-*`) but stylistic decisions live in the design-system CSS.

Rationale: the design was authored as a CSS-variable system. Translating to a Tailwind theme would lose `color-mix()` fidelity, the iridescent gradient, and the `[data-theme]`/`[data-density]` swap mechanism. Keeping the CSS layer intact is the cheapest path to pixel-parity, and the builder layer becomes a thin React API over named primitives — exactly the requested pattern.

### Decomposition strategy

Foundation-first; PR-by-PR rollout. Each subsequent sub-project (AppShell, Dashboard, SkillTree, LessonPlayer, Profile, Instructor, Auth) gets its own spec → plan → PR cycle, consuming primitives shipped here.

### Coexistence

Foundation does not modify any existing page. Existing pages continue rendering with their current Tailwind classes and the `.dark` class mechanism. The new system is opt-in: only the `/design-system` route uses it on day one.

## File structure

```
web/
├── app/
│   ├── globals.css                 # MODIFIED — imports tokens.css + components.css; keeps existing tailwind layers
│   ├── design-system/
│   │   └── page.tsx                # NEW — primitive showcase route
│   └── layout.tsx                  # MODIFIED — adds data-theme/data-density init script
├── styles/                         # NEW
│   ├── tokens.css                  # NEW — ported as-is from design bundle
│   ├── components.css              # NEW — ported as-is from design bundle
│   └── app.css                     # NEW — placeholder; consumed by AppShell PR
├── components/
│   └── ui/                         # NEW — primitives library
│       ├── Button.tsx              # variant: default | primary | iridescent | ghost | outline; size: sm | md | lg; iconOnly
│       ├── Card.tsx                # variant: default | elevated | glow
│       ├── Input.tsx               # variant: default | search; leading/trailing icon
│       ├── Badge.tsx               # tone: default | brand | iris | amber | success; mono; dot
│       ├── Chip.tsx                # toggleable; active state
│       ├── ProgressBar.tsx         # thin | default | thick; value 0..100
│       ├── ProgressRing.tsx        # size; thickness; value 0..100
│       ├── Avatar.tsx              # sm | md | lg; initials or src
│       ├── CodeBlock.tsx           # raw block; line numbers; token highlighting
│       ├── CodeFrame.tsx           # tabbed code container (header + body)
│       ├── Logo.tsx                # mark + wordmark; sm | md
│       ├── KPI.tsx                 # label + value + delta + accent
│       ├── SkillNode.tsx           # state: completed | current | available | locked; tint: swift | kotlin | shared
│       ├── DnDSlot.tsx             # filled | empty; tint
│       ├── DnDToken.tsx            # used | active states
│       ├── Heart.tsx               # filled | empty
│       ├── Hearts.tsx              # row of N; count + total
│       ├── Icon.tsx                # icon set ported from app-shell.jsx
│       ├── Eyebrow.tsx             # uppercase mono label
│       ├── Heading.tsx             # display | h1 | h2 | h3 | h4 (polymorphic via `as`)
│       ├── Stack.tsx               # tight | default | loose vertical layout
│       ├── Row.tsx                 # horizontal flex with gap; between variant
│       ├── Divider.tsx
│       ├── SegmentedControl.tsx    # generic; track switch is one consumer
│       ├── TweaksPanel.tsx         # floating panel shell
│       ├── TweakRadio.tsx          # radio group inside the tweaks panel
│       ├── TweakSection.tsx        # section header inside the tweaks panel
│       ├── cn.ts                   # className merge helper
│       └── index.ts                # barrel export
├── lib/
│   ├── theme.ts                    # MODIFIED — adds data-theme + data-density alongside the existing dark class
│   └── tweaks.ts                   # NEW — useTweaks hook (theme + density)
└── tailwind.config.ts              # MODIFIED — keeps darkMode: 'class' for back-compat; no token translation
```

Convention: anything in `components/ui/` is presentational and depends only on React + class names; anything outside `ui/` may consume `ui/` and may know about domain types.

## Primitive API — the builder pattern

Every primitive follows the same recipe:

```tsx
export type ButtonVariant = 'default' | 'primary' | 'iridescent' | 'ghost' | 'outline';
export type ButtonSize = 'sm' | 'md' | 'lg';

interface ButtonProps extends ComponentPropsWithoutRef<'button'> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  iconOnly?: boolean;
  leadingIcon?: ReactNode;
  trailingIcon?: ReactNode;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant = 'default', size = 'md', iconOnly, className, children, leadingIcon, trailingIcon, ...rest }, ref) => (
    <button
      ref={ref}
      className={cn(
        'btn',
        variant !== 'default' && `btn-${variant}`,
        size === 'sm' && 'btn-sm',
        size === 'lg' && 'btn-lg',
        iconOnly && 'btn-icon',
        className,
      )}
      {...rest}
    >
      {leadingIcon}
      {children}
      {trailingIcon}
    </button>
  ),
);
```

### Rules every primitive obeys

1. `forwardRef` for composition (`<Link><Button>` patterns, focus management).
2. `...rest` spread — every primitive accepts native HTML props of its underlying element.
3. `className` merge — user `className` always appended via `cn()` so callers can extend.
4. No internal state for visuals — primitives are pure presentation. Hover/focus is CSS-driven; active/selected is a controlled prop.
5. Polymorphic `as` prop only for `Heading`, `Eyebrow`, `Stack`, `Row`.
6. Track tinting is a prop, not a class hack: `<SkillNode tint="swift">` → emits `tint-swift node`. Same for `Badge` tones.
7. Icons are inert primitives — `<Icon name="play" size={18} />`. SVG paths ported from `app-shell.jsx`. No icon-library dependency.
8. No domain knowledge — `Hearts` takes `count: number`, not `student.hearts`. `KPI` takes label/value/delta strings.

### `cn()` helper

```ts
export const cn = (...parts: Array<string | false | null | undefined>) =>
  parts.filter(Boolean).join(' ');
```

No `clsx` / `tailwind-merge` dependency — design CSS has no utility-class conflicts to dedupe.

### Composition example

```tsx
<Row gap={14}>
  <Hearts count={5} />
  <Button variant="default" size="sm" iconOnly aria-label="Settings">
    <Icon name="settings" size={16} />
  </Button>
</Row>
```

## Theme + density mechanism

Two storage keys:

```
bootcamp.theme    → 'dark' | 'light' | 'system'
bootcamp.density  → 'comfortable' | 'compact'
```

### Init script (extends existing)

`THEME_INIT_SCRIPT` in `lib/theme.ts` — extended to also set `data-theme` and `data-density` before hydration. Continues toggling the `dark` class for back-compat.

```js
(function () {
  try {
    var theme = localStorage.getItem('bootcamp.theme') || 'system';
    var density = localStorage.getItem('bootcamp.density') || 'comfortable';
    var prefersDark = matchMedia('(prefers-color-scheme: dark)').matches;
    var dark = theme === 'dark' || (theme === 'system' && prefersDark);
    var root = document.documentElement;
    root.setAttribute('data-theme', dark ? 'dark' : 'light');
    root.setAttribute('data-density', density);
    root.classList.toggle('dark', dark);
  } catch (e) {}
})();
```

### `lib/theme.ts` evolution

Existing exports preserved (`THEME_STORAGE_KEY`, `applyTheme`, `readStoredMode`). New exports added:

- `DENSITY_STORAGE_KEY = 'bootcamp.density'`
- `applyDensity(d: Density)` — writes `data-density`, persists.
- `readStoredDensity(): Density`.
- `applyTheme` updated to also set `data-theme` (in addition to the current `dark` class toggle).

No existing call site breaks; existing `applyTheme` callers pick up the data-attribute side-effect for free.

### `lib/tweaks.ts` — the React hook

```ts
export function useTweaks(): {
  theme: ThemeMode;
  density: Density;
  setTheme: (m: ThemeMode) => void;
  setDensity: (d: Density) => void;
};
```

Reads localStorage on mount, writes through `applyTheme` / `applyDensity`, returns current values for the panel's radio state.

### TweaksPanel placement

- This PR: rendered only on `/design-system`.
- Dev-mode opt-in `<DevTweaksMount />` — any page may include it during development; not auto-mounted.
- Production app pages: untouched. User-facing toggle (likely in `Settings`) is the AppShell PR's call.

### Compatibility matrix

| Surface                              | Theme source            | Density source       |
| ------------------------------------ | ----------------------- | -------------------- |
| Existing pages (Tailwind `dark:`)    | `.dark` class           | n/a                  |
| New primitives (CSS vars)            | `[data-theme]`          | `[data-density]`     |
| `/design-system` showcase            | both                    | both                 |

Both systems share the same theme localStorage key — toggling theme anywhere repaints both globally on the next attribute apply.

## `/design-system` showcase route

`/design-system` is the proof-of-life: every primitive, every variant, every state, on one scrollable page. It's also the living reference future PRs check before reinventing a primitive.

### Page structure

```
app/design-system/page.tsx
└── <DesignSystemShowcase /> (client component)
```

Sticky left nav (anchor links) + content sections. Mirrors the design bundle's `Design System.html` layout, rebuilt with our primitives.

### Sections

1. **Foundations**
   - Color palette: peacock 50–900, royal, iris, amber, semantics — each as a tile with hex + token name.
   - Surfaces: `bg-0` … `bg-4` swatches.
   - Typography: display, h1–h4, body, mono — each row shows live render + token name + size.
   - Spacing scale: `s-1` … `s-20` as horizontal bars.
   - Radius scale: `r-xs` … `r-2xl` as labeled boxes.
   - Elevation: `sh-1`, `sh-2`, `sh-3`, glow shadows.
   - Motion: `d-fast`, `d-med`, `d-slow` demoed via a button that pulses on hover.
2. **Primitives**
   - Buttons: every variant × every size, plus `iconOnly` and `disabled`.
   - Inputs: default, search, focused, with leading icon.
   - Badges: every tone, with and without dot, mono variant.
   - Chips: default, hover, active.
   - Cards: default, elevated, glow.
   - ProgressBar: thin, default, thick at 0/40/100%.
   - ProgressRing: 0/40/100% at sm/md.
   - Avatar: sm/md/lg with initials and with image.
   - Logo: sm and md.
   - Icon: full set as a grid with names underneath.
   - Heading + Eyebrow combo.
3. **Composite primitives**
   - SkillNode: completed / current / available / locked, all three tints.
   - Hearts: full / partial / empty.
   - DnDSlot + DnDToken: empty / filled / used / wrong-fill.
   - CodeBlock + CodeFrame: with and without tabs, with token highlighting demo.
   - KPI: with delta, with iridescent value, with mini bar.
   - SegmentedControl: Swift/Kotlin track switch (interactive).
4. **Tweaks** (top-right floating)
   - TweaksPanel rendered with theme + density radios. Toggling either repaints the page live — primary visual proof both systems work.

### Acceptance for this sub-project

Foundation merges only if every section renders correctly. That is the acceptance criterion — no app pages need to change.

### TweaksPanel UX

- Floats bottom-right (matching the design bundle's `tweaks-panel.jsx`).
- Two radio groups: Theme (`dark` / `light`), Density (`comfortable` / `compact`).
- Click outside or press `Esc` to collapse to a button; click button to expand.

## Testing & verification

### Unit tests (Vitest + Testing Library)

One test file per primitive at `web/components/ui/__tests__/<Primitive>.test.tsx`. Each tests:

- Default render — emits the expected base class.
- Variants/tones — each prop value adds the right class.
- `className` merge — user `className` survives and appears alongside built-in classes.
- Ref forwarding — `ref` reaches the underlying DOM node.
- Native props passthrough — e.g. `Button` accepts `disabled`, `aria-label`, `onClick`.

Skipped for primitives that are pure markup with no props (`Divider`).

### Hook test

`web/lib/__tests__/tweaks.test.ts` — `useTweaks` reads/writes localStorage, calls `applyTheme` / `applyDensity`, syncs `data-*` attributes on `document.documentElement` (using jsdom from existing `vitest.setup.ts`).

### Visual smoke (Playwright)

`web/tests/e2e/design-system.spec.ts`:

- Navigate to `/design-system`.
- Assert page renders without console errors.
- Toggle theme radio → `<html data-theme>` flips dark↔light; a known `getComputedStyle(body).backgroundColor` changes.
- Toggle density radio → `<html data-density>` flips comfortable↔compact; a known `.card` padding changes.
- No screenshot diffing yet.

### Manual checklist (PR description)

- [ ] `npm run dev`, visit `/design-system` — every section renders, no console errors.
- [ ] Toggle dark↔light — page repaints, no flash, no broken contrast.
- [ ] Toggle comfortable↔compact — card padding/row height visibly changes.
- [ ] Visit `/dashboard`, `/login`, `/tracks`, an existing lesson — none changed visually (back-compat).
- [ ] `npm run build` succeeds.
- [ ] `npm run lint` passes.
- [ ] `npm test` passes.
- [ ] `npm run test:e2e -- design-system.spec.ts` passes.

### Explicit non-goals for testing

- Pixel parity vs. the design bundle — manual review responsibility.
- A11y audit per primitive — done piecemeal as primitives get used (axe assertions in page-level e2e).
- Cross-browser `color-mix()` testing — Chrome/Firefox/Safari support is sufficient; no fallback work.

## Risks

- **Tailwind ↔ CSS-vars coexistence drift.** Two styling systems live side by side until every page is refactored. Mitigation: lint rule (or PR review) — files in `components/ui/` may not use Tailwind utility classes for color/typography; files outside `ui/` may not use `.btn`/`.card`/`.badge` until they consume the corresponding primitive.
- **Theme flash.** The init script runs before hydration but after the first paint of static HTML. Existing `THEME_INIT_SCRIPT` already mitigates this for the `dark` class; same pattern for `data-theme` keeps parity.
- **Density-controlled layout shifts.** Compact density changes `--row-h`, `--pad-card`, `--gap-stack`. Not exercised in this PR (no real pages refactored yet) but tested on the showcase.
- **Showcase route discoverability.** Not linked from production nav — only reachable by URL. That is intentional for this PR; AppShell PR can add a link if desired.

## Follow-up sub-projects (not part of this spec)

1. **Sub-project B — App Shell migration.** Replace `components/layout/AppShell.tsx` with the new Sidebar + Topbar built from primitives. Reconcile with `AuthProvider`, `SettingsMenu`, `RevisitIcon`, `CohortBadge`, streak/points display.
2. **Sub-project C — Dashboard refactor.** Port the design bundle's Dashboard (daily strip, up-next, paths, mini-leaderboard) to consume primitives.
3. **Sub-project D — Skill Tree / Tracks refactor.** Replace `TimelineLessonNode` with `SkillNode`-based tree.
4. **Sub-project E — Lesson Player refactor.** Wrap each `components/lesson/renderers/*` exercise type in primitives (CodeBlock, DnDSlot/Token, multiple-choice option, hearts, progress).
5. **Sub-project F — Profile / Badges / Leaderboard refactor.**
6. **Sub-project G — Instructor pages refactor.**
7. **Sub-project H — Auth pages (login / register) refactor.**

After Sub-project H, retire the `dark` class fallback and the legacy `bg-gray-*`/`dark:bg-gray-*` Tailwind classes.
