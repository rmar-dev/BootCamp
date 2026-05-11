# UI Foundation

## Purpose

Provide the design tokens, primitives library, and theme/density mechanism that every page in `web/` consumes. Originated from the upstream Claude Design bundle and ported intact into the codebase. Sub-project A of the broader UI refactor.

## Owns

- `web/styles/tokens.css` — peacock palette, typography, spacing, radius, shadow, motion, density tokens. Theme via `[data-theme="dark|light"]`, density via `[data-density="comfortable|compact"]`.
- `web/styles/components.css` — class-based primitives (`.btn`, `.card`, `.badge`, `.input`, `.bar`, `.ring`, `.code-block`, `.node`, `.avatar`, `.dnd-slot`, `.dnd-token`, `.medal`, layout helpers).
- `web/styles/app.css` — placeholder; will hold layout-specific styles consumed by the AppShell sub-project (B).
- `web/components/ui/` — 26 typed React primitives plus a `cn()` helper and `index.ts` barrel.
- `web/lib/theme.ts` — `THEME_INIT_SCRIPT`, `applyTheme`, `applyDensity`, `readStoredMode`, `readStoredDensity`, types.
- `web/lib/tweaks.ts` — `useTweaks()` hook driving the floating tweaks panel.
- `web/app/design-system/` — the `/design-system` showcase route (Foundations + Primitives + Composites sections + floating TweaksPanel).
- `web/tests/ui/` — one Vitest suite per primitive (~120 tests).
- `web/tests/lib/theme.test.ts`, `web/tests/lib/tweaks.test.ts` — hook/module tests.
- `web/tests/e2e/design-system.spec.ts` — Playwright smoke for the showcase route.

## Key Interfaces

- **Primitives (barrel `@/components/ui`):** `Button`, `Card`, `Input`, `SearchInput`, `Badge`, `Chip`, `ProgressBar`, `ProgressRing`, `Avatar`, `Logo`, `Heading`, `Eyebrow`, `Divider`, `Stack`, `Row`, `KPI`, `CodeBlock`, `CodeFrame`, `SkillNode`, `DnDSlot`, `DnDToken`, `Heart`, `Hearts`, `SegmentedControl`, `TweaksPanel`, `TweakSection`, `TweakRadio`, `Icon` (22 SVG names), `cn`.
- **Builder pattern:** every primitive is a thin React wrapper that maps typed variant props → CSS class names from `components.css`. `forwardRef` where applicable, native props passthrough, `className` merge. No internal visual state.
- **Theme + density:** `useTweaks()` returns `{ theme, density, setTheme, setDensity }`. `setTheme` and `setDensity` write to localStorage (`bootcamp.theme`, `bootcamp.density`) and update `<html data-theme>` / `<html data-density>` attributes. The `THEME_INIT_SCRIPT` (inlined in `app/layout.tsx`) sets both attributes pre-hydration to prevent flash.

## Dependencies

- React 18, Next.js 14 (consumed by but not depended on — primitives are framework-agnostic React).
- Tailwind 3.4 — kept for layout utilities (`grid`, `flex`, `gap-*`); not used for color/typography in `components/ui/`.
- No icon library; SVG paths inlined in `Icon.tsx`.

## Conventions

- Anything in `components/ui/` is presentational and depends only on React + class names. No domain types.
- Anything outside `components/ui/` may consume `components/ui` and may know about domain types.
- `dark` Tailwind class still emitted alongside `[data-theme]` for back-compat with the existing pages until each one is refactored. After Sub-project H, the `dark` class fallback is retired.

## Living reference

`/design-system` route renders every primitive, every variant, every state. Foundation merges only if every section renders correctly. Future page-refactor PRs should regression-check this route first.
