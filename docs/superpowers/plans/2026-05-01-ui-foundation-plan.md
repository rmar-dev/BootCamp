# UI Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stand up a primitives library + design tokens at `web/components/ui/` that future page-refactor PRs consume; ship without changing any existing page.

**Architecture:** Port the design bundle's `tokens.css` and `components.css` into `web/styles/` and import them globally. Each React primitive in `web/components/ui/` is a thin typed wrapper that maps variant props → CSS class names. Theme/density switch via `[data-theme]` and `[data-density]` on `<html>`, alongside the existing `dark` class for back-compat. Proof-of-life is a `/design-system` route that renders every primitive variant; a `TweaksPanel` floats on it.

**Tech Stack:** Next.js 14 (App Router), React 18, TypeScript (strict), Tailwind 3.4 (kept for layout utilities only — no token translation), Vitest + Testing Library + jsdom for unit tests, Playwright for e2e. Path alias `@/*` → `./`. Tests live in `web/tests/`. Working directory for all commands: `c:\Users\ricma\BootCamp\web`.

**Source design bundle:** `c:\tmp\design-bootcamp\bootcamp\project\` — `tokens.css`, `components.css`, `app.css`, `app-shell.jsx` (Icon SVG paths), `app-dashboard.jsx`, `app-tree.jsx`, `app-lesson.jsx`, `tweaks-panel.jsx`.

**Spec:** `docs/superpowers/specs/2026-05-01-ui-foundation-design.md`.

---

## Pre-flight

- [ ] **Step 0.1:** Confirm working directory.

Run: `pwd`
Expected: a path ending in `BootCamp`.

- [ ] **Step 0.2:** Confirm `web/` deps are installed.

Run: `cd web && ls node_modules/vitest/package.json && ls node_modules/@playwright/test/package.json`
Expected: both files print without error. If missing: `cd web && npm install`.

- [ ] **Step 0.3:** Confirm baseline build is green before changes.

Run: `cd web && npm run lint && npm test && npm run build`
Expected: all three succeed. If any fail, stop and surface the failure — Foundation must merge on top of a green main.

---

## Phase 1 — CSS infrastructure

### Task 1: Port `tokens.css` into `web/styles/`

**Files:**
- Create: `web/styles/tokens.css`

- [ ] **Step 1.1: Create the directory.**

Run: `mkdir -p web/styles`

- [ ] **Step 1.2: Copy `tokens.css` verbatim from the design bundle.**

Source: `c:/tmp/design-bootcamp/bootcamp/project/tokens.css` → Dest: `web/styles/tokens.css`. Do not edit content.

- [ ] **Step 1.3: Verify content arrived intact.**

Run: `wc -l web/styles/tokens.css`
Expected: 250–252 lines (the source file is 251 lines).

- [ ] **Step 1.4: Verify a key token is present.**

Run: `grep -c "peacock-400" web/styles/tokens.css`
Expected: ≥ 5 occurrences.

- [ ] **Step 1.5: Commit.**

```bash
git add web/styles/tokens.css
git commit -m "ui: port design-system tokens.css"
```
(If repo not yet git-initialized, skip commit; record progress in the todo tracker instead.)

### Task 2: Port `components.css` into `web/styles/`

**Files:**
- Create: `web/styles/components.css`

- [ ] **Step 2.1: Copy `components.css` verbatim.**

Source: `c:/tmp/design-bootcamp/bootcamp/project/components.css` → Dest: `web/styles/components.css`. Do not edit.

- [ ] **Step 2.2: Verify class primitives are present.**

Run: `grep -E "^\\.btn|^\\.card|^\\.badge|^\\.input|^\\.bar|^\\.ring|^\\.code-block|^\\.node|^\\.avatar" web/styles/components.css | wc -l`
Expected: ≥ 9 lines (one per primitive selector).

- [ ] **Step 2.3: Commit.**

```bash
git add web/styles/components.css
git commit -m "ui: port design-system components.css"
```

### Task 3: Add stub `app.css` placeholder

**Files:**
- Create: `web/styles/app.css`

- [ ] **Step 3.1: Create stub.**

```css
/* app.css — page layout styles consumed by the AppShell PR.
   Intentionally empty in the Foundation PR. */
```

- [ ] **Step 3.2: Commit.**

```bash
git add web/styles/app.css
git commit -m "ui: add app.css placeholder"
```

### Task 4: Wire imports through `web/app/globals.css`

**Files:**
- Modify: `web/app/globals.css`

- [ ] **Step 4.1: Replace contents.**

```css
@import '../styles/tokens.css';
@import '../styles/components.css';
@import '../styles/app.css';

@tailwind base;
@tailwind components;
@tailwind utilities;

@layer base {
  html,
  body {
    height: 100%;
  }

  body {
    @apply bg-gray-50 text-gray-900 antialiased;
    font-family: ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont,
      'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
  }

  html.dark body {
    @apply bg-gray-950 text-gray-100;
  }
}
```

- [ ] **Step 4.2: Verify build still passes.**

Run: `cd web && npm run build`
Expected: build succeeds; no CSS import errors.

- [ ] **Step 4.3: Commit.**

```bash
git add web/app/globals.css
git commit -m "ui: import design-system stylesheets in globals.css"
```

---

## Phase 2 — Theme + density mechanism

### Task 5: Extend `lib/theme.ts` with density and `data-*` attributes

**Files:**
- Modify: `web/lib/theme.ts`
- Test: `web/tests/lib/theme.test.ts`

- [ ] **Step 5.1: Write failing tests.**

Create `web/tests/lib/theme.test.ts`:

```ts
import { describe, expect, it, beforeEach } from 'vitest';
import {
  THEME_STORAGE_KEY,
  DENSITY_STORAGE_KEY,
  applyTheme,
  applyDensity,
  readStoredMode,
  readStoredDensity,
} from '@/lib/theme';

describe('theme module', () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.removeAttribute('data-theme');
    document.documentElement.removeAttribute('data-density');
    document.documentElement.classList.remove('dark');
  });

  it('applyTheme("dark") sets data-theme="dark", adds .dark class, persists', () => {
    applyTheme('dark');
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
    expect(document.documentElement.classList.contains('dark')).toBe(true);
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe('dark');
  });

  it('applyTheme("light") sets data-theme="light" and removes .dark class', () => {
    document.documentElement.classList.add('dark');
    applyTheme('light');
    expect(document.documentElement.getAttribute('data-theme')).toBe('light');
    expect(document.documentElement.classList.contains('dark')).toBe(false);
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe('light');
  });

  it('applyDensity sets data-density attribute and persists', () => {
    applyDensity('compact');
    expect(document.documentElement.getAttribute('data-density')).toBe('compact');
    expect(localStorage.getItem(DENSITY_STORAGE_KEY)).toBe('compact');
  });

  it('readStoredDensity returns "comfortable" by default', () => {
    expect(readStoredDensity()).toBe('comfortable');
  });

  it('readStoredDensity reads persisted value', () => {
    localStorage.setItem(DENSITY_STORAGE_KEY, 'compact');
    expect(readStoredDensity()).toBe('compact');
  });

  it('readStoredMode returns "system" by default', () => {
    expect(readStoredMode()).toBe('system');
  });
});
```

- [ ] **Step 5.2: Run tests — confirm failure.**

Run: `cd web && npx vitest run tests/lib/theme.test.ts`
Expected: failures referencing `applyDensity`, `DENSITY_STORAGE_KEY`, `readStoredDensity` not exported, plus failures on `data-theme` attribute not set.

- [ ] **Step 5.3: Update `web/lib/theme.ts`.**

```ts
export type ThemeMode = 'system' | 'light' | 'dark';
export type Density = 'comfortable' | 'compact';

export const THEME_STORAGE_KEY = 'bootcamp.theme';
export const DENSITY_STORAGE_KEY = 'bootcamp.density';

/**
 * Inline script body (as a string) to set theme + density attributes on <html>
 * before React hydrates. Prevents a light-to-dark flash on page load.
 */
export const THEME_INIT_SCRIPT = `
(function () {
  try {
    var theme = localStorage.getItem('${THEME_STORAGE_KEY}') || 'system';
    var density = localStorage.getItem('${DENSITY_STORAGE_KEY}') || 'comfortable';
    var prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    var dark = theme === 'dark' || (theme === 'system' && prefersDark);
    var root = document.documentElement;
    root.setAttribute('data-theme', dark ? 'dark' : 'light');
    root.setAttribute('data-density', density);
    if (dark) root.classList.add('dark');
    else root.classList.remove('dark');
  } catch (e) {}
})();
`.trim();

export function applyTheme(mode: ThemeMode) {
  if (typeof window === 'undefined') return;
  const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  const dark = mode === 'dark' || (mode === 'system' && prefersDark);
  const root = document.documentElement;
  root.setAttribute('data-theme', dark ? 'dark' : 'light');
  root.classList.toggle('dark', dark);
  try {
    localStorage.setItem(THEME_STORAGE_KEY, mode);
  } catch {
    /* ignore */
  }
}

export function applyDensity(density: Density) {
  if (typeof window === 'undefined') return;
  document.documentElement.setAttribute('data-density', density);
  try {
    localStorage.setItem(DENSITY_STORAGE_KEY, density);
  } catch {
    /* ignore */
  }
}

export function readStoredMode(): ThemeMode {
  if (typeof window === 'undefined') return 'system';
  try {
    const v = localStorage.getItem(THEME_STORAGE_KEY) as ThemeMode | null;
    if (v === 'light' || v === 'dark' || v === 'system') return v;
  } catch {
    /* ignore */
  }
  return 'system';
}

export function readStoredDensity(): Density {
  if (typeof window === 'undefined') return 'comfortable';
  try {
    const v = localStorage.getItem(DENSITY_STORAGE_KEY) as Density | null;
    if (v === 'comfortable' || v === 'compact') return v;
  } catch {
    /* ignore */
  }
  return 'comfortable';
}
```

- [ ] **Step 5.4: Run tests — confirm pass.**

Run: `cd web && npx vitest run tests/lib/theme.test.ts`
Expected: all 6 tests pass.

- [ ] **Step 5.5: Commit.**

```bash
git add web/lib/theme.ts web/tests/lib/theme.test.ts
git commit -m "ui: add density support and data-theme attribute to theme module"
```

### Task 6: `useTweaks` hook in `lib/tweaks.ts`

**Files:**
- Create: `web/lib/tweaks.ts`
- Test: `web/tests/lib/tweaks.test.ts`

- [ ] **Step 6.1: Write failing tests.**

Create `web/tests/lib/tweaks.test.ts`:

```tsx
import { describe, expect, it, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useTweaks } from '@/lib/tweaks';
import { THEME_STORAGE_KEY, DENSITY_STORAGE_KEY } from '@/lib/theme';

describe('useTweaks', () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.removeAttribute('data-theme');
    document.documentElement.removeAttribute('data-density');
  });

  it('returns the persisted theme + density on mount', () => {
    localStorage.setItem(THEME_STORAGE_KEY, 'dark');
    localStorage.setItem(DENSITY_STORAGE_KEY, 'compact');
    const { result } = renderHook(() => useTweaks());
    expect(result.current.theme).toBe('dark');
    expect(result.current.density).toBe('compact');
  });

  it('setTheme updates state, document attribute, and storage', () => {
    const { result } = renderHook(() => useTweaks());
    act(() => result.current.setTheme('light'));
    expect(result.current.theme).toBe('light');
    expect(document.documentElement.getAttribute('data-theme')).toBe('light');
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe('light');
  });

  it('setDensity updates state, document attribute, and storage', () => {
    const { result } = renderHook(() => useTweaks());
    act(() => result.current.setDensity('compact'));
    expect(result.current.density).toBe('compact');
    expect(document.documentElement.getAttribute('data-density')).toBe('compact');
    expect(localStorage.getItem(DENSITY_STORAGE_KEY)).toBe('compact');
  });
});
```

- [ ] **Step 6.2: Run — confirm failure.**

Run: `cd web && npx vitest run tests/lib/tweaks.test.ts`
Expected: module not found error.

- [ ] **Step 6.3: Implement.**

Create `web/lib/tweaks.ts`:

```ts
'use client';
import { useCallback, useEffect, useState } from 'react';
import {
  applyDensity,
  applyTheme,
  readStoredDensity,
  readStoredMode,
  type Density,
  type ThemeMode,
} from './theme';

export function useTweaks() {
  const [theme, setThemeState] = useState<ThemeMode>('system');
  const [density, setDensityState] = useState<Density>('comfortable');

  useEffect(() => {
    setThemeState(readStoredMode());
    setDensityState(readStoredDensity());
  }, []);

  const setTheme = useCallback((mode: ThemeMode) => {
    applyTheme(mode);
    setThemeState(mode);
  }, []);

  const setDensity = useCallback((d: Density) => {
    applyDensity(d);
    setDensityState(d);
  }, []);

  return { theme, density, setTheme, setDensity };
}
```

- [ ] **Step 6.4: Run — confirm pass.**

Run: `cd web && npx vitest run tests/lib/tweaks.test.ts`
Expected: all 3 tests pass.

- [ ] **Step 6.5: Commit.**

```bash
git add web/lib/tweaks.ts web/tests/lib/tweaks.test.ts
git commit -m "ui: add useTweaks hook"
```

### Task 7: Update root layout init script

**Files:**
- Modify: `web/app/layout.tsx`

- [ ] **Step 7.1: Verify the change is mechanical.**

The existing `app/layout.tsx` already imports `THEME_INIT_SCRIPT` from `@/lib/theme`. After Task 5, that script now also sets `data-theme` and `data-density`. No code change is required in `layout.tsx` itself.

- [ ] **Step 7.2: Confirm by inspection.**

Run: `grep "THEME_INIT_SCRIPT" web/app/layout.tsx`
Expected: one match — already imported and inlined into `<head>`.

- [ ] **Step 7.3: Build smoke.**

Run: `cd web && npm run build`
Expected: build succeeds.

- [ ] **Step 7.4: Commit only if changes were made.**

(No-op step in most cases — skip the commit if nothing changed.)

---

## Phase 3 — Primitives library

### Task 8: `cn()` className helper

**Files:**
- Create: `web/components/ui/cn.ts`
- Test: `web/tests/ui/cn.test.ts`

- [ ] **Step 8.1: Write failing test.**

Create `web/tests/ui/cn.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { cn } from '@/components/ui/cn';

describe('cn', () => {
  it('joins truthy parts with spaces', () => {
    expect(cn('a', 'b', 'c')).toBe('a b c');
  });
  it('drops falsy values', () => {
    expect(cn('a', false, null, undefined, '', 'b')).toBe('a b');
  });
  it('returns empty string when all parts falsy', () => {
    expect(cn(false, null, undefined)).toBe('');
  });
});
```

- [ ] **Step 8.2: Run — confirm failure.**

Run: `cd web && npx vitest run tests/ui/cn.test.ts`
Expected: module not found.

- [ ] **Step 8.3: Implement.**

Create `web/components/ui/cn.ts`:

```ts
export const cn = (...parts: Array<string | false | null | undefined>) =>
  parts.filter(Boolean).join(' ');
```

- [ ] **Step 8.4: Run — confirm pass.**

Run: `cd web && npx vitest run tests/ui/cn.test.ts`
Expected: 3 pass.

- [ ] **Step 8.5: Commit.**

```bash
git add web/components/ui/cn.ts web/tests/ui/cn.test.ts
git commit -m "ui: add cn() className helper"
```

### Task 9: `Icon` primitive

**Files:**
- Create: `web/components/ui/Icon.tsx`
- Test: `web/tests/ui/Icon.test.tsx`

The icon set is ported from `c:/tmp/design-bootcamp/bootcamp/project/app-shell.jsx` (`paths` object inside the `Icon` component, lines 7–30). Names: home, tree, play, user, trophy, bookmark, settings, flame, bolt, check, chevR, chevL, star, lock, code, grid, book, target, search, plus, arrowR, refresh.

- [ ] **Step 9.1: Write failing test.**

Create `web/tests/ui/Icon.test.tsx`:

```tsx
import { describe, expect, it } from 'vitest';
import { render } from '@testing-library/react';
import { Icon } from '@/components/ui/Icon';

describe('Icon', () => {
  it('renders an SVG with the requested size', () => {
    const { container } = render(<Icon name="play" size={20} />);
    const svg = container.querySelector('svg');
    expect(svg).not.toBeNull();
    expect(svg?.getAttribute('width')).toBe('20');
    expect(svg?.getAttribute('height')).toBe('20');
  });

  it('renders nothing visible for unknown names but does not throw', () => {
    const { container } = render(<Icon name={"nope" as never} size={16} />);
    expect(container.querySelector('svg')).not.toBeNull();
  });

  it('forwards className', () => {
    const { container } = render(<Icon name="play" className="x" />);
    expect(container.querySelector('svg')?.getAttribute('class')).toContain('x');
  });
});
```

- [ ] **Step 9.2: Run — fail.**

Run: `cd web && npx vitest run tests/ui/Icon.test.tsx`
Expected: module not found.

- [ ] **Step 9.3: Implement.**

Create `web/components/ui/Icon.tsx`:

```tsx
import type { CSSProperties, ReactNode } from 'react';

export type IconName =
  | 'home' | 'tree' | 'play' | 'user' | 'trophy' | 'bookmark'
  | 'settings' | 'flame' | 'bolt' | 'check' | 'chevR' | 'chevL'
  | 'star' | 'lock' | 'code' | 'grid' | 'book' | 'target'
  | 'search' | 'plus' | 'arrowR' | 'refresh';

interface IconProps {
  name: IconName;
  size?: number;
  className?: string;
  style?: CSSProperties;
}

const stroke = {
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 2,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
};

const paths: Record<IconName, ReactNode> = {
  home: (<><path d="M3 11l9-8 9 8" {...stroke} /><path d="M5 10v10h14V10" {...stroke} /></>),
  tree: (<><circle cx="6" cy="6" r="2.5" {...stroke} /><circle cx="18" cy="6" r="2.5" {...stroke} /><circle cx="12" cy="18" r="2.5" {...stroke} /><path d="M6 8.5v3a3 3 0 003 3h6a3 3 0 003-3v-3" {...stroke} /><path d="M12 14.5V18" {...stroke} /></>),
  play: <polygon points="6 4 20 12 6 20 6 4" fill="currentColor" />,
  user: (<><circle cx="12" cy="8" r="4" {...stroke} /><path d="M4 21c1.5-4 4.5-6 8-6s6.5 2 8 6" {...stroke} /></>),
  trophy: (<><path d="M7 4h10v4a5 5 0 01-10 0V4z" {...stroke} /><path d="M7 6H4v2a3 3 0 003 3M17 6h3v2a3 3 0 01-3 3" {...stroke} /><path d="M9 14h6l-1 4h-4l-1-4zM7 20h10" {...stroke} /></>),
  bookmark: <path d="M6 3h12v18l-6-4-6 4V3z" {...stroke} />,
  settings: (<><circle cx="12" cy="12" r="3" {...stroke} /><path d="M12 2v3M12 19v3M4.2 4.2l2.1 2.1M17.7 17.7l2.1 2.1M2 12h3M19 12h3M4.2 19.8l2.1-2.1M17.7 6.3l2.1-2.1" {...stroke} /></>),
  flame: <path d="M12 3c1 4 5 4 5 9a5 5 0 11-10 0c0-2 1-3 2-4-1 4 3 4 3-5z" {...stroke} />,
  bolt: <polygon points="13 2 4 14 11 14 9 22 20 10 13 10 13 2" {...stroke} />,
  check: <polyline points="5 12 10 17 19 7" {...stroke} strokeWidth={2.5} />,
  chevR: <polyline points="9 6 15 12 9 18" {...stroke} />,
  chevL: <polyline points="15 6 9 12 15 18" {...stroke} />,
  star: <polygon points="12 3 14.5 9.5 21 10 16 14.5 17.5 21 12 17.5 6.5 21 8 14.5 3 10 9.5 9.5" {...stroke} fill="currentColor" />,
  lock: (<><rect x="4" y="11" width="16" height="10" rx="2" {...stroke} /><path d="M8 11V7a4 4 0 018 0v4" {...stroke} /></>),
  code: (<><polyline points="9 8 4 12 9 16" {...stroke} /><polyline points="15 8 20 12 15 16" {...stroke} /></>),
  grid: (<><rect x="4" y="4" width="7" height="7" rx="1" {...stroke} /><rect x="13" y="4" width="7" height="7" rx="1" {...stroke} /><rect x="4" y="13" width="7" height="7" rx="1" {...stroke} /><rect x="13" y="13" width="7" height="7" rx="1" {...stroke} /></>),
  book: (<><path d="M4 4h6a3 3 0 013 3v13a2 2 0 00-2-2H4V4z" {...stroke} /><path d="M20 4h-6a3 3 0 00-3 3v13a2 2 0 012-2h7V4z" {...stroke} /></>),
  target: (<><circle cx="12" cy="12" r="9" {...stroke} /><circle cx="12" cy="12" r="5" {...stroke} /><circle cx="12" cy="12" r="1.5" fill="currentColor" /></>),
  search: (<><circle cx="11" cy="11" r="7" {...stroke} /><path d="m21 21-4.3-4.3" {...stroke} /></>),
  plus: <path d="M12 5v14M5 12h14" {...stroke} />,
  arrowR: <path d="M5 12h14M13 6l6 6-6 6" {...stroke} />,
  refresh: (<><path d="M3 12a9 9 0 0115-6.7L21 8M21 12a9 9 0 01-15 6.7L3 16" {...stroke} /><polyline points="21 3 21 8 16 8" {...stroke} /><polyline points="3 21 3 16 8 16" {...stroke} /></>),
};

export function Icon({ name, size = 18, className, style }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" className={className} style={style}>
      {paths[name]}
    </svg>
  );
}
```

- [ ] **Step 9.4: Run — pass.**

Run: `cd web && npx vitest run tests/ui/Icon.test.tsx`
Expected: 3 pass.

- [ ] **Step 9.5: Commit.**

```bash
git add web/components/ui/Icon.tsx web/tests/ui/Icon.test.tsx
git commit -m "ui: add Icon primitive"
```

### Task 10: `Button` primitive

**Files:**
- Create: `web/components/ui/Button.tsx`
- Test: `web/tests/ui/Button.test.tsx`

- [ ] **Step 10.1: Write failing test.**

Create `web/tests/ui/Button.test.tsx`:

```tsx
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { createRef } from 'react';
import { Button } from '@/components/ui/Button';

describe('Button', () => {
  it('emits .btn class by default', () => {
    render(<Button>Hi</Button>);
    expect(screen.getByRole('button')).toHaveClass('btn');
  });

  it('adds btn-primary on variant="primary"', () => {
    render(<Button variant="primary">Go</Button>);
    expect(screen.getByRole('button')).toHaveClass('btn-primary');
  });

  it('adds btn-iridescent on variant="iridescent"', () => {
    render(<Button variant="iridescent">Glow</Button>);
    expect(screen.getByRole('button')).toHaveClass('btn-iridescent');
  });

  it('adds btn-sm on size="sm"', () => {
    render(<Button size="sm">x</Button>);
    expect(screen.getByRole('button')).toHaveClass('btn-sm');
  });

  it('adds btn-lg on size="lg"', () => {
    render(<Button size="lg">x</Button>);
    expect(screen.getByRole('button')).toHaveClass('btn-lg');
  });

  it('adds btn-icon when iconOnly', () => {
    render(<Button iconOnly aria-label="x">x</Button>);
    expect(screen.getByRole('button')).toHaveClass('btn-icon');
  });

  it('merges user className', () => {
    render(<Button className="extra">x</Button>);
    expect(screen.getByRole('button')).toHaveClass('btn', 'extra');
  });

  it('forwards ref to the underlying button', () => {
    const ref = createRef<HTMLButtonElement>();
    render(<Button ref={ref}>x</Button>);
    expect(ref.current).toBeInstanceOf(HTMLButtonElement);
  });

  it('passes native props (disabled, aria-label) through', () => {
    render(<Button disabled aria-label="lbl">x</Button>);
    const b = screen.getByRole('button');
    expect(b).toBeDisabled();
    expect(b).toHaveAttribute('aria-label', 'lbl');
  });
});
```

- [ ] **Step 10.2: Run — fail.**

Run: `cd web && npx vitest run tests/ui/Button.test.tsx`
Expected: module not found.

- [ ] **Step 10.3: Implement.**

Create `web/components/ui/Button.tsx`:

```tsx
import { forwardRef, type ComponentPropsWithoutRef, type ReactNode } from 'react';
import { cn } from './cn';

export type ButtonVariant = 'default' | 'primary' | 'iridescent' | 'ghost' | 'outline';
export type ButtonSize = 'sm' | 'md' | 'lg';

export interface ButtonProps extends ComponentPropsWithoutRef<'button'> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  iconOnly?: boolean;
  leadingIcon?: ReactNode;
  trailingIcon?: ReactNode;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = 'default', size = 'md', iconOnly, className, children, leadingIcon, trailingIcon, ...rest },
  ref,
) {
  return (
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
  );
});
```

- [ ] **Step 10.4: Run — pass.**

Run: `cd web && npx vitest run tests/ui/Button.test.tsx`
Expected: 9 pass.

- [ ] **Step 10.5: Commit.**

```bash
git add web/components/ui/Button.tsx web/tests/ui/Button.test.tsx
git commit -m "ui: add Button primitive"
```

### Task 11: `Card` primitive

**Files:**
- Create: `web/components/ui/Card.tsx`
- Test: `web/tests/ui/Card.test.tsx`

- [ ] **Step 11.1: Write failing test.**

Create `web/tests/ui/Card.test.tsx`:

```tsx
import { describe, expect, it } from 'vitest';
import { render } from '@testing-library/react';
import { createRef } from 'react';
import { Card } from '@/components/ui/Card';

describe('Card', () => {
  it('emits .card by default', () => {
    const { container } = render(<Card>Body</Card>);
    expect(container.firstChild).toHaveClass('card');
  });
  it('adds card-elevated on variant="elevated"', () => {
    const { container } = render(<Card variant="elevated">x</Card>);
    expect(container.firstChild).toHaveClass('card-elevated');
  });
  it('adds card-glow on variant="glow"', () => {
    const { container } = render(<Card variant="glow">x</Card>);
    expect(container.firstChild).toHaveClass('card-glow');
  });
  it('forwards ref', () => {
    const ref = createRef<HTMLDivElement>();
    render(<Card ref={ref}>x</Card>);
    expect(ref.current).toBeInstanceOf(HTMLDivElement);
  });
});
```

- [ ] **Step 11.2: Run — fail.**

- [ ] **Step 11.3: Implement.**

Create `web/components/ui/Card.tsx`:

```tsx
import { forwardRef, type ComponentPropsWithoutRef } from 'react';
import { cn } from './cn';

export type CardVariant = 'default' | 'elevated' | 'glow';

export interface CardProps extends ComponentPropsWithoutRef<'div'> {
  variant?: CardVariant;
}

export const Card = forwardRef<HTMLDivElement, CardProps>(function Card(
  { variant = 'default', className, ...rest },
  ref,
) {
  return (
    <div
      ref={ref}
      className={cn(
        'card',
        variant === 'elevated' && 'card-elevated',
        variant === 'glow' && 'card-glow',
        className,
      )}
      {...rest}
    />
  );
});
```

- [ ] **Step 11.4: Run — pass.**

Run: `cd web && npx vitest run tests/ui/Card.test.tsx`

- [ ] **Step 11.5: Commit.**

```bash
git add web/components/ui/Card.tsx web/tests/ui/Card.test.tsx
git commit -m "ui: add Card primitive"
```

### Task 12: `Input` + `SearchInput` primitives

**Files:**
- Create: `web/components/ui/Input.tsx`
- Test: `web/tests/ui/Input.test.tsx`

- [ ] **Step 12.1: Write failing test.**

Create `web/tests/ui/Input.test.tsx`:

```tsx
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Input, SearchInput } from '@/components/ui/Input';

describe('Input', () => {
  it('emits .input class', () => {
    render(<Input placeholder="x" />);
    expect(screen.getByPlaceholderText('x')).toHaveClass('input');
  });
  it('passes native props through', () => {
    render(<Input value="hi" readOnly placeholder="z" />);
    expect(screen.getByPlaceholderText('z')).toHaveValue('hi');
  });
});

describe('SearchInput', () => {
  it('wraps input with .search and adds .input-search', () => {
    const { container } = render(<SearchInput placeholder="Find" />);
    expect(container.firstChild).toHaveClass('search');
    expect(screen.getByPlaceholderText('Find')).toHaveClass('input-search');
  });
  it('renders a search icon inside the wrapper', () => {
    const { container } = render(<SearchInput placeholder="Find" />);
    expect(container.querySelector('svg')).not.toBeNull();
  });
});
```

- [ ] **Step 12.2: Run — fail.**

- [ ] **Step 12.3: Implement.**

Create `web/components/ui/Input.tsx`:

```tsx
import { forwardRef, type ComponentPropsWithoutRef } from 'react';
import { cn } from './cn';
import { Icon } from './Icon';

export interface InputProps extends ComponentPropsWithoutRef<'input'> {}

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { className, ...rest },
  ref,
) {
  return <input ref={ref} className={cn('input', className)} {...rest} />;
});

export interface SearchInputProps extends InputProps {
  wrapperClassName?: string;
}

export const SearchInput = forwardRef<HTMLInputElement, SearchInputProps>(function SearchInput(
  { className, wrapperClassName, ...rest },
  ref,
) {
  return (
    <div className={cn('search', wrapperClassName)} style={{ position: 'relative' }}>
      <Icon name="search" size={16} />
      <input ref={ref} className={cn('input', 'input-search', className)} {...rest} />
    </div>
  );
});
```

- [ ] **Step 12.4: Run — pass.** Run: `cd web && npx vitest run tests/ui/Input.test.tsx`

- [ ] **Step 12.5: Commit.**

```bash
git add web/components/ui/Input.tsx web/tests/ui/Input.test.tsx
git commit -m "ui: add Input + SearchInput primitives"
```

### Task 13: `Badge` primitive

**Files:**
- Create: `web/components/ui/Badge.tsx`
- Test: `web/tests/ui/Badge.test.tsx`

- [ ] **Step 13.1: Write failing test.**

Create `web/tests/ui/Badge.test.tsx`:

```tsx
import { describe, expect, it } from 'vitest';
import { render } from '@testing-library/react';
import { Badge } from '@/components/ui/Badge';

describe('Badge', () => {
  it('emits .badge by default', () => {
    const { container } = render(<Badge>Day 12</Badge>);
    expect(container.firstChild).toHaveClass('badge');
  });
  it.each([
    ['brand', 'badge-brand'],
    ['iris', 'badge-iris'],
    ['amber', 'badge-amber'],
    ['success', 'badge-success'],
  ] as const)('tone="%s" adds %s class', (tone, klass) => {
    const { container } = render(<Badge tone={tone}>x</Badge>);
    expect(container.firstChild).toHaveClass(klass);
  });
  it('mono adds .badge-mono', () => {
    const { container } = render(<Badge mono>x</Badge>);
    expect(container.firstChild).toHaveClass('badge-mono');
  });
  it('dot renders a .badge-dot span before children', () => {
    const { container } = render(<Badge dot>Done</Badge>);
    expect(container.querySelector('.badge-dot')).not.toBeNull();
  });
});
```

- [ ] **Step 13.2: Run — fail.**

- [ ] **Step 13.3: Implement.**

Create `web/components/ui/Badge.tsx`:

```tsx
import { forwardRef, type ComponentPropsWithoutRef } from 'react';
import { cn } from './cn';

export type BadgeTone = 'default' | 'brand' | 'iris' | 'amber' | 'success';

export interface BadgeProps extends ComponentPropsWithoutRef<'span'> {
  tone?: BadgeTone;
  mono?: boolean;
  dot?: boolean;
}

export const Badge = forwardRef<HTMLSpanElement, BadgeProps>(function Badge(
  { tone = 'default', mono, dot, className, children, ...rest },
  ref,
) {
  return (
    <span
      ref={ref}
      className={cn(
        'badge',
        tone !== 'default' && `badge-${tone}`,
        mono && 'badge-mono',
        className,
      )}
      {...rest}
    >
      {dot && <span className="badge-dot" />}
      {children}
    </span>
  );
});
```

- [ ] **Step 13.4: Run — pass.** Run: `cd web && npx vitest run tests/ui/Badge.test.tsx`

- [ ] **Step 13.5: Commit.**

```bash
git add web/components/ui/Badge.tsx web/tests/ui/Badge.test.tsx
git commit -m "ui: add Badge primitive"
```

### Task 14: `Chip` primitive

**Files:**
- Create: `web/components/ui/Chip.tsx`
- Test: `web/tests/ui/Chip.test.tsx`

- [ ] **Step 14.1: Test.**

```tsx
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Chip } from '@/components/ui/Chip';

describe('Chip', () => {
  it('emits .chip by default', () => {
    render(<Chip>x</Chip>);
    expect(screen.getByText('x')).toHaveClass('chip');
  });
  it('active adds .active', () => {
    render(<Chip active>x</Chip>);
    expect(screen.getByText('x')).toHaveClass('active');
  });
});
```

- [ ] **Step 14.2: Implement.**

```tsx
import { forwardRef, type ComponentPropsWithoutRef } from 'react';
import { cn } from './cn';

export interface ChipProps extends ComponentPropsWithoutRef<'button'> {
  active?: boolean;
}

export const Chip = forwardRef<HTMLButtonElement, ChipProps>(function Chip(
  { active, className, type = 'button', ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      className={cn('chip', active && 'active', className)}
      {...rest}
    />
  );
});
```

- [ ] **Step 14.3: Run — pass.** `cd web && npx vitest run tests/ui/Chip.test.tsx`

- [ ] **Step 14.4: Commit.**

```bash
git add web/components/ui/Chip.tsx web/tests/ui/Chip.test.tsx
git commit -m "ui: add Chip primitive"
```

### Task 15: `ProgressBar` + `ProgressRing`

**Files:**
- Create: `web/components/ui/ProgressBar.tsx`, `web/components/ui/ProgressRing.tsx`
- Test: `web/tests/ui/Progress.test.tsx`

- [ ] **Step 15.1: Test.**

```tsx
import { describe, expect, it } from 'vitest';
import { render } from '@testing-library/react';
import { ProgressBar } from '@/components/ui/ProgressBar';
import { ProgressRing } from '@/components/ui/ProgressRing';

describe('ProgressBar', () => {
  it('renders .bar with .bar-fill at the requested percentage', () => {
    const { container } = render(<ProgressBar value={42} />);
    expect(container.firstChild).toHaveClass('bar');
    const fill = container.querySelector('.bar-fill') as HTMLElement;
    expect(fill.style.width).toBe('42%');
  });
  it('thickness="thin" adds .bar-thin', () => {
    const { container } = render(<ProgressBar value={0} thickness="thin" />);
    expect(container.firstChild).toHaveClass('bar-thin');
  });
  it('clamps value to [0,100]', () => {
    const { container, rerender } = render(<ProgressBar value={-50} />);
    expect((container.querySelector('.bar-fill') as HTMLElement).style.width).toBe('0%');
    rerender(<ProgressBar value={250} />);
    expect((container.querySelector('.bar-fill') as HTMLElement).style.width).toBe('100%');
  });
});

describe('ProgressRing', () => {
  it('renders a .ring with --p custom property', () => {
    const { container } = render(<ProgressRing value={75} />);
    expect(container.firstChild).toHaveClass('ring');
    expect((container.firstChild as HTMLElement).style.getPropertyValue('--p')).toBe('75');
  });
});
```

- [ ] **Step 15.2: Implement `ProgressBar`.**

```tsx
import { forwardRef, type ComponentPropsWithoutRef } from 'react';
import { cn } from './cn';

export type BarThickness = 'thin' | 'default' | 'thick';

export interface ProgressBarProps extends ComponentPropsWithoutRef<'div'> {
  value: number;
  thickness?: BarThickness;
  fillStyle?: React.CSSProperties;
}

const clamp = (n: number) => Math.min(100, Math.max(0, n));

export const ProgressBar = forwardRef<HTMLDivElement, ProgressBarProps>(function ProgressBar(
  { value, thickness = 'default', fillStyle, className, ...rest },
  ref,
) {
  return (
    <div
      ref={ref}
      className={cn(
        'bar',
        thickness === 'thin' && 'bar-thin',
        thickness === 'thick' && 'bar-thick',
        className,
      )}
      {...rest}
    >
      <div className="bar-fill" style={{ width: `${clamp(value)}%`, ...fillStyle }} />
    </div>
  );
});
```

- [ ] **Step 15.3: Implement `ProgressRing`.**

```tsx
import { forwardRef, type ComponentPropsWithoutRef, type CSSProperties } from 'react';
import { cn } from './cn';

export interface ProgressRingProps extends ComponentPropsWithoutRef<'div'> {
  value: number;
  size?: number;
  thick?: number;
}

const clamp = (n: number) => Math.min(100, Math.max(0, n));

export const ProgressRing = forwardRef<HTMLDivElement, ProgressRingProps>(function ProgressRing(
  { value, size = 56, thick = 6, className, style, children, ...rest },
  ref,
) {
  const ringStyle: CSSProperties = {
    ...style,
    ['--p' as string]: clamp(value).toString(),
    ['--size' as string]: `${size}px`,
    ['--thick' as string]: `${thick}px`,
  };
  return (
    <div ref={ref} className={cn('ring', className)} style={ringStyle} {...rest}>
      {children}
    </div>
  );
});
```

- [ ] **Step 15.4: Run — pass.** `cd web && npx vitest run tests/ui/Progress.test.tsx`

- [ ] **Step 15.5: Commit.**

```bash
git add web/components/ui/ProgressBar.tsx web/components/ui/ProgressRing.tsx web/tests/ui/Progress.test.tsx
git commit -m "ui: add ProgressBar and ProgressRing primitives"
```

### Task 16: `Avatar` primitive

**Files:**
- Create: `web/components/ui/Avatar.tsx`
- Test: `web/tests/ui/Avatar.test.tsx`

- [ ] **Step 16.1: Test.**

```tsx
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Avatar } from '@/components/ui/Avatar';

describe('Avatar', () => {
  it('renders initials inside .avatar', () => {
    const { container } = render(<Avatar initials="JK" />);
    expect(container.firstChild).toHaveClass('avatar');
    expect(screen.getByText('JK')).toBeTruthy();
  });
  it('size="sm" adds .avatar-sm; size="lg" adds .avatar-lg', () => {
    const { container, rerender } = render(<Avatar initials="A" size="sm" />);
    expect(container.firstChild).toHaveClass('avatar-sm');
    rerender(<Avatar initials="A" size="lg" />);
    expect(container.firstChild).toHaveClass('avatar-lg');
  });
  it('renders <img> when src is provided', () => {
    const { container } = render(<Avatar src="/u.png" alt="me" />);
    expect(container.querySelector('img')).not.toBeNull();
  });
});
```

- [ ] **Step 16.2: Implement.**

```tsx
import { forwardRef, type ComponentPropsWithoutRef } from 'react';
import { cn } from './cn';

export type AvatarSize = 'sm' | 'md' | 'lg';

export interface AvatarProps extends ComponentPropsWithoutRef<'div'> {
  size?: AvatarSize;
  initials?: string;
  src?: string;
  alt?: string;
}

export const Avatar = forwardRef<HTMLDivElement, AvatarProps>(function Avatar(
  { size = 'md', initials, src, alt = '', className, children, ...rest },
  ref,
) {
  return (
    <div
      ref={ref}
      className={cn(
        'avatar',
        size === 'sm' && 'avatar-sm',
        size === 'lg' && 'avatar-lg',
        className,
      )}
      {...rest}
    >
      {src ? <img src={src} alt={alt} style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover' }} /> : initials || children}
    </div>
  );
});
```

- [ ] **Step 16.3: Pass.** `cd web && npx vitest run tests/ui/Avatar.test.tsx`

- [ ] **Step 16.4: Commit.**

```bash
git add web/components/ui/Avatar.tsx web/tests/ui/Avatar.test.tsx
git commit -m "ui: add Avatar primitive"
```

### Task 17: `Logo` primitive

**Files:**
- Create: `web/components/ui/Logo.tsx`
- Test: `web/tests/ui/Logo.test.tsx`

- [ ] **Step 17.1: Test.**

```tsx
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Logo } from '@/components/ui/Logo';

describe('Logo', () => {
  it('renders .logo with mark and wordmark', () => {
    const { container } = render(<Logo />);
    expect(container.firstChild).toHaveClass('logo');
    expect(container.querySelector('.logo-mark')).not.toBeNull();
    expect(screen.getByText('BootCamp')).toBeTruthy();
  });
  it('size="sm" adds .logo-sm', () => {
    const { container } = render(<Logo size="sm" />);
    expect(container.firstChild).toHaveClass('logo-sm');
  });
  it('respects custom label', () => {
    render(<Logo label="MyApp" />);
    expect(screen.getByText('MyApp')).toBeTruthy();
  });
});
```

- [ ] **Step 17.2: Implement.**

```tsx
import { forwardRef, type ComponentPropsWithoutRef } from 'react';
import { cn } from './cn';

export type LogoSize = 'sm' | 'md';

export interface LogoProps extends ComponentPropsWithoutRef<'span'> {
  size?: LogoSize;
  label?: string;
}

export const Logo = forwardRef<HTMLSpanElement, LogoProps>(function Logo(
  { size = 'md', label = 'BootCamp', className, ...rest },
  ref,
) {
  return (
    <span ref={ref} className={cn('logo', size === 'sm' && 'logo-sm', className)} {...rest}>
      <span className="logo-mark" />
      <span>{label}</span>
    </span>
  );
});
```

- [ ] **Step 17.3: Pass.** `cd web && npx vitest run tests/ui/Logo.test.tsx`

- [ ] **Step 17.4: Commit.**

```bash
git add web/components/ui/Logo.tsx web/tests/ui/Logo.test.tsx
git commit -m "ui: add Logo primitive"
```

### Task 18: `Heading` + `Eyebrow` + `Divider` primitives

**Files:**
- Create: `web/components/ui/Heading.tsx`, `Eyebrow.tsx`, `Divider.tsx`
- Test: `web/tests/ui/Typography.test.tsx`

- [ ] **Step 18.1: Test.**

```tsx
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Heading } from '@/components/ui/Heading';
import { Eyebrow } from '@/components/ui/Eyebrow';
import { Divider } from '@/components/ui/Divider';

describe('Heading', () => {
  it('level="display" emits h1 with .h-display', () => {
    render(<Heading level="display">Hi</Heading>);
    expect(screen.getByText('Hi').tagName).toBe('H1');
    expect(screen.getByText('Hi')).toHaveClass('h-display');
  });
  it.each([
    ['h1', 'H1', 'h1'],
    ['h2', 'H2', 'h2'],
    ['h3', 'H3', 'h3'],
    ['h4', 'H4', 'h4'],
  ] as const)('level="%s" emits %s with class .%s', (lvl, tag, klass) => {
    render(<Heading level={lvl as 'h1' | 'h2' | 'h3' | 'h4'}>X</Heading>);
    const node = screen.getByText('X');
    expect(node.tagName).toBe(tag);
    expect(node).toHaveClass(klass);
  });
});

describe('Eyebrow', () => {
  it('renders with .eyebrow class', () => {
    render(<Eyebrow>label</Eyebrow>);
    expect(screen.getByText('label')).toHaveClass('eyebrow');
  });
});

describe('Divider', () => {
  it('renders an hr with .divider', () => {
    const { container } = render(<Divider />);
    expect(container.querySelector('hr')).toHaveClass('divider');
  });
});
```

- [ ] **Step 18.2: Implement `Heading`.**

```tsx
import { type ComponentPropsWithoutRef, type ElementType } from 'react';
import { cn } from './cn';

export type HeadingLevel = 'display' | 'h1' | 'h2' | 'h3' | 'h4';

const TAG_BY_LEVEL: Record<HeadingLevel, ElementType> = {
  display: 'h1', h1: 'h1', h2: 'h2', h3: 'h3', h4: 'h4',
};
const CLASS_BY_LEVEL: Record<HeadingLevel, string> = {
  display: 'h-display', h1: 'h1', h2: 'h2', h3: 'h3', h4: 'h4',
};

export interface HeadingProps extends ComponentPropsWithoutRef<'h1'> {
  level?: HeadingLevel;
  as?: ElementType;
}

export function Heading({ level = 'h2', as, className, ...rest }: HeadingProps) {
  const Tag = (as || TAG_BY_LEVEL[level]) as ElementType;
  return <Tag className={cn(CLASS_BY_LEVEL[level], className)} {...rest} />;
}
```

- [ ] **Step 18.3: Implement `Eyebrow`.**

```tsx
import { type ComponentPropsWithoutRef, type ElementType } from 'react';
import { cn } from './cn';

export interface EyebrowProps extends ComponentPropsWithoutRef<'div'> {
  as?: ElementType;
}

export function Eyebrow({ as: Tag = 'div', className, ...rest }: EyebrowProps) {
  return <Tag className={cn('eyebrow', className)} {...rest} />;
}
```

- [ ] **Step 18.4: Implement `Divider`.**

```tsx
import { type ComponentPropsWithoutRef } from 'react';
import { cn } from './cn';

export function Divider({ className, ...rest }: ComponentPropsWithoutRef<'hr'>) {
  return <hr className={cn('divider', className)} {...rest} />;
}
```

- [ ] **Step 18.5: Pass.** `cd web && npx vitest run tests/ui/Typography.test.tsx`

- [ ] **Step 18.6: Commit.**

```bash
git add web/components/ui/Heading.tsx web/components/ui/Eyebrow.tsx web/components/ui/Divider.tsx web/tests/ui/Typography.test.tsx
git commit -m "ui: add Heading, Eyebrow, Divider primitives"
```

### Task 19: `Stack` + `Row` layout helpers

**Files:**
- Create: `web/components/ui/Stack.tsx`, `web/components/ui/Row.tsx`
- Test: `web/tests/ui/Layout.test.tsx`

- [ ] **Step 19.1: Test.**

```tsx
import { describe, expect, it } from 'vitest';
import { render } from '@testing-library/react';
import { Stack } from '@/components/ui/Stack';
import { Row } from '@/components/ui/Row';

describe('Stack', () => {
  it('emits .stack by default', () => {
    const { container } = render(<Stack>x</Stack>);
    expect(container.firstChild).toHaveClass('stack');
  });
  it('gap="tight" adds .stack-tight; gap="loose" adds .stack-loose', () => {
    const { container, rerender } = render(<Stack gap="tight">x</Stack>);
    expect(container.firstChild).toHaveClass('stack-tight');
    rerender(<Stack gap="loose">x</Stack>);
    expect(container.firstChild).toHaveClass('stack-loose');
  });
});

describe('Row', () => {
  it('emits .row by default', () => {
    const { container } = render(<Row>x</Row>);
    expect(container.firstChild).toHaveClass('row');
  });
  it('between=true emits .row-between (replacing .row)', () => {
    const { container } = render(<Row between>x</Row>);
    expect(container.firstChild).toHaveClass('row-between');
    expect(container.firstChild).not.toHaveClass('row');
  });
});
```

- [ ] **Step 19.2: Implement `Stack`.**

```tsx
import { type ComponentPropsWithoutRef, type ElementType } from 'react';
import { cn } from './cn';

export type StackGap = 'tight' | 'default' | 'loose';

export interface StackProps extends ComponentPropsWithoutRef<'div'> {
  as?: ElementType;
  gap?: StackGap;
}

export function Stack({ as: Tag = 'div', gap = 'default', className, ...rest }: StackProps) {
  return (
    <Tag
      className={cn(
        'stack',
        gap === 'tight' && 'stack-tight',
        gap === 'loose' && 'stack-loose',
        className,
      )}
      {...rest}
    />
  );
}
```

- [ ] **Step 19.3: Implement `Row`.**

```tsx
import { type ComponentPropsWithoutRef, type ElementType } from 'react';
import { cn } from './cn';

export interface RowProps extends ComponentPropsWithoutRef<'div'> {
  as?: ElementType;
  between?: boolean;
}

export function Row({ as: Tag = 'div', between, className, ...rest }: RowProps) {
  return <Tag className={cn(between ? 'row-between' : 'row', className)} {...rest} />;
}
```

- [ ] **Step 19.4: Pass.** `cd web && npx vitest run tests/ui/Layout.test.tsx`

- [ ] **Step 19.5: Commit.**

```bash
git add web/components/ui/Stack.tsx web/components/ui/Row.tsx web/tests/ui/Layout.test.tsx
git commit -m "ui: add Stack and Row layout helpers"
```

### Task 20: `KPI` primitive

**Files:**
- Create: `web/components/ui/KPI.tsx`
- Test: `web/tests/ui/KPI.test.tsx`

- [ ] **Step 20.1: Test.**

```tsx
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { KPI } from '@/components/ui/KPI';

describe('KPI', () => {
  it('renders label, value, and optional delta inside .kpi', () => {
    const { container } = render(<KPI label="Streak" value="12" delta="+1 today" />);
    expect(container.firstChild).toHaveClass('kpi');
    expect(screen.getByText('Streak')).toHaveClass('kpi-label');
    expect(screen.getByText('12')).toHaveClass('kpi-value');
    expect(screen.getByText('+1 today')).toHaveClass('kpi-delta');
  });
  it('peacock=true adds .peacock-text to value', () => {
    render(<KPI label="X" value="9" peacock />);
    expect(screen.getByText('9')).toHaveClass('peacock-text');
  });
});
```

- [ ] **Step 20.2: Implement.**

```tsx
import { type ComponentPropsWithoutRef, type ReactNode } from 'react';
import { cn } from './cn';

export interface KPIProps extends ComponentPropsWithoutRef<'div'> {
  label: ReactNode;
  value: ReactNode;
  delta?: ReactNode;
  peacock?: boolean;
  mono?: boolean;
}

export function KPI({ label, value, delta, peacock, mono = true, className, ...rest }: KPIProps) {
  return (
    <div className={cn('kpi', className)} {...rest}>
      <div className="kpi-label">{label}</div>
      <div className={cn('kpi-value', mono && 'mono', peacock && 'peacock-text')}>{value}</div>
      {delta !== undefined && <div className="kpi-delta">{delta}</div>}
    </div>
  );
}
```

- [ ] **Step 20.3: Pass.** `cd web && npx vitest run tests/ui/KPI.test.tsx`

- [ ] **Step 20.4: Commit.**

```bash
git add web/components/ui/KPI.tsx web/tests/ui/KPI.test.tsx
git commit -m "ui: add KPI primitive"
```

### Task 21: `CodeBlock` + `CodeFrame`

**Files:**
- Create: `web/components/ui/CodeBlock.tsx`, `web/components/ui/CodeFrame.tsx`
- Test: `web/tests/ui/Code.test.tsx`

- [ ] **Step 21.1: Test.**

```tsx
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { CodeBlock } from '@/components/ui/CodeBlock';
import { CodeFrame } from '@/components/ui/CodeFrame';

describe('CodeBlock', () => {
  it('renders a <pre> with .code-block', () => {
    const { container } = render(<CodeBlock>let x = 1</CodeBlock>);
    expect(container.querySelector('pre')).toHaveClass('code-block');
  });
});

describe('CodeFrame', () => {
  it('renders header tabs + body', () => {
    const { container } = render(
      <CodeFrame tabs={[{ label: 'main.swift', active: true }]}>
        <span>code</span>
      </CodeFrame>,
    );
    expect(container.firstChild).toHaveClass('code-frame');
    expect(screen.getByText('main.swift')).toHaveClass('code-tab', 'active');
  });
});
```

- [ ] **Step 21.2: Implement `CodeBlock`.**

```tsx
import { forwardRef, type ComponentPropsWithoutRef } from 'react';
import { cn } from './cn';

export const CodeBlock = forwardRef<HTMLPreElement, ComponentPropsWithoutRef<'pre'>>(
  function CodeBlock({ className, ...rest }, ref) {
    return <pre ref={ref} className={cn('code-block', className)} {...rest} />;
  },
);
```

- [ ] **Step 21.3: Implement `CodeFrame`.**

```tsx
import { type ReactNode } from 'react';
import { cn } from './cn';

export interface CodeFrameTab {
  label: string;
  active?: boolean;
  onClick?: () => void;
}

export interface CodeFrameProps {
  tabs?: CodeFrameTab[];
  rightSlot?: ReactNode;
  children: ReactNode;
  className?: string;
}

export function CodeFrame({ tabs, rightSlot, children, className }: CodeFrameProps) {
  return (
    <div className={cn('code-frame', className)}>
      {(tabs?.length || rightSlot) && (
        <div className="code-frame-head">
          <div className="code-frame-tabs">
            {tabs?.map((t, i) => (
              <button
                key={i}
                type="button"
                onClick={t.onClick}
                className={cn('code-tab', t.active && 'active')}
              >
                {t.label}
              </button>
            ))}
          </div>
          {rightSlot}
        </div>
      )}
      <div className="code-frame-body">{children}</div>
    </div>
  );
}
```

- [ ] **Step 21.4: Pass.** `cd web && npx vitest run tests/ui/Code.test.tsx`

- [ ] **Step 21.5: Commit.**

```bash
git add web/components/ui/CodeBlock.tsx web/components/ui/CodeFrame.tsx web/tests/ui/Code.test.tsx
git commit -m "ui: add CodeBlock and CodeFrame primitives"
```

### Task 22: `SkillNode` primitive

**Files:**
- Create: `web/components/ui/SkillNode.tsx`
- Test: `web/tests/ui/SkillNode.test.tsx`

- [ ] **Step 22.1: Test.**

```tsx
import { describe, expect, it } from 'vitest';
import { render } from '@testing-library/react';
import { SkillNode } from '@/components/ui/SkillNode';

describe('SkillNode', () => {
  it.each([
    ['completed', 'completed'],
    ['current', 'current'],
    ['available', 'available'],
    ['locked', 'locked'],
  ] as const)('state="%s" adds .%s class', (state, klass) => {
    const { container } = render(<SkillNode state={state} />);
    expect(container.firstChild).toHaveClass('node', klass);
  });
  it.each([
    ['swift', 'tint-swift'],
    ['kotlin', 'tint-kotlin'],
    ['shared', 'tint-shared'],
  ] as const)('tint="%s" adds .%s class', (tint, klass) => {
    const { container } = render(<SkillNode tint={tint} state="available" />);
    expect(container.firstChild).toHaveClass(klass);
  });
});
```

- [ ] **Step 22.2: Implement.**

```tsx
import { forwardRef, type ComponentPropsWithoutRef } from 'react';
import { cn } from './cn';

export type SkillNodeState = 'completed' | 'current' | 'available' | 'locked';
export type SkillNodeTint = 'swift' | 'kotlin' | 'shared';

export interface SkillNodeProps extends ComponentPropsWithoutRef<'button'> {
  state: SkillNodeState;
  tint?: SkillNodeTint;
}

export const SkillNode = forwardRef<HTMLButtonElement, SkillNodeProps>(function SkillNode(
  { state, tint = 'shared', className, type = 'button', disabled, ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      disabled={disabled || state === 'locked'}
      className={cn('node', state, `tint-${tint}`, className)}
      {...rest}
    />
  );
});
```

- [ ] **Step 22.3: Pass.** `cd web && npx vitest run tests/ui/SkillNode.test.tsx`

- [ ] **Step 22.4: Commit.**

```bash
git add web/components/ui/SkillNode.tsx web/tests/ui/SkillNode.test.tsx
git commit -m "ui: add SkillNode primitive"
```

### Task 23: `DnDSlot` + `DnDToken`

**Files:**
- Create: `web/components/ui/DnDSlot.tsx`, `web/components/ui/DnDToken.tsx`
- Test: `web/tests/ui/DnD.test.tsx`

- [ ] **Step 23.1: Test.**

```tsx
import { describe, expect, it } from 'vitest';
import { render } from '@testing-library/react';
import { DnDSlot } from '@/components/ui/DnDSlot';
import { DnDToken } from '@/components/ui/DnDToken';

describe('DnDSlot', () => {
  it('emits .dnd-slot, adds .filled when filled prop set', () => {
    const { container } = render(<DnDSlot filled>x</DnDSlot>);
    expect(container.firstChild).toHaveClass('dnd-slot', 'filled');
  });
  it('tint adds .swift / .kotlin', () => {
    const { container, rerender } = render(<DnDSlot tint="swift">x</DnDSlot>);
    expect(container.firstChild).toHaveClass('swift');
    rerender(<DnDSlot tint="kotlin">x</DnDSlot>);
    expect(container.firstChild).toHaveClass('kotlin');
  });
});

describe('DnDToken', () => {
  it('emits .dnd-token, adds .used when used prop set', () => {
    const { container } = render(<DnDToken used>x</DnDToken>);
    expect(container.firstChild).toHaveClass('dnd-token', 'used');
  });
});
```

- [ ] **Step 23.2: Implement `DnDSlot`.**

```tsx
import { forwardRef, type ComponentPropsWithoutRef } from 'react';
import { cn } from './cn';

export type DnDTint = 'swift' | 'kotlin' | undefined;

export interface DnDSlotProps extends ComponentPropsWithoutRef<'span'> {
  filled?: boolean;
  tint?: DnDTint;
}

export const DnDSlot = forwardRef<HTMLSpanElement, DnDSlotProps>(function DnDSlot(
  { filled, tint, className, ...rest },
  ref,
) {
  return (
    <span
      ref={ref}
      className={cn('dnd-slot', filled && 'filled', tint, className)}
      {...rest}
    />
  );
});
```

- [ ] **Step 23.3: Implement `DnDToken`.**

```tsx
import { forwardRef, type ComponentPropsWithoutRef } from 'react';
import { cn } from './cn';

export interface DnDTokenProps extends ComponentPropsWithoutRef<'button'> {
  used?: boolean;
}

export const DnDToken = forwardRef<HTMLButtonElement, DnDTokenProps>(function DnDToken(
  { used, className, type = 'button', ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      className={cn('dnd-token', used && 'used', className)}
      {...rest}
    />
  );
});
```

- [ ] **Step 23.4: Pass.** `cd web && npx vitest run tests/ui/DnD.test.tsx`

- [ ] **Step 23.5: Commit.**

```bash
git add web/components/ui/DnDSlot.tsx web/components/ui/DnDToken.tsx web/tests/ui/DnD.test.tsx
git commit -m "ui: add DnDSlot and DnDToken primitives"
```

### Task 24: `Heart` + `Hearts`

**Files:**
- Create: `web/components/ui/Heart.tsx`, `web/components/ui/Hearts.tsx`
- Test: `web/tests/ui/Hearts.test.tsx`

- [ ] **Step 24.1: Test.**

```tsx
import { describe, expect, it } from 'vitest';
import { render } from '@testing-library/react';
import { Hearts } from '@/components/ui/Hearts';

describe('Hearts', () => {
  it('renders total svg hearts; empty ones get .empty', () => {
    const { container } = render(<Hearts count={3} total={5} />);
    const hearts = container.querySelectorAll('svg.heart');
    expect(hearts.length).toBe(5);
    const empty = container.querySelectorAll('svg.heart.empty');
    expect(empty.length).toBe(2);
  });
  it('aria-label defaults to "Hearts"', () => {
    const { container } = render(<Hearts count={5} />);
    expect(container.firstChild).toHaveAttribute('aria-label', 'Hearts');
  });
});
```

- [ ] **Step 24.2: Implement `Heart`.**

```tsx
import { cn } from './cn';

export interface HeartProps {
  empty?: boolean;
  size?: number;
  className?: string;
}

export function Heart({ empty, size = 16, className }: HeartProps) {
  return (
    <svg className={cn('heart', empty && 'empty', className)} viewBox="0 0 24 24" width={size} height={size}>
      <path
        d="M12 21s-7-4.5-9.5-9C1 9 2.5 5 6 5c2 0 3.5 1 4.5 2.5C11.5 6 13 5 15 5c3.5 0 5 4 3.5 7-2.5 4.5-9.5 9-9.5 9z"
        fill="currentColor"
      />
    </svg>
  );
}
```

- [ ] **Step 24.3: Implement `Hearts`.**

```tsx
import { type ComponentPropsWithoutRef } from 'react';
import { cn } from './cn';
import { Heart } from './Heart';

export interface HeartsProps extends ComponentPropsWithoutRef<'div'> {
  count: number;
  total?: number;
  size?: number;
}

export function Hearts({ count, total = 5, size = 16, className, 'aria-label': aria = 'Hearts', ...rest }: HeartsProps) {
  return (
    <div className={cn('hearts', className)} aria-label={aria} {...rest}>
      {Array.from({ length: total }).map((_, i) => (
        <Heart key={i} size={size} empty={i >= count} />
      ))}
    </div>
  );
}
```

- [ ] **Step 24.4: Pass.** `cd web && npx vitest run tests/ui/Hearts.test.tsx`

- [ ] **Step 24.5: Commit.**

```bash
git add web/components/ui/Heart.tsx web/components/ui/Hearts.tsx web/tests/ui/Hearts.test.tsx
git commit -m "ui: add Heart and Hearts primitives"
```

### Task 25: `SegmentedControl`

**Files:**
- Create: `web/components/ui/SegmentedControl.tsx`
- Test: `web/tests/ui/SegmentedControl.test.tsx`

- [ ] **Step 25.1: Test.**

```tsx
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SegmentedControl } from '@/components/ui/SegmentedControl';

describe('SegmentedControl', () => {
  it('renders options and marks the active one', () => {
    render(
      <SegmentedControl
        value="swift"
        onChange={() => {}}
        options={[
          { value: 'swift', label: 'Swift', activeClassName: 'swift' },
          { value: 'kotlin', label: 'Kotlin' },
        ]}
      />,
    );
    expect(screen.getByText('Swift')).toHaveClass('seg-btn', 'active', 'swift');
    expect(screen.getByText('Kotlin')).toHaveClass('seg-btn');
    expect(screen.getByText('Kotlin')).not.toHaveClass('active');
  });

  it('invokes onChange when a non-active option is clicked', async () => {
    const onChange = vi.fn();
    render(
      <SegmentedControl
        value="swift"
        onChange={onChange}
        options={[
          { value: 'swift', label: 'Swift' },
          { value: 'kotlin', label: 'Kotlin' },
        ]}
      />,
    );
    await userEvent.click(screen.getByText('Kotlin'));
    expect(onChange).toHaveBeenCalledWith('kotlin');
  });
});
```

- [ ] **Step 25.2: Implement.**

```tsx
import { type ComponentPropsWithoutRef } from 'react';
import { cn } from './cn';

export interface SegmentOption<T extends string> {
  value: T;
  label: string;
  activeClassName?: string;
}

export interface SegmentedControlProps<T extends string>
  extends Omit<ComponentPropsWithoutRef<'div'>, 'onChange'> {
  value: T;
  onChange: (value: T) => void;
  options: SegmentOption<T>[];
}

export function SegmentedControl<T extends string>({
  value, onChange, options, className, ...rest
}: SegmentedControlProps<T>) {
  return (
    <div className={cn('seg', className)} {...rest}>
      {options.map((opt) => {
        const active = opt.value === value;
        return (
          <button
            key={opt.value}
            type="button"
            onClick={() => onChange(opt.value)}
            className={cn('seg-btn', active && 'active', active && opt.activeClassName)}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}
```

- [ ] **Step 25.3: Pass.** `cd web && npx vitest run tests/ui/SegmentedControl.test.tsx`

- [ ] **Step 25.4: Commit.**

```bash
git add web/components/ui/SegmentedControl.tsx web/tests/ui/SegmentedControl.test.tsx
git commit -m "ui: add SegmentedControl primitive"
```

### Task 26: `TweaksPanel` + `TweakSection` + `TweakRadio`

**Files:**
- Create: `web/components/ui/TweaksPanel.tsx`
- Test: `web/tests/ui/TweaksPanel.test.tsx`

The design's `tweaks-panel.jsx` provides the floating-panel CSS via classes already present (`.tweaks-panel`, `.tweaks-section`, `.tweaks-radio`). For this Foundation we ship a self-contained component that renders the panel inline (no portal), styled via the design CSS, with our own collapse/expand state.

- [ ] **Step 26.1: Test.**

```tsx
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { TweaksPanel, TweakSection, TweakRadio } from '@/components/ui/TweaksPanel';

describe('TweaksPanel', () => {
  it('renders title bar and child sections', () => {
    render(
      <TweaksPanel title="Tweaks" defaultOpen>
        <TweakSection label="Appearance" />
        <TweakRadio label="Theme" value="dark" options={['dark', 'light']} onChange={() => {}} />
      </TweaksPanel>,
    );
    expect(screen.getByText('Tweaks')).toBeTruthy();
    expect(screen.getByText('Appearance')).toBeTruthy();
    expect(screen.getByText('Theme')).toBeTruthy();
  });

  it('TweakRadio invokes onChange when a non-active option is clicked', async () => {
    const onChange = vi.fn();
    render(<TweakRadio label="Theme" value="dark" options={['dark', 'light']} onChange={onChange} />);
    await userEvent.click(screen.getByText('light'));
    expect(onChange).toHaveBeenCalledWith('light');
  });
});
```

- [ ] **Step 26.2: Implement.**

```tsx
'use client';
import { useState, type ReactNode } from 'react';
import { cn } from './cn';

export interface TweaksPanelProps {
  title?: string;
  defaultOpen?: boolean;
  children: ReactNode;
  className?: string;
}

export function TweaksPanel({ title = 'Tweaks', defaultOpen = false, children, className }: TweaksPanelProps) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div
      className={cn(className)}
      style={{
        position: 'fixed', bottom: 16, right: 16, zIndex: 50,
        background: 'var(--bg-2)', border: '1px solid var(--line-2)',
        borderRadius: 'var(--r-md)', boxShadow: 'var(--sh-2)',
        minWidth: open ? 240 : 'auto', padding: open ? 12 : 0,
      }}
    >
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="btn btn-sm"
        style={{ width: '100%', justifyContent: 'space-between' }}
      >
        <span>{title}</span>
        <span aria-hidden>{open ? '–' : '+'}</span>
      </button>
      {open && <div style={{ marginTop: 12 }}>{children}</div>}
    </div>
  );
}

export interface TweakSectionProps { label: string; }
export function TweakSection({ label }: TweakSectionProps) {
  return (
    <div className="eyebrow" style={{ margin: '12px 0 6px' }}>{label}</div>
  );
}

export interface TweakRadioProps<T extends string> {
  label: string;
  value: T;
  options: T[];
  onChange: (v: T) => void;
}
export function TweakRadio<T extends string>({ label, value, options, onChange }: TweakRadioProps<T>) {
  return (
    <div style={{ marginBottom: 8 }}>
      <div style={{ fontSize: 'var(--t-xs)', color: 'var(--text-3)', marginBottom: 6 }}>{label}</div>
      <div className="row" style={{ gap: 6 }}>
        {options.map((o) => (
          <button
            key={o}
            type="button"
            onClick={() => onChange(o)}
            className={cn('chip', o === value && 'active')}
          >
            {o}
          </button>
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 26.3: Pass.** `cd web && npx vitest run tests/ui/TweaksPanel.test.tsx`

- [ ] **Step 26.4: Commit.**

```bash
git add web/components/ui/TweaksPanel.tsx web/tests/ui/TweaksPanel.test.tsx
git commit -m "ui: add TweaksPanel + TweakSection + TweakRadio"
```

### Task 27: Barrel export

**Files:**
- Create: `web/components/ui/index.ts`

- [ ] **Step 27.1: Implement.**

```ts
export { cn } from './cn';
export { Icon, type IconName } from './Icon';
export { Button, type ButtonProps, type ButtonVariant, type ButtonSize } from './Button';
export { Card, type CardProps, type CardVariant } from './Card';
export { Input, SearchInput, type InputProps, type SearchInputProps } from './Input';
export { Badge, type BadgeProps, type BadgeTone } from './Badge';
export { Chip, type ChipProps } from './Chip';
export { ProgressBar, type ProgressBarProps, type BarThickness } from './ProgressBar';
export { ProgressRing, type ProgressRingProps } from './ProgressRing';
export { Avatar, type AvatarProps, type AvatarSize } from './Avatar';
export { Logo, type LogoProps, type LogoSize } from './Logo';
export { Heading, type HeadingProps, type HeadingLevel } from './Heading';
export { Eyebrow, type EyebrowProps } from './Eyebrow';
export { Divider } from './Divider';
export { Stack, type StackProps, type StackGap } from './Stack';
export { Row, type RowProps } from './Row';
export { KPI, type KPIProps } from './KPI';
export { CodeBlock } from './CodeBlock';
export { CodeFrame, type CodeFrameProps, type CodeFrameTab } from './CodeFrame';
export { SkillNode, type SkillNodeProps, type SkillNodeState, type SkillNodeTint } from './SkillNode';
export { DnDSlot, type DnDSlotProps, type DnDTint } from './DnDSlot';
export { DnDToken, type DnDTokenProps } from './DnDToken';
export { Heart, type HeartProps } from './Heart';
export { Hearts, type HeartsProps } from './Hearts';
export { SegmentedControl, type SegmentedControlProps, type SegmentOption } from './SegmentedControl';
export { TweaksPanel, TweakSection, TweakRadio, type TweaksPanelProps, type TweakRadioProps } from './TweaksPanel';
```

- [ ] **Step 27.2: Smoke import.** Add a temp test or run `cd web && npm run build`.

Run: `cd web && npm run build`
Expected: build succeeds.

- [ ] **Step 27.3: Commit.**

```bash
git add web/components/ui/index.ts
git commit -m "ui: add barrel export for primitives"
```

---

## Phase 4 — Showcase route

### Task 28: `/design-system` route scaffold + Foundations section

**Files:**
- Create: `web/app/design-system/page.tsx`
- Create: `web/app/design-system/Showcase.tsx`
- Create: `web/app/design-system/sections/Foundations.tsx`

- [ ] **Step 28.1: Create the page entry.**

`web/app/design-system/page.tsx`:

```tsx
import { Showcase } from './Showcase';

export const metadata = { title: 'BootCamp · Design system' };

export default function DesignSystemPage() {
  return <Showcase />;
}
```

- [ ] **Step 28.2: Create the showcase shell.**

`web/app/design-system/Showcase.tsx`:

```tsx
'use client';
import { useTweaks } from '@/lib/tweaks';
import { TweaksPanel, TweakSection, TweakRadio, Heading, Eyebrow, Stack } from '@/components/ui';
import { Foundations } from './sections/Foundations';

export function Showcase() {
  const { theme, density, setTheme, setDensity } = useTweaks();
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '220px 1fr', minHeight: '100vh' }}>
      <nav style={{ position: 'sticky', top: 0, height: '100vh', padding: 24, borderRight: '1px solid var(--line-1)', background: 'var(--bg-1)' }}>
        <Eyebrow>Design system</Eyebrow>
        <Stack gap="tight" style={{ marginTop: 16 }}>
          <a href="#foundations" style={{ color: 'var(--text-2)' }}>Foundations</a>
          <a href="#primitives" style={{ color: 'var(--text-2)' }}>Primitives</a>
          <a href="#composites" style={{ color: 'var(--text-2)' }}>Composites</a>
        </Stack>
      </nav>
      <main style={{ padding: 32, maxWidth: 1080 }}>
        <Heading level="display">BootCamp design system</Heading>
        <p style={{ color: 'var(--text-2)', marginTop: 8 }}>
          Live reference for tokens and primitives. All variants in one place.
        </p>
        <Foundations />
      </main>
      <TweaksPanel title="Tweaks" defaultOpen>
        <TweakSection label="Appearance" />
        <TweakRadio label="Theme" value={theme === 'system' ? 'dark' : theme} options={['dark', 'light']} onChange={setTheme} />
        <TweakRadio label="Density" value={density} options={['comfortable', 'compact']} onChange={setDensity} />
      </TweaksPanel>
    </div>
  );
}
```

- [ ] **Step 28.3: Create Foundations section.**

`web/app/design-system/sections/Foundations.tsx`:

```tsx
import { Heading, Eyebrow, Stack, Row } from '@/components/ui';

const PEACOCK = ['50','100','200','300','400','500','600','700','800','900'];
const SURFACES = ['bg-0','bg-1','bg-2','bg-3','bg-4'];
const SPACINGS = ['s-1','s-2','s-3','s-4','s-5','s-6','s-8','s-10','s-12','s-16','s-20'];
const RADII = ['r-xs','r-sm','r-md','r-lg','r-xl','r-2xl','r-pill'];

function Swatch({ token, label }: { token: string; label?: string }) {
  return (
    <div style={{ width: 120 }}>
      <div style={{ width: '100%', height: 64, background: `var(--${token})`, borderRadius: 8, border: '1px solid var(--line-2)' }} />
      <div className="mono" style={{ fontSize: 'var(--t-xs)', color: 'var(--text-3)', marginTop: 6 }}>{label || token}</div>
    </div>
  );
}

export function Foundations() {
  return (
    <section id="foundations" style={{ marginTop: 32 }}>
      <Eyebrow>1. Foundations</Eyebrow>
      <Heading level="h1" style={{ marginTop: 8 }}>Tokens</Heading>

      <Heading level="h3" style={{ marginTop: 24 }}>Peacock spectrum</Heading>
      <Row style={{ flexWrap: 'wrap', gap: 12, marginTop: 12 }}>
        {PEACOCK.map((p) => <Swatch key={p} token={`peacock-${p}`} />)}
      </Row>

      <Heading level="h3" style={{ marginTop: 24 }}>Surfaces</Heading>
      <Row style={{ flexWrap: 'wrap', gap: 12, marginTop: 12 }}>
        {SURFACES.map((s) => <Swatch key={s} token={s} />)}
      </Row>

      <Heading level="h3" style={{ marginTop: 24 }}>Track accents</Heading>
      <Row style={{ flexWrap: 'wrap', gap: 12, marginTop: 12 }}>
        <Swatch token="iris-400" label="iris (Swift)" />
        <Swatch token="amber-400" label="amber (Kotlin)" />
        <Swatch token="royal-400" label="royal" />
      </Row>

      <Heading level="h3" style={{ marginTop: 24 }}>Typography</Heading>
      <Stack gap="tight" style={{ marginTop: 12 }}>
        <div className="h-display">Display heading</div>
        <div className="h1">Heading 1</div>
        <div className="h2">Heading 2</div>
        <div className="h3">Heading 3</div>
        <div className="h4">Heading 4</div>
        <div>Body text — Inter Tight, 15px.</div>
        <div className="mono">mono · JetBrains Mono</div>
      </Stack>

      <Heading level="h3" style={{ marginTop: 24 }}>Spacing</Heading>
      <Stack gap="tight" style={{ marginTop: 12 }}>
        {SPACINGS.map((s) => (
          <Row key={s} style={{ alignItems: 'center', gap: 12 }}>
            <span className="mono" style={{ width: 60, fontSize: 'var(--t-xs)', color: 'var(--text-3)' }}>{s}</span>
            <div style={{ height: 8, width: `var(--${s})`, background: 'var(--peacock-400)', borderRadius: 2 }} />
          </Row>
        ))}
      </Stack>

      <Heading level="h3" style={{ marginTop: 24 }}>Radius</Heading>
      <Row style={{ gap: 12, flexWrap: 'wrap', marginTop: 12 }}>
        {RADII.map((r) => (
          <div key={r} style={{ width: 96, textAlign: 'center' }}>
            <div style={{ width: 80, height: 80, background: 'var(--bg-3)', borderRadius: `var(--${r})`, border: '1px solid var(--line-2)', margin: '0 auto' }} />
            <div className="mono" style={{ fontSize: 'var(--t-xs)', color: 'var(--text-3)', marginTop: 6 }}>{r}</div>
          </div>
        ))}
      </Row>
    </section>
  );
}
```

- [ ] **Step 28.4: Run dev server briefly to smoke.**

Run: `cd web && npm run build`
Expected: build succeeds.

- [ ] **Step 28.5: Commit.**

```bash
git add web/app/design-system
git commit -m "ui: add /design-system showcase scaffold + Foundations section"
```

### Task 29: Primitives section

**Files:**
- Create: `web/app/design-system/sections/Primitives.tsx`
- Modify: `web/app/design-system/Showcase.tsx`

- [ ] **Step 29.1: Implement Primitives.**

`web/app/design-system/sections/Primitives.tsx`:

```tsx
import {
  Button, Card, Input, SearchInput, Badge, Chip, ProgressBar, ProgressRing,
  Avatar, Logo, Icon, Heading, Eyebrow, Stack, Row, Divider,
} from '@/components/ui';

function Pane({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <Card style={{ marginTop: 12 }}>
      <Eyebrow>{title}</Eyebrow>
      <div style={{ marginTop: 8 }}>{children}</div>
    </Card>
  );
}

export function Primitives() {
  return (
    <section id="primitives" style={{ marginTop: 48 }}>
      <Eyebrow>2. Primitives</Eyebrow>
      <Heading level="h1" style={{ marginTop: 8 }}>Library</Heading>

      <Pane title="Button">
        <Row style={{ gap: 8, flexWrap: 'wrap' }}>
          <Button>Default</Button>
          <Button variant="primary">Primary</Button>
          <Button variant="iridescent">Iridescent</Button>
          <Button variant="ghost">Ghost</Button>
          <Button variant="outline">Outline</Button>
          <Button disabled>Disabled</Button>
        </Row>
        <Row style={{ gap: 8, marginTop: 12 }}>
          <Button size="sm">Small</Button>
          <Button>Default</Button>
          <Button size="lg">Large</Button>
          <Button iconOnly aria-label="settings"><Icon name="settings" size={16} /></Button>
        </Row>
      </Pane>

      <Pane title="Input / SearchInput">
        <Stack gap="tight">
          <Input placeholder="Default input" />
          <SearchInput placeholder="Search lessons, paths, badges…" />
        </Stack>
      </Pane>

      <Pane title="Badge">
        <Row style={{ gap: 8, flexWrap: 'wrap' }}>
          <Badge>Default</Badge>
          <Badge tone="brand" dot>Brand</Badge>
          <Badge tone="iris" dot>Swift</Badge>
          <Badge tone="amber" dot>Kotlin</Badge>
          <Badge tone="success" dot>Done</Badge>
          <Badge mono>L08</Badge>
        </Row>
      </Pane>

      <Pane title="Chip">
        <Row style={{ gap: 8 }}>
          <Chip>Default</Chip>
          <Chip active>Active</Chip>
        </Row>
      </Pane>

      <Pane title="Card">
        <Row style={{ gap: 12, alignItems: 'stretch' }}>
          <Card style={{ flex: 1 }}>Default card</Card>
          <Card variant="elevated" style={{ flex: 1 }}>Elevated card</Card>
          <Card variant="glow" style={{ flex: 1 }}>Glow card</Card>
        </Row>
      </Pane>

      <Pane title="ProgressBar">
        <Stack gap="tight">
          <ProgressBar value={0} thickness="thin" />
          <ProgressBar value={40} />
          <ProgressBar value={100} thickness="thick" />
        </Stack>
      </Pane>

      <Pane title="ProgressRing">
        <Row style={{ gap: 16 }}>
          <ProgressRing value={0} />
          <ProgressRing value={40} />
          <ProgressRing value={100} />
        </Row>
      </Pane>

      <Pane title="Avatar">
        <Row style={{ gap: 12, alignItems: 'center' }}>
          <Avatar size="sm" initials="JK" />
          <Avatar initials="JK" />
          <Avatar size="lg" initials="JK" />
        </Row>
      </Pane>

      <Pane title="Logo">
        <Row style={{ gap: 16 }}>
          <Logo size="sm" />
          <Logo />
        </Row>
      </Pane>

      <Pane title="Icon set">
        <Row style={{ gap: 16, flexWrap: 'wrap' }}>
          {(['home','tree','play','user','trophy','bookmark','settings','flame','bolt','check','chevR','chevL','star','lock','code','grid','book','target','search','plus','arrowR','refresh'] as const).map((n) => (
            <div key={n} style={{ width: 64, textAlign: 'center' }}>
              <Icon name={n} size={20} />
              <div className="mono" style={{ fontSize: 'var(--t-2xs)', color: 'var(--text-3)' }}>{n}</div>
            </div>
          ))}
        </Row>
      </Pane>

      <Divider />
    </section>
  );
}
```

- [ ] **Step 29.2: Mount Primitives in Showcase.**

Modify `web/app/design-system/Showcase.tsx` — import and render `<Primitives />` below `<Foundations />`:

```tsx
import { Foundations } from './sections/Foundations';
import { Primitives } from './sections/Primitives';
// …
<Foundations />
<Primitives />
```

- [ ] **Step 29.3: Build smoke.** `cd web && npm run build`

- [ ] **Step 29.4: Commit.**

```bash
git add web/app/design-system/sections/Primitives.tsx web/app/design-system/Showcase.tsx
git commit -m "ui: add Primitives section to /design-system"
```

### Task 30: Composite primitives section

**Files:**
- Create: `web/app/design-system/sections/Composites.tsx`
- Modify: `web/app/design-system/Showcase.tsx`

- [ ] **Step 30.1: Implement Composites.**

`web/app/design-system/sections/Composites.tsx`:

```tsx
'use client';
import { useState } from 'react';
import {
  SkillNode, Hearts, DnDSlot, DnDToken, CodeBlock, CodeFrame, KPI,
  SegmentedControl, Card, Eyebrow, Heading, Row, Stack, Icon,
} from '@/components/ui';

export function Composites() {
  const [track, setTrack] = useState<'swift' | 'kotlin'>('swift');
  const tint = track;

  return (
    <section id="composites" style={{ marginTop: 48 }}>
      <Eyebrow>3. Composite primitives</Eyebrow>
      <Heading level="h1" style={{ marginTop: 8 }}>Lesson primitives</Heading>

      <Card style={{ marginTop: 12 }}>
        <Eyebrow>SkillNode</Eyebrow>
        <Row style={{ gap: 16, marginTop: 12, flexWrap: 'wrap' }}>
          {(['completed','current','available','locked'] as const).map((s) => (
            <Stack gap="tight" key={s} style={{ alignItems: 'center' }}>
              <SkillNode state={s} tint={tint}>
                {s === 'completed' && <Icon name="check" size={24} />}
                {s === 'current' && <Icon name="play" size={20} />}
                {s === 'available' && <Icon name="play" size={20} />}
                {s === 'locked' && <Icon name="lock" size={20} />}
              </SkillNode>
              <span className="mono" style={{ fontSize: 'var(--t-2xs)', color: 'var(--text-3)' }}>{s}</span>
            </Stack>
          ))}
        </Row>
      </Card>

      <Card style={{ marginTop: 12 }}>
        <Eyebrow>Hearts</Eyebrow>
        <Row style={{ gap: 16, marginTop: 12 }}>
          <Hearts count={5} />
          <Hearts count={3} />
          <Hearts count={0} />
        </Row>
      </Card>

      <Card style={{ marginTop: 12 }}>
        <Eyebrow>DnD slot + token</Eyebrow>
        <Row style={{ gap: 8, marginTop: 12, flexWrap: 'wrap', alignItems: 'center' }}>
          <DnDSlot>drop</DnDSlot>
          <DnDSlot filled tint="swift">@State</DnDSlot>
          <DnDSlot filled tint="kotlin">remember</DnDSlot>
          <DnDToken>var</DnDToken>
          <DnDToken used>let</DnDToken>
        </Row>
      </Card>

      <Card style={{ marginTop: 12 }}>
        <Eyebrow>CodeBlock + CodeFrame</Eyebrow>
        <CodeFrame tabs={[{ label: track === 'swift' ? 'main.swift' : 'Main.kt', active: true }]}>
          <CodeBlock>
            {track === 'swift'
              ? 'func greet(_ name: String) -> String {\n  return "Hello, \\(name)!"\n}'
              : 'fun greet(name: String): String {\n  return "Hello, $name!"\n}'}
          </CodeBlock>
        </CodeFrame>
      </Card>

      <Card style={{ marginTop: 12 }}>
        <Eyebrow>KPI</Eyebrow>
        <Row style={{ gap: 32, marginTop: 12 }}>
          <KPI label="Streak" value="12" delta="+1 today" />
          <KPI label="Daily XP" value="18 / 20" peacock />
        </Row>
      </Card>

      <Card style={{ marginTop: 12 }}>
        <Eyebrow>SegmentedControl</Eyebrow>
        <div style={{ marginTop: 12 }}>
          <SegmentedControl
            value={track}
            onChange={setTrack}
            options={[
              { value: 'swift', label: 'Swift', activeClassName: 'swift' },
              { value: 'kotlin', label: 'Kotlin', activeClassName: 'kotlin' },
            ]}
          />
        </div>
      </Card>
    </section>
  );
}
```

- [ ] **Step 30.2: Mount Composites in Showcase.**

In `Showcase.tsx`, after `<Primitives />`:

```tsx
import { Composites } from './sections/Composites';
// …
<Composites />
```

- [ ] **Step 30.3: Build smoke.** `cd web && npm run build`

- [ ] **Step 30.4: Commit.**

```bash
git add web/app/design-system/sections/Composites.tsx web/app/design-system/Showcase.tsx
git commit -m "ui: add Composites section to /design-system"
```

---

## Phase 5 — End-to-end verification

### Task 31: Playwright smoke test for `/design-system`

**Files:**
- Create: `web/tests/e2e/design-system.spec.ts`

- [ ] **Step 31.1: Write the spec.**

```ts
import { test, expect } from '@playwright/test';

// /design-system is public; opt out of authenticated storage state.
test.use({ storageState: { cookies: [], origins: [] } });

test.describe('design system showcase', () => {
  test('renders without console errors and toggles theme + density', async ({ page }) => {
    const consoleErrors: string[] = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') consoleErrors.push(msg.text());
    });

    await page.goto('/design-system');

    // Foundations heading present
    await expect(page.getByText('Tokens')).toBeVisible();

    // Initial theme attribute exists
    const initialTheme = await page.locator('html').getAttribute('data-theme');
    expect(['dark', 'light']).toContain(initialTheme);

    // Toggle theme via TweaksPanel — click whichever option isn't current
    const oppositeTheme = initialTheme === 'dark' ? 'light' : 'dark';
    await page.getByRole('button', { name: oppositeTheme }).first().click();
    await expect(page.locator('html')).toHaveAttribute('data-theme', oppositeTheme);

    // Toggle density to compact
    await page.getByRole('button', { name: 'compact' }).first().click();
    await expect(page.locator('html')).toHaveAttribute('data-density', 'compact');

    // Toggle density back to comfortable
    await page.getByRole('button', { name: 'comfortable' }).first().click();
    await expect(page.locator('html')).toHaveAttribute('data-density', 'comfortable');

    expect(consoleErrors, `console errors: ${consoleErrors.join('\n')}`).toHaveLength(0);
  });
});
```

- [ ] **Step 31.2: Run e2e.**

Run: `cd web && npx playwright test design-system.spec.ts`
Expected: 1 test passes. (Web server may take up to 60s on first start — see `playwright.config.ts`.)

- [ ] **Step 31.3: Commit.**

```bash
git add web/tests/e2e/design-system.spec.ts
git commit -m "ui: add Playwright smoke for /design-system"
```

### Task 32: Final verification

- [ ] **Step 32.1: Lint.** Run `cd web && npm run lint`. Expected: clean.

- [ ] **Step 32.2: Unit tests.** Run `cd web && npm test`. Expected: all green, including new files at `tests/lib/theme.test.ts`, `tests/lib/tweaks.test.ts`, `tests/ui/*.test.tsx`.

- [ ] **Step 32.3: Build.** Run `cd web && npm run build`. Expected: build succeeds, no TS errors.

- [ ] **Step 32.4: Manual back-compat smoke.**

Start dev: `cd web && npm run dev` (in a separate terminal).

Visit each existing route and confirm visuals are unchanged from before the PR:
- `/login` — login form looks identical to main.
- `/dashboard` — student dashboard layout intact.
- `/tracks` — tracks list intact.
- `/badges` — badges grid intact.
- Any active lesson page — exercises render normally.

Confirm `/design-system` renders all sections, no console errors, theme + density toggles repaint live.

- [ ] **Step 32.5: Stop dev, commit any incidental fixes (none expected).**

```bash
git status   # Expect clean working tree
```

---

## Self-review summary

**Spec coverage check:**

| Spec section                              | Implemented in                    |
| ----------------------------------------- | --------------------------------- |
| Tokens port (`tokens.css`)                | Task 1                            |
| Components CSS port                       | Task 2                            |
| `app.css` placeholder                     | Task 3                            |
| Globals.css imports                       | Task 4                            |
| `lib/theme.ts` density + data-theme       | Task 5                            |
| `useTweaks` hook                          | Task 6                            |
| Init script handles density               | Task 5 (THEME_INIT_SCRIPT update) |
| `cn()` helper                             | Task 8                            |
| Icon primitive                            | Task 9                            |
| Button / Card / Input + SearchInput       | Tasks 10–12                       |
| Badge / Chip                              | Tasks 13–14                       |
| ProgressBar / ProgressRing                | Task 15                           |
| Avatar / Logo                             | Tasks 16–17                       |
| Heading / Eyebrow / Divider               | Task 18                           |
| Stack / Row                               | Task 19                           |
| KPI                                       | Task 20                           |
| CodeBlock / CodeFrame                     | Task 21                           |
| SkillNode                                 | Task 22                           |
| DnDSlot / DnDToken                        | Task 23                           |
| Heart / Hearts                            | Task 24                           |
| SegmentedControl                          | Task 25                           |
| TweaksPanel + section + radio             | Task 26                           |
| Barrel export                             | Task 27                           |
| `/design-system` route + Foundations      | Task 28                           |
| Primitives showcase section               | Task 29                           |
| Composites showcase section               | Task 30                           |
| Playwright smoke for showcase             | Task 31                           |
| Manual back-compat verification           | Task 32                           |

No spec gaps. No placeholders. Type names consistent (`ThemeMode`, `Density`, `ButtonVariant`, etc. used identically across hook, primitive, and showcase).
