# Tracks / Skill Tree Refactor — Procedural Sections, Section-Level Locks, Active-Track Tree

**Date:** 2026-05-03
**Sub-project:** D (of 8 — UI refactor)
**Status:** Approved (brainstorming)
**Builds on:** Sub-project A (UI Foundation) merged 2026-05-01 at web `master` `806fed0`; Sub-project B (App Shell) merged 2026-05-01 at web `master` `c4b4483`; Sub-project C (Dashboard) merged 2026-05-02 at web `master` `879211c` and platform `master` `a376a48`.
**Source design bundle:** `docs/superpowers/design/` — `app-tree.jsx`, `app.css`, `components.css`.
**Repo scope:** `web/` only. No platform changes, no schema changes, no new endpoints.

## Context

The legacy `/tracks` surface is a Tailwind-styled track-index grid plus a per-track timeline (`/tracks/[id]`). Sub-project A shipped the `SkillNode` primitive (a state-aware tinted button: `completed | current | available | locked` × `swift | kotlin | shared`) plus all node-level CSS (`.node`, `.node.current::after` pulse, `.tint-*`). Sub-project B shipped the chrome (Sidebar with `ContinueLessonButton href="/tracks"`, Topbar with track switcher). Sub-project C shipped `useActiveTrack` and the dashboard's track-aware composition.

The skill tree is the visual centerpiece of the design — the surface a learner returns to between lessons to see where they are and what's next. The design composes it from per-track sections, each with a section header (icon + title + meta + progress bar), a vertical zigzag column of lesson nodes (no connector lines — flow comes from the procedural `translateX` offset), and a decorative milestone medal at the end of each non-locked section. The pulse animation on a single `current` node provides the "you are here" beacon.

Curriculum tooling does not yet emit Section grouping rows; lessons land in flat tables under each Track. The frontend chunks the lesson list itself for now and will swap to real Section data once curriculum tooling provides it.

## Goal

Repurpose `/tracks` as the active-track skill-tree page — replacing the legacy track-index grid. Convert `/tracks/[id]` into a thin redirect that preserves direct-link bookmarks. Build the tree topology from the existing flat `Track.lessons` list via a frontend chunker, with section-level locks driven by prior-section completion. Ship one new lib module (`lib/sections.ts`), three new presentational components (`TreePageHead`, `TreeSection`, `TreeNode`), and one skeleton placeholder. Delete the legacy track-index UI, the timeline node component, and two helper functions (`pickContinuePrompt`, `smartTrackCta`). Land on `feat/tracks` off web `master@879211c`, merge LOCAL-ONLY.

## Decisions

### D1. Tree topology — frontend chunker, default 6 lessons per section

The chunker lives at `web/lib/sections.ts` and groups a flat `LessonSummary[]` into fixed-size `TreeSection` rows. Default `DEFAULT_SECTION_SIZE = 6`. Section title is `"{TrackTitle} · Part {n}"` (1-indexed `n`). Section meta is `"{N} lessons · ~{M} min"` where `M = N * MINUTES_PER_LEVEL[firstLessonLevel]` and `MINUTES_PER_LEVEL = { foundation: 4, intermediate: 6, advanced: 8 }` is an inline constant in `lib/sections.ts`. When curriculum tooling adds real Section grouping rows (future sub-project), swap the chunker for a passthrough that uses backend-supplied groupings.

**Per-level minutes scope (Q1 → A):** Inline constant in `lib/sections.ts`. Single consumer today; lift to a shared config when E (Lesson Player) introduces a second consumer for ETA display.

### D2. No connectors between nodes

Visual flow comes from the procedural zigzag transform — for each lesson node at row index `i`:

```ts
const offset = (i % 2 === 0 ? -90 : 90) + Math.sin(i) * 20;
// applied as inline style: `transform: translateX(${offset}px)`
```

The design's `.tree-row svg.connector` CSS rule exists in source but the design's `app-tree.jsx` never renders an `<svg className="connector">`. The CSS port omits this rule.

### D3. Section-level locks; single current node per track

A section is `locked` iff every prior section's `progressPct < 100`. Inside an unlocked section, lesson-state mapping is:

| Lesson progress | Tree node state | Meta copy |
|---|---|---|
| `complete` | `completed` | `Mastered` |
| `in_progress` | `current` (most-recent `lastAttemptAt`, ties broken by `lessonId` ASC) | `In progress · {passed} of {total}` |
| `in_progress` (lost recency tiebreak) | `available` | `Tap to start` |
| no progress / not started | `available` | `Tap to start` |
| any lesson in a `locked` section | `locked` | `Locked` |

**Single current node rule (Q2 → A):** Exactly one node across the whole track may be `current` (the design's pulse-singleton). When multiple lessons are simultaneously `in_progress`, the most-recent `lastAttemptAt` wins; ties broken by `lessonId` ascending for determinism. Other `in_progress` lessons render as `available` — no data is lost; the lesson player resumes from actual progress when tapped.

`progressPct` per section: `Math.round(100 * completedCount / totalCount)`.

### D4. Repurpose `/tracks` → active-track tree; `/tracks/[id]` → redirect

The legacy track-index UI is deleted. `/tracks/page.tsx` is rewritten to render the skill tree for the active track (consumes `useActiveTrack` from C). `/tracks/[id]/page.tsx` becomes a thin redirect: on mount, call `setTrackId(params.id)` (only if the ID exists in `tracks`), then `router.replace('/tracks')`. This preserves any external bookmarks to `/tracks/swift-foundations` etc. — the user lands on the tree with that track active. If the requested ID doesn't exist in `tracks`, redirect anyway and let `/tracks` render its empty/error state.

### D5. Sidebar `ContinueLessonButton` keeps `href="/tracks"`

No code change to `ContinueLessonButton`. After D4 lands, `/tracks` renders the active-track tree with the `current` node pulsing. The sidebar becomes the orientation surface (tap to see where you are); the dashboard `PageHead` CTA remains the speed-path direct to `/lesson/[id]`.

### D6. Section milestone medal — included in D (Q3 → B)

Each non-`locked` section renders a decorative milestone row at the end of its `tree-track`: a trophy medal + caption (`"Badge earned"` when `progressPct === 100`, else `"Section badge"`). Hard-coded copy and visuals — no data binding to real badges yet. F (Profile / gamification) will wire this to `useBadges` data when it owns the gamification surface, but D ships the visual presence so the tree feels complete out of the gate. The trophy element is decorative (`aria-hidden="true"`, no click target).

### D7. CSS port — five tree selectors + medal slice (Q4 → A)

Append to `web/styles/components.css` (next to existing `.node` rules), labelled `/* ===== Skill tree layout ===== */`:

```css
.tree-wrap { padding: 40px 0; }
.tree-track {
  position: relative;
  margin: 0 auto;
  max-width: 760px;
}
.tree-section { margin-bottom: 80px; }
.tree-section-head {
  display: flex; align-items: center; gap: 16px;
  margin-bottom: 32px; padding-bottom: 16px;
  border-bottom: 1px solid var(--line-1);
}
.tree-row {
  display: flex; justify-content: center;
  margin: 28px 0;
  position: relative;
}
.tree-node-meta {
  position: absolute;
  font-size: var(--t-xs);
  white-space: nowrap;
  color: var(--text-2);
  pointer-events: none;
}
.medal {
  width: 80px; height: 80px;
  border-radius: 50%;
  display: grid; place-items: center;
  font-size: 32px;
  background:
    radial-gradient(circle at 30% 30%, rgba(255,255,255,0.25), transparent 50%),
    var(--grad-peacock);
  color: #fff;
  flex: none;
  box-shadow: var(--sh-2);
  position: relative;
}
.medal.locked {
  background: var(--bg-2);
  border: 1px dashed var(--line-2);
  color: var(--text-4);
  box-shadow: none;
}
.medal-row {
  display: grid;
  grid-template-columns: 80px 1fr;
  gap: 16px;
  align-items: center;
}
```

The `.tree-row svg.connector` rule is dropped (D2). All `.node`, `.node.{state}`, `.tint-*` rules already shipped in components.css from A.

Edit `web/styles/app.css` to extend the existing `.main-narrow` rule:

```css
.main-narrow { max-width: 980px; margin-inline: auto; }
```

The `margin-inline: auto` makes the class self-sufficient — a child div under the layout's `<main className="main">` centers correctly. Future-proofs F (Profile uses `main-narrow` too).

### D8. Web-only, single worktree, LOCAL-ONLY merge

All changes land in `web/`. Worktree at `c:/tmp/bootcamp-web-tracks`, branch `feat/tracks` off `master@879211c`. Final merge is `git merge --no-ff feat/tracks -m "merge: tracks design refactor — Sub-project D"` to web `master`. No remote push, no PR. Co-author trailer `Claude Opus 4.7 (1M context) <noreply@anthropic.com>` on each commit.

## Architecture

### Data flow

```
useActiveTrack() (from C)         →  trackId, tracks[], loading
        ↓
fetchTrack(trackId)               →  TrackDetail { ..., lessons: LessonSummary[] }
fetchTrackProgress(trackId)       →  TrackProgress { lessons: LessonProgress[] } | null
        ↓
chunkLessonsIntoSections(
  trackTitle, lessons, progress,
  size = DEFAULT_SECTION_SIZE,
)                                 →  TreeSection[]
        ↓
TreePageHead + map(TreeSection)   →  rendered tree
```

The page fetches `fetchTrack` and `fetchTrackProgress` on every `trackId` change. Mirrors dashboard's load-on-`trackId` pattern but is narrower (only the active track, not all tracks). No new hook — if a third surface needs `(detail, progress) for active track`, lift then.

### Drop `AppShell` shim

The legacy pages wrap content in `<AppShell title="…">{...}</AppShell>`, the B-era backwards-compat shim. Dashboard already dropped this in C. The new `/tracks` and `/tracks/[id]` follow suit — they return either a fragment or the `<div className="main-narrow">` wrapper, and rely on `(authed)/layout.tsx`'s `<main className="main">` for the outer chrome.

### Tint resolution

```ts
const tint: SkillNodeTint =
  detail.language === 'kotlin' ? 'kotlin' :
  detail.language === 'swift'  ? 'swift'  :
                                 'shared';
```

Resolved once at the page level, threaded down through `TreeSection` → `TreeNode` → `SkillNode`. Unrecognized future languages fall back to the `shared` tint (a neutral peacock variant from A) rather than misrepresenting them as Swift. Adding per-language tints beyond Swift/Kotlin is out of scope for D.

## Sections module (`web/lib/sections.ts`)

```ts
import type { LessonSummary } from '@/lib/tracks';
import type { TrackProgress, LessonProgress } from '@/lib/progress';
import type { SkillNodeState } from '@/components/ui/SkillNode';

export const DEFAULT_SECTION_SIZE = 6;

const MINUTES_PER_LEVEL: Record<string, number> = {
  foundation: 4,
  intermediate: 6,
  advanced: 8,
};

export type TreeNode = {
  lessonId: string;
  title: string;
  level: string;            // 'foundation' | 'intermediate' | 'advanced' (or other future values)
  state: SkillNodeState;
  meta: string;             // 'Mastered' | 'In progress · {n} of {m}' | 'Tap to start' | 'Locked'
};

export type TreeSection = {
  index: number;            // 0-based
  title: string;            // '{TrackTitle} · Part {n}' (1-based n)
  meta: string;             // '{N} lessons · ~{M} min'
  progressPct: number;      // 0..100, integer
  done: boolean;            // progressPct === 100
  locked: boolean;
  nodes: TreeNode[];
};

export function chunkLessonsIntoSections(
  trackTitle: string,
  lessons: LessonSummary[],
  progress: TrackProgress | null,
  size: number = DEFAULT_SECTION_SIZE,
): TreeSection[];
```

### Algorithm

1. **Build progress map.** `progressByLessonId = new Map<lessonId, LessonProgress>()` from `progress?.lessons ?? []`.
2. **Pick the singleton current lesson.** Across all `lessons`, find the subset where `progressByLessonId.get(id)?.state === 'in_progress'`. Sort that subset by `lastAttemptAt` DESC (treating `null` as oldest, sorted last), then `lessonId` ASC for ties. The first element's `lessonId` is `currentLessonId` (or `null` if no `in_progress` lessons exist).
3. **Chunk.** Walk `lessons` in array order, slicing into chunks of `size`. For each chunk, build a tentative `TreeSection` (no lock state yet).
4. **Compute per-section progressPct.** For each section, count completed lessons (`progressByLessonId.get(id)?.state === 'complete'`) and divide by section size, rounded.
5. **Compute locks.** Section 0 is never locked. Section `i ≥ 1` is `locked` iff any `j < i` has `progressPct < 100`. (Equivalent: locked iff prior section is not `done`. Since locks cascade — if section 1 is locked, section 2 is automatically locked because section 1's progress will be 0.)
6. **Map node states.** For each lesson in each section:
   - If section is `locked` → `state = 'locked'`, meta `'Locked'`.
   - Else look up progress. `complete` → `completed` ("Mastered"). `in_progress` AND `lessonId === currentLessonId` → `current` (`In progress · {passed} of {total}`). Otherwise → `available` ("Tap to start").
7. **Title and meta.** Section title `"{trackTitle} · Part {sectionIndex + 1}"`. Meta `"{nodes.length} lessons · ~{minutes} min"` where `minutes = nodes.length * (MINUTES_PER_LEVEL[firstLessonLevel] ?? 5)`. The `?? 5` per-lesson fallback (defensive against curriculum data variation) means an unknown level produces `5 min` per lesson, not `5 min` total.
8. **Done flag.** `done = progressPct === 100`.

### Test cases (`web/lib/sections.test.ts`)

1. Empty lesson list → returns `[]`.
2. All lessons have no progress → section 0 unlocked (every lesson `available`), sections ≥ 1 locked.
3. Mid-section progress: 3 of 6 lessons in section 0 complete, 1 `in_progress`, 2 not started → section 0 has 3 `completed` + 1 `current` + 2 `available`; section 1 still locked.
4. Full-section completion (all 6 lessons in section 0 complete, `progressPct === 100`) → section 1 unlocks; lessons in section 1 are `available` (none `current` if no `in_progress`).
5. Locked section → every lesson `locked`, meta `'Locked'`, no `current`.
6. Single-current-node uniqueness: 3 `in_progress` lessons across the track with distinct `lastAttemptAt` → exactly one `current`; the other two `available`. With identical `lastAttemptAt`, `lessonId` ASC tiebreaker wins.
7. Custom `size` parameter: `size = 4` chunks 12 lessons into 3 sections of 4.
8. Meta copy: section title `"{trackTitle} · Part 1"`, meta string format `"{N} lessons · ~{M} min"` with `M = N * MINUTES_PER_LEVEL[level]` (foundation=4, intermediate=6, advanced=8). Unknown-level fallback: `M = N * 5` (per-lesson, not total — e.g., 6 lessons of unknown level → `~30 min`, not `~5 min`).

## CSS port (`web/styles/components.css`)

Append a new block at the end of the file (after the existing `.node` / tint rules), labelled `/* ===== Skill tree layout ===== */`. Selectors:

- `.tree-wrap` — outer wrapper padding
- `.tree-track` — per-section vertical column with side padding for the zigzag offset
- `.tree-track.tint-swift` / `.tree-track.tint-kotlin` — already covered by the existing `.tint-*` rules from A (no new tint declarations)
- `.tree-section` — section spacing
- `.tree-section-head` — flex row with icon + title/meta column + progress bar
- `.tree-row` — per-row flex container; `position: relative`
- `.tree-node-meta` — meta text styling (small mono caption)
- `.medal`, `.medal.locked`, `.medal-row` — milestone trophy presentation

Drop the design's `.tree-row svg.connector { ... }` rule. Drop none of the existing `.node` rules.

Verbatim port from `docs/superpowers/design/app.css` lines 125-143 (`.tree-*`) and 211-235 (`.medal-*`), with the connector rule excised.

## Components (`web/components/tracks/`)

### `TreeNode.tsx`

Pure presentational. Props:

```ts
interface TreeNodeProps {
  node: TreeNode;            // from lib/sections.ts
  index: number;              // row index within the section, for zigzag offset
  tint: SkillNodeTint;
  onSelect: (lessonId: string) => void;  // called only when state !== 'locked'
}
```

Renders:

```tsx
<div className="tree-row">
  <div style={{ transform: `translateX(${offset}px)`, position: 'relative', display: 'flex', alignItems: 'center', gap: 16 }}>
    <SkillNode state={node.state} tint={tint} onClick={() => onSelect(node.lessonId)}>
      {/* state-appropriate Icon: check | play | play | lock */}
    </SkillNode>
    <div>
      <div style={{ fontWeight: 600, fontSize: 'var(--t-sm)' }}>{node.title}</div>
      <div className="mono muted" style={{ fontSize: 'var(--t-2xs)', marginTop: 2 }}>{node.meta}</div>
    </div>
  </div>
</div>
```

`offset = (index % 2 === 0 ? -90 : 90) + Math.sin(index) * 20`.

### `TreeSection.tsx`

Pure presentational. Props:

```ts
interface TreeSectionProps {
  section: TreeSection;
  tint: SkillNodeTint;
  onSelectLesson: (lessonId: string) => void;
}
```

Composes:
- Section head: `lesson-icon` (book / check / lock per `done | locked`), `<h3 className="h3">{title}</h3>`, meta caption, progress bar (`.bar` + `.bar-fill` width `progressPct%`) + percentage label
- `<div className={\`tree-track tint-\${tint}\`}>` containing:
  - One `<TreeNode>` per `section.nodes` entry
  - Milestone row (only when `!section.locked`): `<div className="tree-row"><div className="medal" aria-hidden="true">…trophy…</div><div className="mono">{section.done ? 'Badge earned' : 'Section badge'}</div></div>`

### `TreePageHead.tsx`

Pure presentational. Props:

```ts
interface TreePageHeadProps {
  trackTitle: string;
  language: 'swift' | 'kotlin' | string;
  totalLessons: number;
  completedLessons: number;
}
```

Renders a `.page-head` row mirroring the design (line 89-99 of `app-tree.jsx`):
- Eyebrow `Skill tree · {TrackName} track`
- `<h1 className="h-display">Your path forward.</h1>`
- Muted intro `Sections unlock as you master the previous one. Tap any node to begin.`
- Right-side row of badges: language badge (tint per language: `badge-iris` for Swift, `badge-amber` for Kotlin) + `<span className="badge">{completedLessons} of {totalLessons} lessons</span>`

`{TrackName}` is `Swift` / `Kotlin` / language with first letter uppercased — derived from `language` prop.

### `TreeSkeleton.tsx`

No test. Renders three skeleton section rows (placeholder section-head + 4-5 skeleton tree-rows) using the existing `.skeleton` class from A. Used as the loading state on `/tracks/page.tsx`.

## Page composition (`web/app/(authed)/tracks/page.tsx`)

```tsx
'use client';
import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useActiveTrack } from '@/lib/track-context';
import { fetchTrack, type TrackDetail } from '@/lib/tracks';
import { fetchTrackProgress, type TrackProgress } from '@/lib/progress';
import { chunkLessonsIntoSections } from '@/lib/sections';
import { TreePageHead } from '@/components/tracks/TreePageHead';
import { TreeSection } from '@/components/tracks/TreeSection';
import { TreeSkeleton } from '@/components/tracks/TreeSkeleton';
import type { SkillNodeTint } from '@/components/ui/SkillNode';

export default function TracksPage() {
  const router = useRouter();
  const { trackId, tracks, loading: trackLoading } = useActiveTrack();
  const [detail, setDetail] = useState<TrackDetail | null>(null);
  const [progress, setProgress] = useState<TrackProgress | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!trackId) { setDetail(null); setProgress(null); return; }
    setError(null); setDetail(null); setProgress(null);
    try {
      const [t, p] = await Promise.all([
        fetchTrack(trackId),
        fetchTrackProgress(trackId).catch(() => null),
      ]);
      if (!t) { setError('Track not found'); return; }
      setDetail(t); setProgress(p);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load track');
    }
  }, [trackId]);

  useEffect(() => { void load(); }, [load]);

  if (trackLoading || (trackId && !detail && !error)) return <NarrowMain><TreeSkeleton /></NarrowMain>;
  if (!trackLoading && !trackId) return <NarrowMain><EmptyTrackState /></NarrowMain>;
  if (error) return <NarrowMain><InlineError message={error} onRetry={load} /></NarrowMain>;
  if (!detail) return <NarrowMain><TreeSkeleton /></NarrowMain>;

  const sections = chunkLessonsIntoSections(detail.title, detail.lessons, progress);
  const totalLessons = detail.lessons.length;
  const completedLessons = sections.reduce((acc, s) => acc + s.nodes.filter(n => n.state === 'completed').length, 0);
  const tint: SkillNodeTint =
    detail.language === 'kotlin' ? 'kotlin' :
    detail.language === 'swift'  ? 'swift'  : 'shared';

  return (
    <NarrowMain>
      <TreePageHead trackTitle={detail.title} language={detail.language} totalLessons={totalLessons} completedLessons={completedLessons} />
      {sections.length === 0 ? (
        <p className="muted">No lessons in this track yet.</p>
      ) : (
        <div className="tree-wrap">
          {sections.map((s, i) => (
            <TreeSection
              key={i}
              section={s}
              tint={tint}
              onSelectLesson={(lessonId) => router.push(`/lesson/${lessonId}`)}
            />
          ))}
        </div>
      )}
    </NarrowMain>
  );
}

function NarrowMain({ children }: { children: React.ReactNode }) {
  return <div className="main-narrow">{children}</div>;
}

function EmptyTrackState() { /* card prompting user to pick a track from the topbar switcher */ }
function InlineError({ message, onRetry }: { message: string; onRetry: () => void }) { /* alert + button */ }
```

`NarrowMain`, `EmptyTrackState`, `InlineError` are inline helpers in this file — small, page-specific, not worth extracting.

## `/tracks/[id]` redirect (`web/app/(authed)/tracks/[id]/page.tsx`)

```tsx
'use client';
import { useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useActiveTrack } from '@/lib/track-context';

export default function TrackRedirectPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const { setTrackId, tracks, loading } = useActiveTrack();

  useEffect(() => {
    if (loading || !params?.id) return;
    const exists = tracks.some((t) => t.id === params.id);
    if (exists) setTrackId(params.id);
    router.replace('/tracks');
  }, [params?.id, loading, tracks, setTrackId, router]);

  return null;
}
```

Render `null` during the redirect — the operation is essentially synchronous on the client. If the requested ID doesn't exist in `tracks`, skip the `setTrackId` call but still redirect to `/tracks` (which renders its empty/error state if the active track ends up null or invalid).

## Build sequence (ordered, on `feat/tracks`)

Bottom-up: foundation → primitives → composition → integration → cleanup. One commit per step.

| # | Commit | Adds / Edits | Tests run |
|---|---|---|---|
| 1 | `feat(styles): extend .main-narrow with margin-inline: auto` | `web/styles/app.css` | typecheck only |
| 2 | `feat(styles): port tree-* + medal-* CSS slice into components.css` | `web/styles/components.css` | typecheck only |
| 3 | `feat(tracks): add lib/sections.ts chunker + tests` | `web/lib/sections.ts` + `.test.ts` | vitest `sections.test.ts` |
| 4 | `feat(tracks): TreeNode component + tests` | `web/components/tracks/TreeNode.tsx` + `.test.tsx` | vitest `TreeNode.test.tsx` |
| 5 | `feat(tracks): TreeSection component + tests` | `web/components/tracks/TreeSection.tsx` + `.test.tsx` | vitest |
| 6 | `feat(tracks): TreePageHead component + tests` | `web/components/tracks/TreePageHead.tsx` + `.test.tsx` | vitest |
| 7 | `feat(tracks): TreeSkeleton placeholder` | `web/components/tracks/TreeSkeleton.tsx` | typecheck only |
| 8 | `feat(tracks): rewrite /tracks/page.tsx to render the active-track tree` | `web/app/(authed)/tracks/page.tsx` + integration test | vitest page tests |
| 9 | `feat(tracks): convert /tracks/[id] to redirect route` | `web/app/(authed)/tracks/[id]/page.tsx` + smoke test | vitest |
| 10 | `test(e2e): tracks page navigation + node interactions` | `web/tests/e2e/tracks.spec.ts` | playwright |
| 11 | `chore(tracks): remove TimelineLessonNode, pickContinuePrompt, smartTrackCta + their tests` | delete 4 files + edit `lib/progress.ts` | full vitest + playwright + typecheck |
| 12 | (optional) `chore(tracks): cleanup pass` | dead-import removal, lint clean | full suite |

Steps 11-12 land **after** all new content is in place so intermediate commits' tests don't break. The deletes in step 11 are gated on a clean full-suite run; if the run fails, fix forward (don't `--amend`).

### Sub-agent batching (per A/B/C convention)

Steps 3-7 are independent (presentational components consuming primitives) and can be parallelised across sub-agents during implementation. Steps 8-9 depend on 3-7. Steps 10-11 depend on 8-9. Steps 1-2 are foundational and run first sequentially.

## Testing

### Web (Vitest + Playwright)

**Vitest unit:**
- `lib/sections.test.ts` — 8 cases (above)
- `components/tracks/TreeNode.test.tsx` — render states, tint, click handler, locked-disabled behavior, zigzag offset, meta copy
- `components/tracks/TreeSection.test.tsx` — head icon by state, progress bar fill, milestone row gating, milestone copy, trophy `aria-hidden`
- `components/tracks/TreePageHead.test.tsx` — eyebrow, h-display, intro, badge tint per language, lesson count
- `app/(authed)/tracks/page.test.tsx` — loading state, no-active-track empty state, fetch error + retry, partial-progress-fetch graceful degrade, zero-lessons empty state, happy path
- `app/(authed)/tracks/[id]/page.test.tsx` — redirect calls `setTrackId` when ID exists, skips when ID doesn't exist, always redirects

**Playwright e2e (`web/tests/e2e/tracks.spec.ts`):**
- Navigate to `/tracks` → tree renders with at least one section + lesson
- Click an `available` node → URL becomes `/lesson/{id}`
- Click a `locked` node → URL unchanged (button is disabled)
- Sidebar `ContinueLessonButton` regression check → still navigates to `/tracks`

**Existing tests deleted:**
- `web/tests/tracks/timeline.test.tsx` (covers deleted `TimelineLessonNode`)
- `web/tests/tracks/smartCta.test.ts` (covers deleted `smartTrackCta`)
- `web/tests/tracks/continue.test.ts` (covers deleted `pickContinuePrompt`)

### Test count expectation

Web tests at C merge: 261. Estimated additions: ~50-60 vitest cases + 4 e2e cases. Estimated deletions: ~25-30 cases (across 3 deleted files). Net target: ~290-310 tests after D merges.

## Verification before merge

After step 11 (deletions) and before merge:

```
pnpm --filter web typecheck
pnpm --filter web vitest run
pnpm --filter web playwright test --project=chromium
pnpm --filter web build
```

All four must pass with zero errors. If any fails, fix forward in a new commit on `feat/tracks` — do not `--amend` past commits.

Manually verify in the dev server (`pnpm --filter web dev`):
- `/tracks` with active Swift track → see tree, click `current` node → land on `/lesson/{id}`
- Switch track via topbar → `/tracks` rerenders with the new track's tree
- Direct-link `/tracks/<some-track-id>` → redirects to `/tracks` with that track active
- Direct-link `/tracks/<bogus-id>` → redirects to `/tracks`, no console error
- Sidebar Continue Lesson button → navigates to `/tracks` (current node pulses)
- Density toggle (Sub-project A regression check) → tree CSS still respects density tokens

## Merge cleanup chain

```
# inside the worktree, on feat/tracks with all 11-12 commits:
pnpm --filter web typecheck && pnpm --filter web vitest run && pnpm --filter web playwright test --project=chromium

# in the main web checkout (or via -C):
git -C C:/Users/ricma/BootCamp/web checkout master
git -C C:/Users/ricma/BootCamp/web merge --no-ff feat/tracks -m "merge: tracks design refactor — Sub-project D"
git -C C:/Users/ricma/BootCamp/web branch -d feat/tracks
git worktree remove c:/tmp/bootcamp-web-tracks
```

LOCAL-ONLY — no push, no PR. Update `docs/superpowers/NEXT-SESSION-PROMPT.md` to point at Sub-project E (Lesson Player) with the new web `master` SHA.

## Out of scope

- Real Section grouping data from curriculum tooling — D's chunker is the placeholder until that ships.
- Wiring the section milestone medal to real `useBadges` data — F (Profile / gamification) owns this.
- Section-level analytics (time-to-completion, drop-off per section).
- Per-track theming beyond the existing Swift / Kotlin tints.
- Connector lines between nodes (D2 explicitly drops).
- A `useActiveTrackDetail` hook that bundles `(detail, progress)` for the active track — YAGNI; lift if a third surface needs it.
- A "switch track" UI on `/tracks` itself — the topbar already provides the switcher.
- Lesson-level locks within an unlocked section — D3 explicitly chose section-level locks only.
- Multiple `current` nodes — D3's single-current-node rule is locked.

## Carry-overs to E and beyond

- **MINUTES_PER_LEVEL constant lift:** if E (Lesson Player) surfaces an ETA, lift the inline constant from `lib/sections.ts` to a shared config module at that point.
- **`useActiveTrackDetail` hook:** if E needs `(detail, progress)` for the active track in the same shape /tracks does, extract the load-on-`trackId` pattern into a shared hook.
- **`/tracks/[id]` redirect pattern:** if F (Profile) ends up with a similar bookmark-preservation route (`/profile/[userId]`?), the thin redirect pattern is reusable.
- **Section milestone wiring:** F replaces hard-coded "Section badge" / "Badge earned" copy with real `useBadges` data when it owns the gamification surface.

## Source of truth

- Design source: `docs/superpowers/design/app-tree.jsx`, `docs/superpowers/design/app.css` lines 125-143 (`.tree-*`) and 211-235 (`.medal-*`), `docs/superpowers/design/components.css` lines 271-349 (`.node` + `.tint-*`, already shipped).
- Locked decisions: D1-D8 above; previously surfaced in `docs/superpowers/NEXT-SESSION-PROMPT.md` (D1-D5 from the prior session, D6-D8 added in this session).
- Web master at brainstorming time: `879211c`.
- Platform master at brainstorming time: `a376a48` (unchanged — no platform work in D).
