# App Shell

## Purpose

Provide the chrome (Sidebar + Topbar) that wraps every authenticated page in `web/`, plus the auth-gating that redirects unauthenticated users to `/login`. Sub-project B of the UI refactor; consumes the primitives library shipped by Sub-project A (UI Foundation).

## Owns

- `web/app/(authed)/layout.tsx` — Next.js route group layout. Renders Sidebar + Topbar inside the `.app` grid; performs the auth-gate redirect; otherwise passes children through.
- `web/components/shell/` — composed chrome components built from `components/ui/` primitives:
  - `Sidebar.tsx` — top-level sidebar that composes everything below
  - `SidebarNavItem.tsx` — single row primitive (anchor or button variant; emits `.side-link` and optional `.active`)
  - `ContinueLessonButton.tsx` — sidebar row pointing at `/tracks` with optional "Day {streak}" badge
  - `ReviewQueueBadge.tsx` — lazy badge sourced from `fetchReviewQueue()`
  - `ActiveTrackPill.tsx` — top-of-sidebar Swift/Kotlin badge + XP block (stub; see carry-overs below)
  - `Topbar.tsx` — disabled search + disabled SegmentedControl + live streak/XP from `useAuth()`
  - `SidebarUserPill.tsx` — bottom-of-sidebar avatar + name + email; toggles `SettingsMenu` popover
- `web/components/layout/SettingsMenu.tsx` — rebuilt with primitives; routes through `useTweaks` (theme + density); accepts optional `anchored`/`onClose` props for SidebarUserPill consumption.
- `web/components/layout/AppShell.tsx` — reduced to a per-page heading-bar shim. Renders `<Heading level="display">` for `title` and a muted `<p>` for `subtitle`, then passes children through. The 8 calling pages keep their existing `<AppShell title="..." subtitle="...">` API.

## Pages owned by `(authed)` route group

URLs are unchanged (the `(authed)` segment is invisible per Next.js route-group syntax):

- `/dashboard` — `app/(authed)/dashboard/page.tsx`
- `/tracks`, `/tracks/[id]` — `app/(authed)/tracks/`
- `/lesson/[id]` — `app/(authed)/lesson/[id]/page.tsx`
- `/badges` — `app/(authed)/badges/page.tsx`
- `/review` — `app/(authed)/review/page.tsx`
- `/instructor`, `/instructor/review/[attemptId]` — `app/(authed)/instructor/`

Public pages outside the route group: `/`, `/login`, `/register`, `/design-system`.

## Key Interfaces

- **Sidebar nav contract:** label and href per row. Active state derived from `usePathname()`. Conditional Instructor entry rendered when `useAuth().user.role === 'instructor' || 'admin'`.
- **Topbar:** consumes `useAuth().streak` + `useAuth().totalPoints`. Search and SegmentedControl are visually present but disabled (no backend / no track-context yet).
- **SettingsMenu trigger:** the `SidebarUserPill` is the only trigger today. The component supports being mounted standalone (no `anchored` prop) for tests/showcase.
- **Auth gate:** `(authed)/layout.tsx` calls `useAuth()`, redirects to `/login` if `!user && !loading`, renders a "Loading…" placeholder while `loading`. AuthProvider stays at `app/layout.tsx` (root) so login/register can call `useAuth()` for sign-in.

## Dependencies

- `@/components/ui` (primitives library — Sub-project A)
- `@/lib/theme` + `@/lib/tweaks` (theme/density mechanism — Sub-project A)
- `@/components/layout/AuthProvider` (unchanged)
- `@/lib/review` (`fetchReviewQueue` for the Review badge)
- Next.js `usePathname`, `useRouter`, route groups

## Conventions

- **`components/shell/` is for composed chrome.** Anything in there may consume `@/components/ui` primitives and may know about `AuthProvider`/`useTweaks`. It must not contain raw Tailwind utility soup.
- **Adding a sidebar entry** = one new `<SidebarNavItem ... />` line in `Sidebar.tsx`, plus an optional badge component if needed.
- **Page-body refactors (Sub-projects C–H)** consume the chrome implicitly via the route group. Each page-refactor PR may also replace its `<AppShell title>` shim usage with direct `<Heading level="display">` calls; the shim file itself is deleted in the final cleanup PR after Sub-project H.

## Carry-overs into Sub-projects C–H

- **`TrackContext` lifting.** Topbar's SegmentedControl and Sidebar's ActiveTrackPill are visual stubs — they render but aren't wired to global state. First page-refactor that needs the active track introduces a `TrackContext` and the two components consume it. Inline TODO comments in `Topbar.tsx` and `ActiveTrackPill.tsx` point at this.
- **Dynamic Continue Lesson.** Currently routes to `/tracks`. A future sub-project can replace it with a dynamic resolver — fetch most-recent attempt, navigate straight to that `/lesson/[id]`. Needs a small backend endpoint (`GET /api/progress/last-attempt`).
- **Hearts mechanic** — Sub-project E (Lesson Player) introduces hearts in the lesson player; the Topbar deliberately doesn't render them as a global indicator.
- **Profile + Leaderboard routes** — Sub-project F creates standalone `/profile` and `/leaderboard` if needed. Sidebar's "Profile" → `/badges` and "Leaderboard" → `/dashboard#leaderboard` are stand-ins until then.
- **`CohortBadge.tsx` and `RevisitIcon.tsx`** — out of scope for B. CohortBadge is unused in any page and can be deleted in any cleanup pass. RevisitIcon is consumed by `LessonNavigation` (a per-lesson concern) and stays where it is until Sub-project E refactors the lesson player.
