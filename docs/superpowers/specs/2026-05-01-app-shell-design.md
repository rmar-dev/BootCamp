# App Shell Migration — Sidebar, Topbar, SettingsMenu, Route-Group Layout

**Date:** 2026-05-01
**Sub-project:** B (of N — UI refactor)
**Status:** Approved (brainstorming)
**Builds on:** Sub-project A (UI Foundation), merged 2026-05-01 at web `master` `806fed0`.
**Source design bundle:** `c:/tmp/design-bootcamp/bootcamp/project/` — `app-shell.jsx`, `app.css`.

## Context

Sub-project A shipped the primitives library at `web/components/ui/` plus the design tokens, theme/density mechanism, and `/design-system` showcase. Existing pages were left untouched and continue to wrap themselves in `components/layout/AppShell.tsx`, which renders the legacy header bar with Tailwind classes.

This sub-project replaces the visual chrome — sidebar, topbar — with the design's intended shell built from the new primitives. Pages are not refactored in this PR (their bodies stay identical); only the wrapper changes. Subsequent sub-projects (C–H) refactor each page in turn.

## Goal

Replace `AppShell.tsx`'s chrome with a Sidebar + Topbar built from primitives, by moving auth-gated pages into a Next.js route group `(authed)` with its own layout. Update `SettingsMenu` to consume `useTweaks` and add a Density toggle. Ship without changing any page body.

## Decisions

### D1. Layout integration pattern — Hybrid (route group + shim)

Add `app/(authed)/layout.tsx` that renders the new chrome (Sidebar + Topbar) once at the route-group root. Move the 8 auth-gated pages into `(authed)/`. Keep `components/layout/AppShell.tsx` as a thin per-page heading bar (title + subtitle, no chrome) so the 8 calling pages don't need import changes.

**Why:** The chrome shouldn't re-render on intra-group navigation (perf + smoothness match the design's intent of a persistent sidebar). The per-page heading is a separate concern from the chrome and stays inside each page body via the shim.

### D2. Sidebar nav — labels from design, hrefs to existing pages

Match the design's labels for visual fidelity; route to existing pages where the design's target doesn't exist yet. Drop entries with no underlying feature.

**Main:**

| Label | Icon | Target | Active state | Notes |
|---|---|---|---|---|
| Dashboard | home | `/dashboard` | `pathname === '/dashboard'` | direct |
| Skill tree | tree | `/tracks` | `pathname.startsWith('/tracks')` | label from design, hits current tracks list |
| Continue lesson | play | `/tracks` | `pathname.startsWith('/lesson/')` | static link to `/tracks` for now (the tracks list already exposes per-track Continue buttons that resolve the actual lesson). Active state highlights when the user is inside any lesson page so the sidebar reflects "I'm continuing a lesson". Badge shows `Day {streak}` when streak > 0, sourced from `useAuth().streak`. Future polish: replace with a dynamic resolver that fetches the most-recent attempt and navigates straight to that `/lesson/[id]` — out of scope for B. |
| Profile | user | `/badges` | `pathname === '/badges'` | label from design, lands on existing badges page until sub-project F builds `/profile` |
| Leaderboard | trophy | `/dashboard#leaderboard` | never (always navigates to dashboard with anchor) | per design's nav, anchors into the dashboard's leaderboard table |

**More:**

| Label | Icon | Target | Notes |
|---|---|---|---|
| Review | refresh | `/review` | SRS queue. Optional badge with queue size when > 0; sourced lazily on shell mount via `fetchReviewQueue().queue.length` (same call dashboard uses) |
| Instructor | trophy | `/instructor` | rendered only when `user.role === 'instructor' \|\| 'admin'` |
| Design system ↗ | grid | `/design-system` | matches design's existing link |
| Settings | settings | `(opens SettingsMenu popover)` | trigger lives in the user pill at sidebar bottom (D3); the "Settings" link in More is a duplicate trigger |

Drop "Saved" — no underlying feature exists.

### D3. User pill (sidebar bottom)

Matches the design's pattern: avatar (`useAuth().user.name.charAt(0)`) + name + email. Clicking the pill opens the `SettingsMenu` popover anchored to it. Sign-out, theme, density, role badge all live in the popover.

### D4. Topbar — disabled controls preserve visual fidelity

| Element | State | Wiring |
|---|---|---|
| Search input + ⌘K hint | Visible, **disabled** | Renders the design's `SearchInput` with placeholder "Search lessons coming soon", `disabled` on the input, and the `⌘K` `<kbd>`. No fake functionality. |
| Swift/Kotlin SegmentedControl | Visible, **disabled** | Renders both options; clicks are no-ops. Reason: no global "active track" state exists; lifting that to a shared context belongs in sub-project C/D, not here. Annotated with TODO referencing the future track-context work. |
| Streak | **Live** | `flame` icon + `useAuth().streak` |
| XP | **Live** | `bolt` icon + `useAuth().totalPoints.toLocaleString()` |
| Hearts row | **Hidden** | Hearts are a lesson-player gameplay mechanic, not a global indicator. Sub-project E renders them in the lesson player. |
| Settings icon button | **Hidden** | Settings opens from the sidebar's user pill (D3). One trigger, no duplication. |

### D5. SettingsMenu rebuild

Stays at `web/components/layout/SettingsMenu.tsx`. Internals rebuilt with primitives (`Card`, `Stack`, `Row`, `Avatar`, `Badge`, `Eyebrow`, `Chip`, `Button`); Tailwind utility classes for color/typography removed inside this component. Two functional changes:

- Routes theme picker through `useTweaks().setTheme` instead of calling `applyTheme` directly (identical behavior; removes the direct import of `applyTheme`).
- Adds a **Density** section below **Appearance** — 2-chip toggle (`Comfortable` / `Compact`) wired to `useTweaks().setDensity`.

The popover trigger is now the user pill at sidebar bottom, not a standalone topbar button.

### D6. Auth-gating

`app/(authed)/layout.tsx` performs the auth check identical to the current AppShell:

```ts
const { user, loading } = useAuth();
const router = useRouter();
useEffect(() => {
  if (!loading && !user) router.replace('/login');
}, [user, loading, router]);
if (loading || !user) return <LoadingPlaceholder />;
```

`LoadingPlaceholder` is the same minimal centered "Loading..." block AppShell currently renders.

`AuthProvider` stays at `app/layout.tsx` (root) — it must wrap login/register too so those pages can use `useAuth()` for sign-in flows. No change to AuthProvider.

Pages outside `(authed)/`:

- `app/login/`, `app/register/` — public.
- `app/design-system/` — public (proof-of-life route from sub-project A).
- `app/page.tsx` — root; existing behavior preserved.

### D7. AppShell shim API

Stays at `components/layout/AppShell.tsx`. Becomes a per-page heading bar:

```tsx
export function AppShell({ title, subtitle, children }: {
  title?: string;
  subtitle?: string;
  children: ReactNode;
}) {
  return (
    <>
      {(title || subtitle) && (
        <header style={{ marginBottom: 24 }}>
          {title && <Heading level="display">{title}</Heading>}
          {subtitle && <p className="muted" style={{ marginTop: 8 }}>{subtitle}</p>}
        </header>
      )}
      {children}
    </>
  );
}
```

No `'use client'` (it has no client behavior). No auth check (moved to route layout). No imports from `AuthProvider` or `SettingsMenu`. The 8 calling pages keep using `<AppShell title="X" subtitle="Y">{children}</AppShell>` unchanged. Sub-projects C–H may replace AppShell with direct `<Heading>` calls page-by-page; the shim file itself is deleted in the final cleanup PR.

## File structure

```
web/
├── app/
│   ├── (authed)/                                         # NEW route group
│   │   ├── layout.tsx                                 # NEW — chrome + auth-gating
│   │   ├── dashboard/page.tsx                         # MOVED from app/dashboard/
│   │   ├── tracks/
│   │   │   ├── page.tsx                               # MOVED
│   │   │   └── [id]/page.tsx                          # MOVED
│   │   ├── lesson/[id]/page.tsx                       # MOVED
│   │   ├── badges/page.tsx                            # MOVED
│   │   ├── review/page.tsx                            # MOVED
│   │   └── instructor/
│   │       ├── page.tsx                               # MOVED
│   │       └── review/[attemptId]/page.tsx            # MOVED
│   ├── login/                                         # unchanged (outside group)
│   ├── register/                                      # unchanged (outside group)
│   ├── design-system/                                 # unchanged (outside group)
│   ├── layout.tsx                                     # unchanged (root, has AuthProvider)
│   └── page.tsx                                       # unchanged
├── components/
│   ├── layout/
│   │   ├── AppShell.tsx                               # MODIFIED — shim only
│   │   ├── AppShell.test.tsx                          # MODIFIED — shim tests
│   │   ├── AuthProvider.tsx                           # UNCHANGED
│   │   ├── SettingsMenu.tsx                           # MODIFIED — uses useTweaks + density
│   │   ├── SettingsMenu.test.tsx                      # MODIFIED to match
│   │   ├── RevisitIcon.tsx                            # UNCHANGED (consumed by LessonNavigation)
│   │   └── CohortBadge.tsx                            # UNCHANGED (unused; defer cleanup)
│   └── shell/                                         # NEW — Sub-project B's chrome components
│       ├── Sidebar.tsx                                # NEW
│       ├── Topbar.tsx                                 # NEW
│       ├── SidebarNavItem.tsx                         # NEW — single nav row primitive
│       ├── SidebarUserPill.tsx                        # NEW — bottom pill, opens SettingsMenu
│       └── ContinueLessonButton.tsx                   # NEW — dynamic-target nav row
└── tests/
    ├── shell/
    │   ├── Sidebar.test.tsx                           # NEW
    │   ├── Topbar.test.tsx                            # NEW
    │   ├── SidebarNavItem.test.tsx                    # NEW
    │   ├── SidebarUserPill.test.tsx                   # NEW
    │   └── ContinueLessonButton.test.tsx              # NEW
    └── e2e/
        └── app-shell.spec.ts                          # NEW — chrome + auth redirect smoke
```

`components/shell/` is new and distinct from `components/layout/`. Convention: `shell/` contains composed chrome built from `components/ui/` primitives plus AuthProvider/Settings glue; `layout/` contains existing pre-Foundation layout pieces that get migrated piecemeal.

## Component design

### `Sidebar`

```tsx
'use client';
export function Sidebar() {
  const { user } = useAuth();
  const pathname = usePathname();
  return (
    <aside className="side">
      <Logo size="sm" />
      <ActiveTrackPill />          {/* small badge — Swift / Kotlin (visual stub for now, mirrors design's "Active track" block) */}
      <SidebarNavItem icon="home" label="Dashboard" href="/dashboard" active={pathname === '/dashboard'} />
      <SidebarNavItem icon="tree" label="Skill tree" href="/tracks" active={pathname.startsWith('/tracks')} />
      <ContinueLessonButton active={pathname.startsWith('/lesson/')} />
      <SidebarNavItem icon="user" label="Profile" href="/badges" active={pathname === '/badges'} />
      <SidebarNavItem icon="trophy" label="Leaderboard" href="/dashboard#leaderboard" active={false} />
      <div className="side-section">More</div>
      <SidebarNavItem icon="refresh" label="Review" href="/review" active={pathname === '/review'} badge={<ReviewQueueBadge />} />
      {(user?.role === 'instructor' || user?.role === 'admin') && (
        <SidebarNavItem icon="trophy" label="Instructor" href="/instructor" active={pathname.startsWith('/instructor')} />
      )}
      <SidebarNavItem icon="grid" label="Design system ↗" href="/design-system" active={pathname === '/design-system'} />
      <SidebarUserPill />
    </aside>
  );
}
```

`Sidebar` consumes the `.side`, `.side-link`, `.side-section`, `.side-icon` classes already shipped in `components.css` from Sub-project A. No new CSS.

### `SidebarNavItem`

Pure presentation. Wraps a Next.js `<Link>` (or `<button>` if `onClick` is passed for the dynamic Continue Lesson case). Adds `.side-link.active` class when `active` is true. Renders icon + label + optional badge slot.

### `ContinueLessonButton`

Renders a `SidebarNavItem` whose `href` is a static `/tracks`. The component is its own file (rather than a plain `SidebarNavItem` call) so it can own the streak-driven `Day {N}` badge logic and so the dynamic-resolver follow-up has a clear home to land in later. Active when `pathname.startsWith('/lesson/')`. Badge: when `useAuth().streak > 0`, renders `<Badge tone="brand">Day {streak}</Badge>`; otherwise no badge.

No backend changes in this sub-project. The dynamic-resolution polish (fetch most-recent attempt → navigate to that `/lesson/[id]`) is a follow-up that any later sub-project can pick up without modifying B's call sites.

### `ReviewQueueBadge`

Lazy-fetches `/api/review/queue` on shell mount via `fetchReviewQueue()`. Renders a `<Badge tone="brand">{count}</Badge>` when count > 0, nothing when zero. Failure to fetch silently renders nothing (matches existing dashboard widget behavior).

### `Topbar`

```tsx
'use client';
export function Topbar() {
  const { totalPoints, streak } = useAuth();
  return (
    <div className="topbar">
      <SearchInput placeholder="Search lessons coming soon" disabled style={{ flex: 1, maxWidth: 480 }} />
      <SegmentedControl
        value="swift"
        onChange={() => {}}              {/* disabled — no global track state yet */}
        options={[
          { value: 'swift', label: 'Swift', activeClassName: 'swift' },
          { value: 'kotlin', label: 'Kotlin', activeClassName: 'kotlin' },
        ]}
        aria-disabled
      />
      <Row gap={14} style={{ marginLeft: 'auto' }}>
        <Row gap={6}><Icon name="flame" size={16} style={{ color: 'var(--amber-400)' }} /><span className="mono" style={{ fontWeight: 700 }}>{streak}</span></Row>
        <Row gap={6}><Icon name="bolt" size={16} style={{ color: 'var(--peacock-300)' }} /><span className="mono" style={{ fontWeight: 700 }}>{totalPoints.toLocaleString()}</span></Row>
      </Row>
    </div>
  );
}
```

The disabled SegmentedControl gets a TODO comment referencing sub-project C/D (Dashboard/Tracks track-context work).

### `SidebarUserPill`

```tsx
'use client';
export function SidebarUserPill() {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  if (!user) return null;
  return (
    <div style={{ marginTop: 'auto', position: 'relative' }}>
      <button onClick={() => setOpen(o => !o)} className="row" style={{ width: '100%', padding: 12, borderRadius: 'var(--r-md)', background: 'var(--bg-2)', border: '1px solid var(--line-1)' }}>
        <Avatar size="sm" initials={user.name.charAt(0).toUpperCase()} />
        <div style={{ minWidth: 0, textAlign: 'left' }}>
          <div style={{ fontSize: 'var(--t-sm)', fontWeight: 600 }}>{user.name}</div>
          <div className="mono muted" style={{ fontSize: 'var(--t-2xs)' }}>{user.email}</div>
        </div>
      </button>
      {open && <SettingsMenu anchored onClose={() => setOpen(false)} />}
    </div>
  );
}
```

The popover positioning logic is local to `SidebarUserPill` — `SettingsMenu` accepts `anchored` and `onClose` props but doesn't have to know its own position relative to the trigger.

### `SettingsMenu` (rebuild)

Top-level structure becomes:

```tsx
'use client';
export function SettingsMenu({ anchored, onClose }: { anchored?: boolean; onClose?: () => void }) {
  const { user, logout } = useAuth();
  const { theme, density, setTheme, setDensity } = useTweaks();
  const router = useRouter();
  // ... outside-click + Esc handling ...
  return (
    <Card className="..." role="dialog" aria-label="Settings" style={anchored ? popoverStyle : undefined}>
      <Stack gap="default">
        <section>
          <Eyebrow>Appearance</Eyebrow>
          <Row gap={6} style={{ marginTop: 8 }}>
            {(['system', 'light', 'dark'] as const).map(m => (
              <Chip key={m} active={theme === m} onClick={() => setTheme(m)}>{m}</Chip>
            ))}
          </Row>
        </section>
        <section>
          <Eyebrow>Density</Eyebrow>
          <Row gap={6} style={{ marginTop: 8 }}>
            {(['comfortable', 'compact'] as const).map(d => (
              <Chip key={d} active={density === d} onClick={() => setDensity(d)}>{d}</Chip>
            ))}
          </Row>
        </section>
        <Divider />
        <section>
          <Eyebrow>Account</Eyebrow>
          {user ? (
            <Row gap={12}>
              <Avatar initials={user.name.charAt(0).toUpperCase()} />
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 'var(--t-sm)', fontWeight: 600 }}>{user.name}</div>
                <div className="muted" style={{ fontSize: 'var(--t-xs)' }}>{user.email}</div>
              </div>
              <Badge tone={user.role === 'admin' ? 'iris' : user.role === 'instructor' ? 'amber' : 'brand'}>{user.role}</Badge>
            </Row>
          ) : null}
          {user && (
            <Button variant="outline" onClick={async () => { await logout(); onClose?.(); router.push('/login'); }} style={{ marginTop: 12, width: '100%' }}>
              Sign out
            </Button>
          )}
        </section>
      </Stack>
    </Card>
  );
}
```

Tailwind classes for color/typography removed; layout utilities and one-offs remain. Outside-click and Esc handling preserved from current implementation.

## `(authed)/layout.tsx`

```tsx
'use client';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/components/layout/AuthProvider';
import { Sidebar } from '@/components/shell/Sidebar';
import { Topbar } from '@/components/shell/Topbar';

export default function AuthedLayout({ children }: { children: React.ReactNode }) {
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

Uses the `.app`, `.main` classes from `components.css` (already shipped in Sub-project A) for the grid layout.

## Testing

### Unit tests (Vitest)

| File | Coverage |
|---|---|
| `tests/shell/SidebarNavItem.test.tsx` | renders icon + label + optional badge; emits `.side-link.active` when active; clicks trigger href navigation or onClick |
| `tests/shell/Sidebar.test.tsx` | renders all main nav items; conditionally renders Instructor based on user role (mock useAuth); renders user pill |
| `tests/shell/Topbar.test.tsx` | renders search/segmented control as disabled; renders streak + XP from useAuth mock |
| `tests/shell/SidebarUserPill.test.tsx` | renders user info from useAuth; opens popover on click; closes on Esc / outside click |
| `tests/shell/ContinueLessonButton.test.tsx` | clicks fetch the last attempt and navigate; falls back to `/tracks` on error; renders Day-N badge from streak |
| `tests/layout/SettingsMenu.test.tsx` | (modified) — chip toggles drive `useTweaks().setTheme` / `setDensity`; sign-out calls AuthProvider.logout + router.push('/login'); rendered Account section shows user info |
| `tests/layout/AppShell.test.tsx` | (modified) — renders title and subtitle when provided; renders nothing extra when neither provided; passes children through |

Each test mocks `@/components/layout/AuthProvider` and `@/lib/tweaks` minimally — no full integration coverage at this layer.

### Playwright e2e (`tests/e2e/app-shell.spec.ts`)

- Visit `/dashboard` while authenticated → Sidebar + Topbar render, page heading uses `<Heading level="display">`.
- Visit `/dashboard` while unauthenticated → redirects to `/login`.
- Visit `/login` while unauthenticated → renders without sidebar/topbar (public layout).
- Click sidebar's "Skill tree" → URL changes to `/tracks`, sidebar's "Skill tree" item gets `.active` class.
- Open user pill popover → SettingsMenu visible, click density "compact" → `<html data-density>` becomes `compact`.

### Manual checklist (PR description)

- [ ] `npm run dev` — visit each migrated page (`/dashboard`, `/tracks`, `/tracks/[id]`, `/lesson/[id]`, `/badges`, `/review`, `/instructor`, `/instructor/review/[id]`); all render with the new chrome and unchanged page bodies.
- [ ] Visit `/login`, `/register`, `/design-system`, `/` — no chrome (public layout). Visuals identical to before.
- [ ] Clicking sidebar items navigates as expected; active state highlights match `pathname`.
- [ ] User pill at sidebar bottom opens SettingsMenu; theme + density chips persist across reload.
- [ ] Disabled topbar search and track switcher are visible but un-interactable.
- [ ] Streak + XP read-out match `/api/dashboard/me` and `/api/progress/me`.
- [ ] `npm run build`, `npm run lint`, `npm test`, `npm run test:e2e` — all green.

## Migration order (within this PR)

1. Build new `Sidebar`, `Topbar`, helper components in `components/shell/` with TDD coverage.
2. Rewrite `SettingsMenu.tsx` to consume `useTweaks` and add the Density section. Keep its public API (no props change) so other components don't break.
3. Add `app/(authed)/layout.tsx` with chrome + auth-gating.
4. Move 8 page files into `app/(authed)/`. Each move is one commit; nothing else changes.
5. Strip chrome from `AppShell.tsx`; convert it to the heading-bar shim. Update `AppShell.test.tsx`.
6. End-to-end verification (lint, test, build, e2e, manual).

## Out of scope

- Refactor of any existing page body (still in sub-projects C–H).
- `/profile` and `/leaderboard` standalone routes (Sub-project F).
- Live search backend (deferred — no sub-project assigned yet).
- Track-context lifting (Sub-project C or D when needed).
- Hearts mechanic (Sub-project E, lesson player).
- `CohortBadge.tsx` cleanup (it's unused; can be deleted in any future sub-project alongside its test).
- Removal of `darkMode: 'class'` Tailwind setting and `dark:` class fallbacks (final cleanup PR after Sub-project H).

## Risks

- **Page-move git history fragmentation.** Moving 8 files into `(authed)/` is best done with `git mv` so file history follows. Plan must use `git mv` per move to preserve blame.
- **`useAuth()` being called inside `Sidebar`/`Topbar`/etc. before `AuthProvider` mounts is a non-issue** because AuthProvider sits at the root layout, which is above the route-group layout. By the time `(authed)/layout.tsx` runs, AuthProvider's context is established.
- **Active-state false positives.** "Profile" routes to `/badges`, so when the user is genuinely on `/badges`, "Profile" highlights as active. That matches the user's mental model under decision D2 (the design's labels mask the underlying URL). Reviewer should sanity-check this is OK.
- **Hidden topbar Settings.** The current AppShell exposes a Settings button in the topbar; this PR removes it (only sidebar user pill triggers SettingsMenu). Power users who muscle-memory clicked the topbar will re-learn — acceptable since the new shell repositions the trigger consistently with the design.

## Follow-ups (not blocking B)

- Sub-project C — Dashboard refactor (likely lifts the track-context that this PR's disabled SegmentedControl waits on).
- Sub-project D — Tracks / Skill Tree refactor.
- Replace the `AppShell` shim with direct `<Heading level="display">` calls page-by-page during sub-projects C–H.
- Delete `AppShell.tsx` + `CohortBadge.tsx` + `cohort-badge.test.tsx` in the final cleanup PR.
- Make `ContinueLessonButton` dynamic — fetch user's most-recent attempt, navigate straight to `/lesson/[id]`. Needs a small backend endpoint (`GET /api/progress/last-attempt`) and a `lib/progress.ts` helper. Lands in any sub-project that touches lesson navigation.
