# App Shell Migration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace `web/components/layout/AppShell.tsx`'s chrome with a Sidebar + Topbar built from primitives, by moving 8 auth-gated pages into a Next.js `(authed)` route group with its own layout. Update `SettingsMenu` to consume `useTweaks` and add Density. Ship without changing any page body.

**Architecture:** New chrome lives in `web/components/shell/` (Sidebar, Topbar, helpers) and is consumed exactly once by `app/(authed)/layout.tsx`. The 8 calling pages move into `(authed)/` via `git mv` so blame survives. `AppShell.tsx` becomes a per-page heading-bar shim — its existing `(title, subtitle, children)` API is preserved so call sites don't change. `SettingsMenu` is rebuilt with primitives and gains a Density chip toggle. `AuthProvider` is unchanged. `RevisitIcon` and `CohortBadge` are out of scope.

**Tech Stack:** Next.js 14 App Router, React 18, TypeScript (strict), Vitest + Testing Library + jsdom (tests in `tests/`), Playwright (e2e). Path alias `@/*` → `./`. The primitives library (`@/components/ui`) and theme/density mechanism (`@/lib/theme`, `@/lib/tweaks`) shipped in Sub-project A and is depended on heavily.

**Spec:** `docs/superpowers/specs/2026-05-01-app-shell-design.md`. Read it first if anything below seems out of context.

**Source design bundle:** `c:/tmp/design-bootcamp/bootcamp/project/app-shell.jsx` and `app.css` for visual reference (the .side and .topbar CSS classes are already shipped in `components.css`).

**Working directory:** `c:/tmp/bootcamp-web-app-shell/` — a git worktree of `c:/Users/ricma/BootCamp/web/` checked out to a fresh `feat/app-shell` branch off `master` (806fed0). The worktree IS the `web/` directory; spec paths like `web/components/shell/Sidebar.tsx` translate to `components/shell/Sidebar.tsx` inside the worktree.

---

## Pre-flight

- [ ] **Step 0.1:** Create the worktree.

Run: `git -C /c/Users/ricma/BootCamp/web worktree add /c/tmp/bootcamp-web-app-shell -b feat/app-shell master`
Expected: `Preparing worktree (new branch 'feat/app-shell')` and `HEAD is now at 806fed0`.

- [ ] **Step 0.2:** Install dependencies in the worktree.

Run: `cd /c/tmp/bootcamp-web-app-shell && npm install --no-audit --no-fund`
Expected: completes with `added N packages` (no errors).

- [ ] **Step 0.3:** Confirm baseline is green.

Run from inside the worktree: `npm run lint && npm test && npm run build`
Expected: all three succeed; tests show 191 passing across 53 files; build outputs all routes including `/design-system`. If any fail, stop and surface.

---

## Phase 1 — New shell components

### Task 1: `SidebarNavItem` primitive

**Files:**
- Create: `components/shell/SidebarNavItem.tsx`
- Test: `tests/shell/SidebarNavItem.test.tsx`

`SidebarNavItem` is the building block for every sidebar row. It can render as either a Next.js `<Link>` (when `href` is provided) or a `<button>` (when `onClick` is provided). It applies the `.side-link.active` class when `active` is true, slots an `Icon` and label, and supports an optional badge slot at the right.

- [ ] **Step 1.1: Write failing test.**

Create `tests/shell/SidebarNavItem.test.tsx`:

```tsx
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SidebarNavItem } from '@/components/shell/SidebarNavItem';

describe('SidebarNavItem', () => {
  it('renders an anchor when href is provided', () => {
    render(<SidebarNavItem icon="home" label="Dashboard" href="/dashboard" />);
    const link = screen.getByRole('link', { name: /dashboard/i });
    expect(link).toHaveAttribute('href', '/dashboard');
  });

  it('renders a button and fires onClick when onClick is provided (no href)', async () => {
    const onClick = vi.fn();
    render(<SidebarNavItem icon="play" label="Continue lesson" onClick={onClick} />);
    await userEvent.click(screen.getByRole('button', { name: /continue lesson/i }));
    expect(onClick).toHaveBeenCalledOnce();
  });

  it('emits .side-link.active when active', () => {
    const { container } = render(<SidebarNavItem icon="home" label="X" href="/x" active />);
    expect(container.firstChild).toHaveClass('side-link', 'active');
  });

  it('renders an icon with .side-icon class', () => {
    const { container } = render(<SidebarNavItem icon="home" label="X" href="/x" />);
    expect(container.querySelector('svg.side-icon')).not.toBeNull();
  });

  it('renders a badge slot when badge is provided', () => {
    render(
      <SidebarNavItem icon="refresh" label="Review" href="/review" badge={<span data-testid="badge">3</span>} />,
    );
    expect(screen.getByTestId('badge')).toBeTruthy();
  });
});
```

- [ ] **Step 1.2: Run — confirm failure.**

Run: `npx vitest run tests/shell/SidebarNavItem.test.tsx`
Expected: module not found.

- [ ] **Step 1.3: Implement.**

Create `components/shell/SidebarNavItem.tsx`:

```tsx
import Link from 'next/link';
import { type ReactNode } from 'react';
import { cn } from '@/components/ui/cn';
import { Icon, type IconName } from '@/components/ui/Icon';

interface CommonProps {
  icon: IconName;
  label: string;
  active?: boolean;
  badge?: ReactNode;
  className?: string;
}

interface LinkVariant extends CommonProps {
  href: string;
  onClick?: never;
}

interface ButtonVariant extends CommonProps {
  href?: never;
  onClick: () => void;
}

export type SidebarNavItemProps = LinkVariant | ButtonVariant;

export function SidebarNavItem(props: SidebarNavItemProps) {
  const { icon, label, active, badge, className } = props;
  const klass = cn('side-link', active && 'active', className);
  const inner = (
    <>
      <Icon name={icon} size={18} className="side-icon" />
      <span>{label}</span>
      {badge}
    </>
  );

  if ('href' in props && props.href !== undefined) {
    return (
      <Link href={props.href} className={klass}>
        {inner}
      </Link>
    );
  }
  return (
    <button type="button" onClick={props.onClick} className={klass} style={{ width: '100%', textAlign: 'left' }}>
      {inner}
    </button>
  );
}
```

- [ ] **Step 1.4: Run — confirm pass.**

Run: `npx vitest run tests/shell/SidebarNavItem.test.tsx`
Expected: 5 passed.

- [ ] **Step 1.5: Commit.**

```bash
git add components/shell/SidebarNavItem.tsx tests/shell/SidebarNavItem.test.tsx
git commit -m "shell: add SidebarNavItem

Sidebar row primitive used by every nav entry. Renders as <Link> when
href is provided, <button> when onClick is provided. Emits .side-link
and optional .active classes; slots Icon + label + optional badge.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

### Task 2: `ReviewQueueBadge`

**Files:**
- Create: `components/shell/ReviewQueueBadge.tsx`
- Test: `tests/shell/ReviewQueueBadge.test.tsx`

Lazy-fetches the review queue on mount; renders a `Badge` with the queue count when > 0, nothing when zero. Failures silently render nothing.

- [ ] **Step 2.1: Write failing test.**

Create `tests/shell/ReviewQueueBadge.test.tsx`:

```tsx
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, waitFor } from '@testing-library/react';
import { ReviewQueueBadge } from '@/components/shell/ReviewQueueBadge';

vi.mock('@/lib/review', () => ({
  fetchReviewQueue: vi.fn(),
}));
import { fetchReviewQueue } from '@/lib/review';

describe('ReviewQueueBadge', () => {
  beforeEach(() => {
    vi.mocked(fetchReviewQueue).mockReset();
  });

  it('renders the count when queue size > 0', async () => {
    vi.mocked(fetchReviewQueue).mockResolvedValueOnce({ queue: [{}, {}, {}] } as never);
    const { container, findByText } = render(<ReviewQueueBadge />);
    await findByText('3');
    expect(container.querySelector('.badge')).not.toBeNull();
  });

  it('renders nothing when queue size is 0', async () => {
    vi.mocked(fetchReviewQueue).mockResolvedValueOnce({ queue: [] } as never);
    const { container } = render(<ReviewQueueBadge />);
    await waitFor(() => expect(fetchReviewQueue).toHaveBeenCalled());
    expect(container.querySelector('.badge')).toBeNull();
  });

  it('renders nothing when fetch fails', async () => {
    vi.mocked(fetchReviewQueue).mockRejectedValueOnce(new Error('boom'));
    const { container } = render(<ReviewQueueBadge />);
    await waitFor(() => expect(fetchReviewQueue).toHaveBeenCalled());
    expect(container.querySelector('.badge')).toBeNull();
  });
});
```

- [ ] **Step 2.2: Run — confirm failure.**

Run: `npx vitest run tests/shell/ReviewQueueBadge.test.tsx`
Expected: module not found.

- [ ] **Step 2.3: Implement.**

Create `components/shell/ReviewQueueBadge.tsx`:

```tsx
'use client';
import { useEffect, useState } from 'react';
import { Badge } from '@/components/ui/Badge';
import { fetchReviewQueue } from '@/lib/review';

export function ReviewQueueBadge() {
  const [count, setCount] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetchReviewQueue()
      .then((res) => {
        if (cancelled) return;
        setCount(res?.queue?.length ?? 0);
      })
      .catch(() => {
        if (cancelled) return;
        setCount(null);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (count === null || count <= 0) return null;
  return <Badge tone="brand">{count}</Badge>;
}
```

- [ ] **Step 2.4: Run — confirm pass.**

Run: `npx vitest run tests/shell/ReviewQueueBadge.test.tsx`
Expected: 3 passed.

- [ ] **Step 2.5: Commit.**

```bash
git add components/shell/ReviewQueueBadge.tsx tests/shell/ReviewQueueBadge.test.tsx
git commit -m "shell: add ReviewQueueBadge

Lazy-fetches /api/review/queue on mount; shows a brand-toned Badge
with the queue count when > 0; renders nothing when zero or on error.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

### Task 3: `ContinueLessonButton`

**Files:**
- Create: `components/shell/ContinueLessonButton.tsx`
- Test: `tests/shell/ContinueLessonButton.test.tsx`

Renders a `SidebarNavItem` with a static `/tracks` href. Active when the user is inside any `/lesson/...` page. Badge shows `Day {streak}` when `useAuth().streak > 0`.

- [ ] **Step 3.1: Write failing test.**

Create `tests/shell/ContinueLessonButton.test.tsx`:

```tsx
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ContinueLessonButton } from '@/components/shell/ContinueLessonButton';

vi.mock('@/components/layout/AuthProvider', () => ({
  useAuth: vi.fn(),
}));
import { useAuth } from '@/components/layout/AuthProvider';

describe('ContinueLessonButton', () => {
  it('renders an anchor to /tracks', () => {
    vi.mocked(useAuth).mockReturnValue({ streak: 0 } as never);
    render(<ContinueLessonButton active={false} />);
    expect(screen.getByRole('link', { name: /continue lesson/i })).toHaveAttribute('href', '/tracks');
  });

  it('renders Day {streak} badge when streak > 0', () => {
    vi.mocked(useAuth).mockReturnValue({ streak: 12 } as never);
    render(<ContinueLessonButton active={false} />);
    expect(screen.getByText('Day 12')).toBeTruthy();
  });

  it('renders no badge when streak is 0', () => {
    vi.mocked(useAuth).mockReturnValue({ streak: 0 } as never);
    const { container } = render(<ContinueLessonButton active={false} />);
    expect(container.querySelector('.badge')).toBeNull();
  });

  it('emits .side-link.active when active', () => {
    vi.mocked(useAuth).mockReturnValue({ streak: 0 } as never);
    const { container } = render(<ContinueLessonButton active />);
    expect(container.firstChild).toHaveClass('side-link', 'active');
  });
});
```

- [ ] **Step 3.2: Run — confirm failure.**

Run: `npx vitest run tests/shell/ContinueLessonButton.test.tsx`
Expected: module not found.

- [ ] **Step 3.3: Implement.**

Create `components/shell/ContinueLessonButton.tsx`:

```tsx
'use client';
import { Badge } from '@/components/ui/Badge';
import { useAuth } from '@/components/layout/AuthProvider';
import { SidebarNavItem } from './SidebarNavItem';

export function ContinueLessonButton({ active }: { active: boolean }) {
  const { streak } = useAuth();
  const badge = streak > 0 ? <Badge tone="brand">Day {streak}</Badge> : null;
  return (
    <SidebarNavItem
      icon="play"
      label="Continue lesson"
      href="/tracks"
      active={active}
      badge={badge}
    />
  );
}
```

- [ ] **Step 3.4: Run — confirm pass.**

Run: `npx vitest run tests/shell/ContinueLessonButton.test.tsx`
Expected: 4 passed.

- [ ] **Step 3.5: Commit.**

```bash
git add components/shell/ContinueLessonButton.tsx tests/shell/ContinueLessonButton.test.tsx
git commit -m "shell: add ContinueLessonButton

Sidebar row pointing at /tracks (the tracks list already exposes
per-track Continue buttons that resolve to the right lesson). Badge
shows 'Day {streak}' when useAuth().streak > 0. Future polish:
dynamic resolution to /lesson/[id] is a follow-up; this PR keeps B
narrow.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

### Task 4: `ActiveTrackPill`

**Files:**
- Create: `components/shell/ActiveTrackPill.tsx`
- Test: `tests/shell/ActiveTrackPill.test.tsx`

Renders the small "Active track" block from the design's sidebar (eyebrow + Swift/Kotlin badge + L3·1240 XP-style mono label). Stub for now: defaults to "Swift" + actual XP from `useAuth().totalPoints`. Annotated with a TODO referencing future track-context work.

- [ ] **Step 4.1: Write failing test.**

Create `tests/shell/ActiveTrackPill.test.tsx`:

```tsx
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ActiveTrackPill } from '@/components/shell/ActiveTrackPill';

vi.mock('@/components/layout/AuthProvider', () => ({
  useAuth: vi.fn(),
}));
import { useAuth } from '@/components/layout/AuthProvider';

describe('ActiveTrackPill', () => {
  it('renders the eyebrow and a Swift badge by default', () => {
    vi.mocked(useAuth).mockReturnValue({ totalPoints: 1240 } as never);
    const { container } = render(<ActiveTrackPill />);
    expect(screen.getByText(/active track/i)).toHaveClass('eyebrow');
    expect(container.querySelector('.badge-iris')).not.toBeNull();
  });

  it('renders the user totalPoints in the meta line', () => {
    vi.mocked(useAuth).mockReturnValue({ totalPoints: 1240 } as never);
    render(<ActiveTrackPill />);
    expect(screen.getByText(/1,240 XP/)).toBeTruthy();
  });
});
```

- [ ] **Step 4.2: Run — confirm failure.**

Run: `npx vitest run tests/shell/ActiveTrackPill.test.tsx`
Expected: module not found.

- [ ] **Step 4.3: Implement.**

Create `components/shell/ActiveTrackPill.tsx`:

```tsx
'use client';
import { Badge } from '@/components/ui/Badge';
import { Eyebrow } from '@/components/ui/Eyebrow';
import { Row } from '@/components/ui/Row';
import { useAuth } from '@/components/layout/AuthProvider';

// TODO: lift "active track" to a shared TrackContext once sub-project C/D introduces it.
// For now, default to Swift and show the user's total XP.
export function ActiveTrackPill() {
  const { totalPoints } = useAuth();
  return (
    <div
      style={{
        padding: 12,
        border: '1px solid var(--line-1)',
        borderRadius: 'var(--r-md)',
        marginBottom: 8,
        background: 'var(--bg-1)',
      }}
    >
      <Eyebrow style={{ marginBottom: 8 }}>Active track</Eyebrow>
      <Row style={{ gap: 10 }}>
        <Badge tone="iris" dot>Swift</Badge>
        <span className="muted mono" style={{ fontSize: 'var(--t-xs)', marginLeft: 'auto' }}>
          {totalPoints.toLocaleString()} XP
        </span>
      </Row>
    </div>
  );
}
```

- [ ] **Step 4.4: Run — confirm pass.**

Run: `npx vitest run tests/shell/ActiveTrackPill.test.tsx`
Expected: 2 passed.

- [ ] **Step 4.5: Commit.**

```bash
git add components/shell/ActiveTrackPill.tsx tests/shell/ActiveTrackPill.test.tsx
git commit -m "shell: add ActiveTrackPill

Small eyebrow + Swift/Kotlin badge + XP block at the top of the
sidebar. Stub: defaults to Swift; will be wired to a real TrackContext
in sub-project C/D.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

### Task 5: `Topbar`

**Files:**
- Create: `components/shell/Topbar.tsx`
- Test: `tests/shell/Topbar.test.tsx`

Renders the design's topbar: disabled search, disabled track switcher, live streak, live XP. No hearts, no settings icon (those live elsewhere or are out of scope).

- [ ] **Step 5.1: Write failing test.**

Create `tests/shell/Topbar.test.tsx`:

```tsx
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Topbar } from '@/components/shell/Topbar';

vi.mock('@/components/layout/AuthProvider', () => ({
  useAuth: vi.fn(),
}));
import { useAuth } from '@/components/layout/AuthProvider';

describe('Topbar', () => {
  it('renders streak and totalPoints from useAuth', () => {
    vi.mocked(useAuth).mockReturnValue({ streak: 12, totalPoints: 1240 } as never);
    render(<Topbar />);
    expect(screen.getByText('12')).toBeTruthy();
    expect(screen.getByText('1,240')).toBeTruthy();
  });

  it('renders a disabled search input', () => {
    vi.mocked(useAuth).mockReturnValue({ streak: 0, totalPoints: 0 } as never);
    render(<Topbar />);
    const input = screen.getByPlaceholderText(/search lessons coming soon/i) as HTMLInputElement;
    expect(input.disabled).toBe(true);
  });

  it('renders both Swift and Kotlin segmented options', () => {
    vi.mocked(useAuth).mockReturnValue({ streak: 0, totalPoints: 0 } as never);
    render(<Topbar />);
    expect(screen.getByText('Swift')).toBeTruthy();
    expect(screen.getByText('Kotlin')).toBeTruthy();
  });
});
```

- [ ] **Step 5.2: Run — confirm failure.**

Run: `npx vitest run tests/shell/Topbar.test.tsx`
Expected: module not found.

- [ ] **Step 5.3: Implement.**

Create `components/shell/Topbar.tsx`:

```tsx
'use client';
import { Icon } from '@/components/ui/Icon';
import { Row } from '@/components/ui/Row';
import { SearchInput } from '@/components/ui/Input';
import { SegmentedControl } from '@/components/ui/SegmentedControl';
import { useAuth } from '@/components/layout/AuthProvider';

// TODO: wire Swift/Kotlin SegmentedControl to a real TrackContext in sub-project C/D.
// For now it renders disabled — visual fidelity without fake functionality.
export function Topbar() {
  const { streak, totalPoints } = useAuth();
  return (
    <div className="topbar">
      <SearchInput
        placeholder="Search lessons coming soon"
        disabled
        wrapperClassName="search"
        style={{ flex: 1, maxWidth: 480 }}
      />
      <SegmentedControl
        value="swift"
        onChange={() => {}}
        options={[
          { value: 'swift', label: 'Swift', activeClassName: 'swift' },
          { value: 'kotlin', label: 'Kotlin', activeClassName: 'kotlin' },
        ]}
        aria-disabled
      />
      <Row style={{ gap: 14, marginLeft: 'auto' }}>
        <Row style={{ gap: 6 }}>
          <Icon name="flame" size={16} style={{ color: 'var(--amber-400)' }} />
          <span className="mono" style={{ fontWeight: 700 }}>{streak}</span>
        </Row>
        <Row style={{ gap: 6 }}>
          <Icon name="bolt" size={16} style={{ color: 'var(--peacock-300)' }} />
          <span className="mono" style={{ fontWeight: 700 }}>{totalPoints.toLocaleString()}</span>
        </Row>
      </Row>
    </div>
  );
}
```

- [ ] **Step 5.4: Run — confirm pass.**

Run: `npx vitest run tests/shell/Topbar.test.tsx`
Expected: 3 passed.

- [ ] **Step 5.5: Commit.**

```bash
git add components/shell/Topbar.tsx tests/shell/Topbar.test.tsx
git commit -m "shell: add Topbar

Disabled search + disabled Swift/Kotlin SegmentedControl + live streak
+ live totalPoints from useAuth. No hearts (lesson player concern),
no settings icon (lives in sidebar user pill).

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Phase 2 — SettingsMenu rebuild + SidebarUserPill

### Task 6: `SettingsMenu` rebuild

**Files:**
- Modify: `components/layout/SettingsMenu.tsx`
- Modify: `tests/layout/SettingsMenu.test.tsx` (existing — adjust to new structure)

Rebuilt internals using primitives (`Card`, `Stack`, `Row`, `Avatar`, `Badge`, `Eyebrow`, `Chip`, `Button`, `Divider`). Routes theme through `useTweaks().setTheme`; adds a Density section. New `anchored`/`onClose` props for use by `SidebarUserPill`.

- [ ] **Step 6.1: Inspect existing test file.**

Run: `cat tests/layout/SettingsMenu.test.tsx 2>/dev/null | head -40 || echo "file does not exist yet"`

If the file doesn't exist, you'll create it from scratch. If it does exist, you'll need to update its expectations since the rendered DOM changes (Tailwind classes → primitive classes).

- [ ] **Step 6.2: Write the new test.**

Create or replace `tests/layout/SettingsMenu.test.tsx`:

```tsx
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SettingsMenu } from '@/components/layout/SettingsMenu';

const setTheme = vi.fn();
const setDensity = vi.fn();

vi.mock('@/lib/tweaks', () => ({
  useTweaks: () => ({ theme: 'system', density: 'comfortable', setTheme, setDensity }),
}));

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

const logout = vi.fn();
vi.mock('@/components/layout/AuthProvider', () => ({
  useAuth: () => ({
    user: { name: 'Jordan Kim', email: 'jordan@bootcamp.dev', role: 'student' },
    logout,
  }),
}));

describe('SettingsMenu', () => {
  beforeEach(() => {
    setTheme.mockClear();
    setDensity.mockClear();
    logout.mockClear();
  });

  it('renders Appearance and Density sections with Account info', () => {
    render(<SettingsMenu />);
    expect(screen.getByText('Appearance')).toBeTruthy();
    expect(screen.getByText('Density')).toBeTruthy();
    expect(screen.getByText('Account')).toBeTruthy();
    expect(screen.getByText('Jordan Kim')).toBeTruthy();
    expect(screen.getByText('jordan@bootcamp.dev')).toBeTruthy();
    expect(screen.getByText('student')).toBeTruthy();
  });

  it('clicking a theme chip calls setTheme with that mode', async () => {
    render(<SettingsMenu />);
    await userEvent.click(screen.getByRole('button', { name: 'dark' }));
    expect(setTheme).toHaveBeenCalledWith('dark');
  });

  it('clicking a density chip calls setDensity with that value', async () => {
    render(<SettingsMenu />);
    await userEvent.click(screen.getByRole('button', { name: 'compact' }));
    expect(setDensity).toHaveBeenCalledWith('compact');
  });

  it('Sign out triggers logout from AuthProvider', async () => {
    render(<SettingsMenu />);
    await userEvent.click(screen.getByRole('button', { name: /sign out/i }));
    expect(logout).toHaveBeenCalled();
  });
});
```

- [ ] **Step 6.3: Run — confirm failure.**

Run: `npx vitest run tests/layout/SettingsMenu.test.tsx`
Expected: failures (either test selectors don't match the old Tailwind output, or the file doesn't expect the new useTweaks mock).

- [ ] **Step 6.4: Replace `components/layout/SettingsMenu.tsx`.**

```tsx
'use client';
import { useEffect, useRef, type CSSProperties } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/components/layout/AuthProvider';
import { useTweaks } from '@/lib/tweaks';
import { Avatar } from '@/components/ui/Avatar';
import { Badge, type BadgeTone } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Chip } from '@/components/ui/Chip';
import { Divider } from '@/components/ui/Divider';
import { Eyebrow } from '@/components/ui/Eyebrow';
import { Row } from '@/components/ui/Row';
import { Stack } from '@/components/ui/Stack';

const ROLE_TONES: Record<string, BadgeTone> = {
  admin: 'iris',
  instructor: 'amber',
  student: 'brand',
};

export interface SettingsMenuProps {
  anchored?: boolean;
  onClose?: () => void;
}

export function SettingsMenu({ anchored, onClose }: SettingsMenuProps = {}) {
  const { user, logout } = useAuth();
  const { theme, density, setTheme, setDensity } = useTweaks();
  const router = useRouter();
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!anchored || !onClose) return;
    function onDown(e: MouseEvent) {
      if (!ref.current || ref.current.contains(e.target as Node)) return;
      onClose?.();
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose?.();
    }
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [anchored, onClose]);

  async function handleSignOut() {
    await logout();
    onClose?.();
    router.push('/login');
  }

  const popoverStyle: CSSProperties = anchored
    ? { position: 'absolute', bottom: '100%', left: 0, right: 0, marginBottom: 8, zIndex: 20, width: 280 }
    : {};

  return (
    <div ref={ref} style={popoverStyle} role="dialog" aria-label="Settings">
      <Card variant="elevated">
        <Stack>
          <section>
            <Eyebrow>Appearance</Eyebrow>
            <Row style={{ gap: 6, marginTop: 8 }}>
              {(['system', 'light', 'dark'] as const).map((m) => (
                <Chip key={m} active={theme === m} onClick={() => setTheme(m)}>{m}</Chip>
              ))}
            </Row>
          </section>

          <section>
            <Eyebrow>Density</Eyebrow>
            <Row style={{ gap: 6, marginTop: 8 }}>
              {(['comfortable', 'compact'] as const).map((d) => (
                <Chip key={d} active={density === d} onClick={() => setDensity(d)}>{d}</Chip>
              ))}
            </Row>
          </section>

          <Divider />

          <section>
            <Eyebrow>Account</Eyebrow>
            {user ? (
              <Stack gap="tight" style={{ marginTop: 8 }}>
                <Row style={{ gap: 12 }}>
                  <Avatar initials={user.name.charAt(0).toUpperCase()} />
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div style={{ fontSize: 'var(--t-sm)', fontWeight: 600 }}>{user.name}</div>
                    <div className="muted" style={{ fontSize: 'var(--t-xs)' }}>{user.email}</div>
                  </div>
                  <Badge tone={ROLE_TONES[user.role] ?? 'brand'}>{user.role}</Badge>
                </Row>
                <Button variant="outline" onClick={handleSignOut} style={{ width: '100%' }}>
                  Sign out
                </Button>
              </Stack>
            ) : (
              <p className="muted" style={{ fontSize: 'var(--t-sm)', marginTop: 8 }}>Not signed in.</p>
            )}
          </section>
        </Stack>
      </Card>
    </div>
  );
}
```

- [ ] **Step 6.5: Run — confirm pass.**

Run: `npx vitest run tests/layout/SettingsMenu.test.tsx`
Expected: 4 passed.

- [ ] **Step 6.6: Commit.**

```bash
git add components/layout/SettingsMenu.tsx tests/layout/SettingsMenu.test.tsx
git commit -m "shell: rebuild SettingsMenu with primitives and add Density

Replaces Tailwind utility soup with Card/Stack/Row/Avatar/Badge/Eyebrow/
Chip/Button/Divider primitives. Routes theme + density through useTweaks
instead of calling applyTheme directly. New 'Density' section with
Comfortable/Compact chips. New optional anchored + onClose props let
SidebarUserPill mount it as a popover.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

### Task 7: `SidebarUserPill`

**Files:**
- Create: `components/shell/SidebarUserPill.tsx`
- Test: `tests/shell/SidebarUserPill.test.tsx`

Bottom-of-sidebar user pill — avatar + name + email. Clicking it toggles a popover that renders the new `SettingsMenu` in `anchored` mode.

- [ ] **Step 7.1: Write failing test.**

Create `tests/shell/SidebarUserPill.test.tsx`:

```tsx
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SidebarUserPill } from '@/components/shell/SidebarUserPill';

vi.mock('@/components/layout/AuthProvider', () => ({
  useAuth: vi.fn(),
}));
import { useAuth } from '@/components/layout/AuthProvider';

vi.mock('@/components/layout/SettingsMenu', () => ({
  SettingsMenu: ({ onClose }: { onClose?: () => void }) => (
    <div data-testid="settings-menu" onClick={onClose}>menu</div>
  ),
}));

describe('SidebarUserPill', () => {
  it('returns null when there is no user', () => {
    vi.mocked(useAuth).mockReturnValue({ user: null } as never);
    const { container } = render(<SidebarUserPill />);
    expect(container.firstChild).toBeNull();
  });

  it('renders the user info and toggles SettingsMenu on click', async () => {
    vi.mocked(useAuth).mockReturnValue({
      user: { name: 'Jordan Kim', email: 'jordan@bootcamp.dev', role: 'student' },
    } as never);
    render(<SidebarUserPill />);
    expect(screen.getByText('Jordan Kim')).toBeTruthy();
    expect(screen.getByText('jordan@bootcamp.dev')).toBeTruthy();
    expect(screen.queryByTestId('settings-menu')).toBeNull();
    await userEvent.click(screen.getByRole('button', { name: /jordan kim/i }));
    expect(screen.getByTestId('settings-menu')).toBeTruthy();
  });
});
```

- [ ] **Step 7.2: Run — confirm failure.**

Run: `npx vitest run tests/shell/SidebarUserPill.test.tsx`
Expected: module not found.

- [ ] **Step 7.3: Implement.**

Create `components/shell/SidebarUserPill.tsx`:

```tsx
'use client';
import { useState } from 'react';
import { Avatar } from '@/components/ui/Avatar';
import { useAuth } from '@/components/layout/AuthProvider';
import { SettingsMenu } from '@/components/layout/SettingsMenu';

export function SidebarUserPill() {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  if (!user) return null;
  return (
    <div style={{ marginTop: 'auto', position: 'relative' }}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label={`Open settings for ${user.name}`}
        style={{
          width: '100%',
          padding: 12,
          borderRadius: 'var(--r-md)',
          background: 'var(--bg-2)',
          border: '1px solid var(--line-1)',
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          textAlign: 'left',
          cursor: 'pointer',
        }}
      >
        <Avatar size="sm" initials={user.name.charAt(0).toUpperCase()} />
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 'var(--t-sm)', fontWeight: 600 }}>{user.name}</div>
          <div className="mono muted" style={{ fontSize: 'var(--t-2xs)' }}>{user.email}</div>
        </div>
      </button>
      {open && <SettingsMenu anchored onClose={() => setOpen(false)} />}
    </div>
  );
}
```

- [ ] **Step 7.4: Run — confirm pass.**

Run: `npx vitest run tests/shell/SidebarUserPill.test.tsx`
Expected: 2 passed.

- [ ] **Step 7.5: Commit.**

```bash
git add components/shell/SidebarUserPill.tsx tests/shell/SidebarUserPill.test.tsx
git commit -m "shell: add SidebarUserPill

Bottom-of-sidebar pill: avatar + name + email. Click toggles a
popover that mounts SettingsMenu in anchored mode (theme + density
+ sign-out + role badge).

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

### Task 8: `Sidebar`

**Files:**
- Create: `components/shell/Sidebar.tsx`
- Test: `tests/shell/Sidebar.test.tsx`

Top-level sidebar that composes Logo, ActiveTrackPill, every nav item, and SidebarUserPill. Conditionally renders the Instructor item by role.

- [ ] **Step 8.1: Write failing test.**

Create `tests/shell/Sidebar.test.tsx`:

```tsx
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Sidebar } from '@/components/shell/Sidebar';

vi.mock('next/navigation', () => ({
  usePathname: vi.fn(() => '/dashboard'),
}));
import { usePathname } from 'next/navigation';

vi.mock('@/components/layout/AuthProvider', () => ({
  useAuth: vi.fn(),
}));
import { useAuth } from '@/components/layout/AuthProvider';

vi.mock('@/components/shell/ReviewQueueBadge', () => ({
  ReviewQueueBadge: () => null,
}));

describe('Sidebar', () => {
  it('renders main nav items', () => {
    vi.mocked(useAuth).mockReturnValue({
      user: { name: 'Jordan', email: 'j@x', role: 'student' },
      streak: 0,
      totalPoints: 0,
    } as never);
    vi.mocked(usePathname).mockReturnValue('/dashboard');
    render(<Sidebar />);
    expect(screen.getByText('Dashboard')).toBeTruthy();
    expect(screen.getByText('Skill tree')).toBeTruthy();
    expect(screen.getByText('Continue lesson')).toBeTruthy();
    expect(screen.getByText('Profile')).toBeTruthy();
    expect(screen.getByText('Leaderboard')).toBeTruthy();
    expect(screen.getByText('Review')).toBeTruthy();
    expect(screen.getByText(/design system/i)).toBeTruthy();
  });

  it('does NOT render Instructor for student role', () => {
    vi.mocked(useAuth).mockReturnValue({
      user: { name: 'Jordan', email: 'j@x', role: 'student' },
      streak: 0,
      totalPoints: 0,
    } as never);
    vi.mocked(usePathname).mockReturnValue('/dashboard');
    render(<Sidebar />);
    expect(screen.queryByText('Instructor')).toBeNull();
  });

  it('renders Instructor for instructor role', () => {
    vi.mocked(useAuth).mockReturnValue({
      user: { name: 'Mx', email: 'mx@x', role: 'instructor' },
      streak: 0,
      totalPoints: 0,
    } as never);
    vi.mocked(usePathname).mockReturnValue('/dashboard');
    render(<Sidebar />);
    expect(screen.getByText('Instructor')).toBeTruthy();
  });

  it('renders Instructor for admin role', () => {
    vi.mocked(useAuth).mockReturnValue({
      user: { name: 'Mx', email: 'mx@x', role: 'admin' },
      streak: 0,
      totalPoints: 0,
    } as never);
    vi.mocked(usePathname).mockReturnValue('/dashboard');
    render(<Sidebar />);
    expect(screen.getByText('Instructor')).toBeTruthy();
  });

  it('marks Dashboard active when pathname is /dashboard', () => {
    vi.mocked(useAuth).mockReturnValue({
      user: { name: 'Jordan', email: 'j@x', role: 'student' },
      streak: 0,
      totalPoints: 0,
    } as never);
    vi.mocked(usePathname).mockReturnValue('/dashboard');
    const { container } = render(<Sidebar />);
    const dashLink = Array.from(container.querySelectorAll('a')).find((a) => a.textContent?.includes('Dashboard'));
    expect(dashLink).toHaveClass('active');
  });
});
```

- [ ] **Step 8.2: Run — confirm failure.**

Run: `npx vitest run tests/shell/Sidebar.test.tsx`
Expected: module not found.

- [ ] **Step 8.3: Implement.**

Create `components/shell/Sidebar.tsx`:

```tsx
'use client';
import { usePathname } from 'next/navigation';
import { Logo } from '@/components/ui/Logo';
import { useAuth } from '@/components/layout/AuthProvider';
import { ActiveTrackPill } from './ActiveTrackPill';
import { ContinueLessonButton } from './ContinueLessonButton';
import { ReviewQueueBadge } from './ReviewQueueBadge';
import { SidebarNavItem } from './SidebarNavItem';
import { SidebarUserPill } from './SidebarUserPill';

export function Sidebar() {
  const { user } = useAuth();
  const pathname = usePathname() ?? '';
  const isInstructor = user?.role === 'instructor' || user?.role === 'admin';
  return (
    <aside className="side">
      <div style={{ padding: '0 4px 12px' }}><Logo size="sm" /></div>
      <ActiveTrackPill />
      <SidebarNavItem icon="home" label="Dashboard" href="/dashboard" active={pathname === '/dashboard'} />
      <SidebarNavItem icon="tree" label="Skill tree" href="/tracks" active={pathname.startsWith('/tracks')} />
      <ContinueLessonButton active={pathname.startsWith('/lesson/')} />
      <SidebarNavItem icon="user" label="Profile" href="/badges" active={pathname === '/badges'} />
      <SidebarNavItem icon="trophy" label="Leaderboard" href="/dashboard#leaderboard" active={false} />

      <div className="side-section">More</div>
      <SidebarNavItem
        icon="refresh"
        label="Review"
        href="/review"
        active={pathname === '/review'}
        badge={<ReviewQueueBadge />}
      />
      {isInstructor && (
        <SidebarNavItem
          icon="trophy"
          label="Instructor"
          href="/instructor"
          active={pathname.startsWith('/instructor')}
        />
      )}
      <SidebarNavItem
        icon="grid"
        label="Design system ↗"
        href="/design-system"
        active={pathname === '/design-system'}
      />

      <SidebarUserPill />
    </aside>
  );
}
```

- [ ] **Step 8.4: Run — confirm pass.**

Run: `npx vitest run tests/shell/Sidebar.test.tsx`
Expected: 5 passed.

- [ ] **Step 8.5: Commit.**

```bash
git add components/shell/Sidebar.tsx tests/shell/Sidebar.test.tsx
git commit -m "shell: add Sidebar

Composes Logo + ActiveTrackPill + nav items (Dashboard, Skill tree,
Continue lesson, Profile→/badges, Leaderboard→/dashboard#leaderboard,
Review with queue badge, Instructor for instructor/admin only,
Design system) + SidebarUserPill at the bottom. Active state derived
from usePathname.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Phase 3 — AppShell shim conversion

### Task 9: Convert `AppShell.tsx` to a heading-bar shim

**Files:**
- Modify: `components/layout/AppShell.tsx`
- Modify: `tests/layout/AppShell.test.tsx` (or create if absent)

The chrome moves to `(authed)/layout.tsx` (next phase). `AppShell` becomes a small server-renderable component that emits the page heading + subtitle + children. No `'use client'`, no AuthProvider check, no SettingsMenu.

- [ ] **Step 9.1: Inspect existing AppShell test.**

Run: `ls tests/layout/AppShell.test.tsx 2>&1`

If absent, you'll create it.

- [ ] **Step 9.2: Write the new test.**

Create or replace `tests/layout/AppShell.test.tsx`:

```tsx
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { AppShell } from '@/components/layout/AppShell';

describe('AppShell (heading-bar shim)', () => {
  it('renders title and subtitle when both are provided', () => {
    render(
      <AppShell title="Dashboard" subtitle="Today's plan">
        <span data-testid="child">child</span>
      </AppShell>,
    );
    expect(screen.getByText('Dashboard')).toHaveClass('h-display');
    expect(screen.getByText("Today's plan")).toBeTruthy();
    expect(screen.getByTestId('child')).toBeTruthy();
  });

  it('renders title only when subtitle is omitted', () => {
    render(
      <AppShell title="Tracks">
        <span data-testid="child">child</span>
      </AppShell>,
    );
    expect(screen.getByText('Tracks')).toBeTruthy();
    expect(screen.getByTestId('child')).toBeTruthy();
  });

  it('renders children only when neither title nor subtitle is provided', () => {
    const { container } = render(
      <AppShell>
        <span data-testid="child">child</span>
      </AppShell>,
    );
    expect(container.querySelector('header')).toBeNull();
    expect(screen.getByTestId('child')).toBeTruthy();
  });
});
```

- [ ] **Step 9.3: Run — confirm failure.**

Run: `npx vitest run tests/layout/AppShell.test.tsx`
Expected: failures (existing AppShell renders chrome and gates on auth — old test asserts will mismatch).

- [ ] **Step 9.4: Replace `components/layout/AppShell.tsx`.**

```tsx
import { type ReactNode } from 'react';
import { Heading } from '@/components/ui/Heading';

export interface AppShellProps {
  title?: string;
  subtitle?: string;
  children: ReactNode;
}

export function AppShell({ title, subtitle, children }: AppShellProps) {
  return (
    <>
      {(title || subtitle) && (
        <header style={{ marginBottom: 24 }}>
          {title && <Heading level="display">{title}</Heading>}
          {subtitle && (
            <p className="muted" style={{ marginTop: 8, fontSize: 'var(--t-lg)' }}>
              {subtitle}
            </p>
          )}
        </header>
      )}
      {children}
    </>
  );
}
```

- [ ] **Step 9.5: Run — confirm pass.**

Run: `npx vitest run tests/layout/AppShell.test.tsx`
Expected: 3 passed.

- [ ] **Step 9.6: Confirm full suite still green.**

Run: `npm test`
Expected: all passing. (Sidebar/Topbar tests pass on their own; AppShell is now a pure presentation shim with no dependencies on AuthProvider.)

- [ ] **Step 9.7: Commit.**

```bash
git add components/layout/AppShell.tsx tests/layout/AppShell.test.tsx
git commit -m "shell: convert AppShell to a heading-bar shim

The chrome (Sidebar + Topbar) moves to app/(authed)/layout.tsx in the
next phase. AppShell.tsx becomes a small server-renderable component
that just emits the page-level Heading and subtitle, then passes
children through. The 8 calling pages don't need import changes.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Phase 4 — Route group + page moves

### Task 10: Add `app/(authed)/layout.tsx`

**Files:**
- Create: `app/(authed)/layout.tsx`

This layout renders the new chrome and gates on auth. Identical to the redirect logic in the old AppShell.

- [ ] **Step 10.1: Implement.**

Create `app/(authed)/layout.tsx`:

```tsx
'use client';
import { useEffect, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/components/layout/AuthProvider';
import { Sidebar } from '@/components/shell/Sidebar';
import { Topbar } from '@/components/shell/Topbar';

export default function AuthedLayout({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !user) router.replace('/login');
  }, [user, loading, router]);

  if (loading || !user) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="muted">Loading…</p>
      </div>
    );
  }

  return (
    <div className="app">
      <Sidebar />
      <div>
        <Topbar />
        <main className="main">{children}</main>
      </div>
    </div>
  );
}
```

- [ ] **Step 10.2: Build smoke (no pages routed yet, just verify compile).**

Run: `npm run build`
Expected: build succeeds. (The route group with no children won't appear in the routes table yet; that's fine.)

- [ ] **Step 10.3: Commit.**

```bash
git add 'app/(authed)/layout.tsx'
git commit -m "shell: add app/(authed)/layout.tsx with new chrome and auth gate

Renders Sidebar + Topbar inside the .app grid, with auth-redirect
logic identical to the old AppShell's. Pages move into the (authed)
group in subsequent commits.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

### Task 11: Move dashboard page

**Files:**
- Move: `app/dashboard/page.tsx` → `app/(authed)/dashboard/page.tsx`

- [ ] **Step 11.1: Move with git mv (preserves blame).**

Run: `mkdir -p 'app/(authed)/dashboard' && git mv app/dashboard/page.tsx 'app/(authed)/dashboard/page.tsx'`
Expected: file moved; `git status` shows the rename.

- [ ] **Step 11.2: Remove the empty old directory.**

Run: `rmdir app/dashboard 2>/dev/null || true`
(If `rmdir` fails because it isn't empty, surface the contents — there shouldn't be any other files in `app/dashboard/`.)

- [ ] **Step 11.3: Build + smoke.**

Run: `npm run build`
Expected: build succeeds; routes table shows `/dashboard` at the new path. URL is unchanged because `(authed)` is a route group.

- [ ] **Step 11.4: Commit.**

```bash
git add 'app/(authed)/dashboard/page.tsx'
git commit -m "shell: move dashboard into (authed) route group

Page body unchanged. URL stays /dashboard. Dashboard now renders
inside the new chrome from app/(authed)/layout.tsx.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

### Task 12: Move tracks pages

**Files:**
- Move: `app/tracks/page.tsx` → `app/(authed)/tracks/page.tsx`
- Move: `app/tracks/[id]/page.tsx` → `app/(authed)/tracks/[id]/page.tsx`

- [ ] **Step 12.1: Move both files.**

Run:
```bash
mkdir -p 'app/(authed)/tracks/[id]'
git mv app/tracks/page.tsx 'app/(authed)/tracks/page.tsx'
git mv 'app/tracks/[id]/page.tsx' 'app/(authed)/tracks/[id]/page.tsx'
rmdir 'app/tracks/[id]' 2>/dev/null || true
rmdir app/tracks 2>/dev/null || true
```

- [ ] **Step 12.2: Build + commit.**

Run: `npm run build`
Expected: build succeeds; `/tracks` and `/tracks/[id]` listed.

```bash
git add 'app/(authed)/tracks'
git commit -m "shell: move tracks pages into (authed) route group

Page bodies unchanged. URLs stay /tracks and /tracks/[id].

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

### Task 13: Move lesson page

**Files:**
- Move: `app/lesson/[id]/page.tsx` → `app/(authed)/lesson/[id]/page.tsx`

- [ ] **Step 13.1: Move.**

Run:
```bash
mkdir -p 'app/(authed)/lesson/[id]'
git mv 'app/lesson/[id]/page.tsx' 'app/(authed)/lesson/[id]/page.tsx'
rmdir 'app/lesson/[id]' 2>/dev/null || true
rmdir app/lesson 2>/dev/null || true
```

- [ ] **Step 13.2: Build + commit.**

Run: `npm run build`
Expected: build succeeds; `/lesson/[id]` listed.

```bash
git add 'app/(authed)/lesson'
git commit -m "shell: move lesson page into (authed) route group

Page body unchanged. URL stays /lesson/[id].

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

### Task 14: Move badges page

- [ ] **Step 14.1: Move.**

Run:
```bash
mkdir -p 'app/(authed)/badges'
git mv app/badges/page.tsx 'app/(authed)/badges/page.tsx'
rmdir app/badges 2>/dev/null || true
```

- [ ] **Step 14.2: Build + commit.**

Run: `npm run build`

```bash
git add 'app/(authed)/badges'
git commit -m "shell: move badges page into (authed) route group

Page body unchanged. URL stays /badges.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

### Task 15: Move review page

- [ ] **Step 15.1: Move.**

Run:
```bash
mkdir -p 'app/(authed)/review'
git mv app/review/page.tsx 'app/(authed)/review/page.tsx'
rmdir app/review 2>/dev/null || true
```

- [ ] **Step 15.2: Build + commit.**

Run: `npm run build`

```bash
git add 'app/(authed)/review'
git commit -m "shell: move review page into (authed) route group

Page body unchanged. URL stays /review.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

### Task 16: Move instructor pages

**Files:**
- Move: `app/instructor/page.tsx` → `app/(authed)/instructor/page.tsx`
- Move: `app/instructor/review/[attemptId]/page.tsx` → `app/(authed)/instructor/review/[attemptId]/page.tsx`

- [ ] **Step 16.1: Move both files.**

Run:
```bash
mkdir -p 'app/(authed)/instructor/review/[attemptId]'
git mv app/instructor/page.tsx 'app/(authed)/instructor/page.tsx'
git mv 'app/instructor/review/[attemptId]/page.tsx' 'app/(authed)/instructor/review/[attemptId]/page.tsx'
rmdir 'app/instructor/review/[attemptId]' 2>/dev/null || true
rmdir 'app/instructor/review' 2>/dev/null || true
rmdir app/instructor 2>/dev/null || true
```

- [ ] **Step 16.2: Build + commit.**

Run: `npm run build`
Expected: build succeeds; `/instructor` and `/instructor/review/[attemptId]` listed.

```bash
git add 'app/(authed)/instructor'
git commit -m "shell: move instructor pages into (authed) route group

Page bodies unchanged. URLs stay /instructor and
/instructor/review/[attemptId].

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Phase 5 — End-to-end verification

### Task 17: Playwright e2e

**Files:**
- Create: `tests/e2e/app-shell.spec.ts`

Smoke test exercising the new chrome + auth redirect + a tweaks-driven attribute change.

- [ ] **Step 17.1: Write the spec.**

```ts
import { test, expect } from '@playwright/test';

test.describe('app shell', () => {
  test('unauthenticated user is redirected from /dashboard to /login', async ({ page, context }) => {
    // Drop the storage state so we look unauthenticated.
    await context.clearCookies();
    await page.goto('/dashboard');
    await expect(page).toHaveURL(/\/login/);
  });

  test('authenticated student sees the new chrome on /dashboard', async ({ page }) => {
    await page.goto('/dashboard');
    await expect(page.getByRole('link', { name: /dashboard/i }).first()).toBeVisible();
    await expect(page.getByRole('link', { name: /skill tree/i }).first()).toBeVisible();
    await expect(page.getByRole('link', { name: /design system/i }).first()).toBeVisible();
    // Disabled search is rendered.
    const search = page.getByPlaceholder(/search lessons coming soon/i);
    await expect(search).toBeVisible();
    await expect(search).toBeDisabled();
  });

  test('user pill toggles SettingsMenu and density chip flips data-density', async ({ page }) => {
    await page.goto('/dashboard');
    // Open the user pill popover.
    await page.getByRole('button', { name: /open settings/i }).click();
    // Click density "compact".
    await page.getByRole('button', { name: 'compact' }).click();
    await expect(page.locator('html')).toHaveAttribute('data-density', 'compact');
    // Restore.
    await page.getByRole('button', { name: 'comfortable' }).click();
    await expect(page.locator('html')).toHaveAttribute('data-density', 'comfortable');
  });
});
```

- [ ] **Step 17.2: Try to run.**

Run: `npx playwright test app-shell.spec.ts --reporter=list`
Expected best case: 3 passed. Expected likely: needs the platform NestJS server at :3000 (the playwright global-setup expects auth storage state). If the test runner errors before reaching the spec because the platform isn't reachable, capture the error and report `DONE_WITH_CONCERNS` — the spec itself is correct, just can't be exercised in this isolated worktree.

- [ ] **Step 17.3: Commit.**

```bash
git add tests/e2e/app-shell.spec.ts
git commit -m "shell: add Playwright smoke for the new chrome

Verifies unauthenticated → /login redirect, authenticated /dashboard
renders the new sidebar + disabled search, and the user pill's
SettingsMenu density toggle flips <html data-density>.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

### Task 18: Final verification

- [ ] **Step 18.1: Lint.**

Run: `npm run lint`
Expected: clean.

- [ ] **Step 18.2: Unit tests.**

Run: `npm test`
Expected: all passing. New tests (~191 prior + ~5 SidebarNavItem + 3 ReviewQueueBadge + 4 ContinueLessonButton + 2 ActiveTrackPill + 3 Topbar + 4 SettingsMenu (replaced) + 2 SidebarUserPill + 5 Sidebar + 3 AppShell ≈ ~218). Slight variance acceptable.

- [ ] **Step 18.3: Build.**

Run: `npm run build`
Expected: succeeds. Routes table lists `/dashboard`, `/tracks`, `/tracks/[id]`, `/lesson/[id]`, `/badges`, `/review`, `/instructor`, `/instructor/review/[attemptId]`, plus public routes (`/`, `/login`, `/register`, `/design-system`, `/_not-found`).

- [ ] **Step 18.4: Manual back-compat smoke.**

Start dev: `npm run dev`. In a browser:

- [ ] Visit `http://localhost:3001/dashboard` while authenticated — new sidebar + topbar + page body unchanged.
- [ ] Visit `/tracks`, `/tracks/[some-id]`, `/lesson/[some-id]`, `/badges`, `/review` — same.
- [ ] Visit `/instructor` (only as instructor user) — same; sidebar shows the Instructor entry.
- [ ] Click sidebar items — pathname-based active state highlights the right entry.
- [ ] Click sidebar's "Continue lesson" — lands on `/tracks` with that link's active state preserved when revisiting via a `/lesson/...` URL.
- [ ] Click the user pill at sidebar bottom — SettingsMenu popover opens. Toggle theme dark↔light and density comfortable↔compact; both persist after reload.
- [ ] Sign out from SettingsMenu — redirects to `/login`. Visiting `/dashboard` unauthenticated redirects back to `/login`.
- [ ] Public routes (`/login`, `/register`, `/design-system`, `/`) — no chrome (rendered outside the route group).
- [ ] Existing in-page UI on every authenticated page is visually unchanged.

- [ ] **Step 18.5: Stop dev.** No further commits expected — the implementation should be done.

---

## Self-review summary

**Spec coverage check:**

| Spec section | Implemented in |
|---|---|
| D1. Hybrid layout pattern | Task 9 (shim) + Task 10 (route layout) |
| D2. Sidebar nav (labels from design, hrefs to existing pages) | Task 8 |
| D3. User pill at sidebar bottom | Task 7 |
| D4. Topbar (disabled search + segmented + live streak/XP) | Task 5 |
| D5. SettingsMenu rebuild (primitives + density) | Task 6 |
| D6. Auth-gating in route layout | Task 10 |
| D7. AppShell shim API | Task 9 |
| File structure (`components/shell/` + `app/(authed)/`) | All of Phase 1, 2, 4 |
| Continue Lesson static `/tracks` + Day-N badge | Task 3 |
| ReviewQueueBadge | Task 2 |
| Instructor conditional rendering | Task 8 (5th sub-test) |
| Active-state derivation from `usePathname()` | Task 8 |
| Page moves with `git mv` | Tasks 11–16 |
| Playwright smoke | Task 17 |
| Lint + test + build green at end | Task 18 |

No spec gaps. No placeholders. Type names consistent across tasks (`ButtonVariant`, `BadgeTone`, `IconName`, `useAuth()`, `useTweaks()`, `SidebarNavItem`, etc. used identically wherever they appear).
