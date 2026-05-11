# Tracks / Skill Tree Refactor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Repurpose `/tracks` as the active-track skill-tree page (replacing the legacy track-index grid) and convert `/tracks/[id]` into a thin redirect that preserves bookmarks. Build the tree topology from the existing flat `Track.lessons` list via a frontend chunker, with section-level locks driven by prior-section completion. Web-only, single worktree, LOCAL-ONLY merge.

**Architecture:** One worktree off web `master@879211c`. Bottom-up build order: foundation CSS → primitives library (`lib/sections.ts`) → presentational components (`TreeNode`, `TreeSection`, `TreePageHead`, `TreeSkeleton`) → page rewrites (`/tracks` and `/tracks/[id]`) → e2e → cleanup. TDD per file, one commit per task. Consumes `useActiveTrack` (Sub-project C), `SkillNode` primitive (Sub-project A), and the `(authed)` chrome (Sub-project B) — no platform changes.

**Tech Stack:** Next.js 14 App Router + React 18 + Tailwind + Vitest + Playwright. Existing primitives at `@/components/ui` (A); `useActiveTrack` at `@/lib/track-context` (C); progress + tracks libs at `@/lib/{progress,tracks}` (pre-A).

**Spec:** [`docs/superpowers/specs/2026-05-03-tracks-design.md`](../specs/2026-05-03-tracks-design.md)

---

## File Structure

### `web/` (relative to the worktree root `c:/tmp/bootcamp-web-tracks`)

| File | Status | Responsibility |
|---|---|---|
| `styles/app.css` | MODIFY | Extend `.main-narrow` with `margin-inline: auto` |
| `styles/components.css` | MODIFY | Append `.tree-wrap` / `.tree-track` / `.tree-section` / `.tree-section-head` / `.tree-row` / `.tree-node-meta` / `.medal` / `.medal.locked` / `.medal-row` slice (drop the design's `.tree-row svg.connector`) |
| `lib/sections.ts` | NEW | Chunker: `chunkLessonsIntoSections(trackTitle, lessons, progress, size?) → TreeSection[]`; exports `DEFAULT_SECTION_SIZE`, `TreeNode`, `TreeSection` types |
| `lib/sections.test.ts` | NEW | Vitest — 8 cases (empty, no-progress, mid-section, full-section unlocks, locked-section, single-current uniqueness, custom size, meta copy) |
| `components/tracks/TreeNode.tsx` | NEW | Pure presentational: zigzag tree row + `SkillNode` button + label/meta column |
| `components/tracks/TreeNode.test.tsx` | NEW | Vitest — render states, tint, click handler, locked-disabled, zigzag offset, meta copy |
| `components/tracks/TreeSection.tsx` | NEW | Pure presentational: section head (icon + title + meta + progress bar) + `TreeNode`s + decorative milestone medal row |
| `components/tracks/TreeSection.test.tsx` | NEW | Vitest — head icon by state, progress bar fill, milestone gating, milestone copy, trophy `aria-hidden` |
| `components/tracks/TreePageHead.tsx` | NEW | Pure presentational: eyebrow + `Your path forward.` h-display + intro + language badge + `X of Y lessons` badge |
| `components/tracks/TreePageHead.test.tsx` | NEW | Vitest — eyebrow, h-display, intro copy, badge tint per language, lesson count |
| `components/tracks/TreeSkeleton.tsx` | NEW | Loading placeholder (no test) |
| `app/(authed)/tracks/page.tsx` | REWRITE | Render the active-track tree; loading / no-track / error / empty-lessons / happy-path states |
| `app/(authed)/tracks/page.test.tsx` | NEW | Vitest — all five render states |
| `app/(authed)/tracks/[id]/page.tsx` | REWRITE | Thin redirect: `setTrackId(id)` (if exists) then `router.replace('/tracks')` |
| `app/(authed)/tracks/[id]/page.test.tsx` | NEW | Vitest — redirect when ID exists, redirect when ID missing |
| `tests/e2e/tracks.spec.ts` | NEW | Playwright — navigate, click available node, click locked node, sidebar Continue regression |
| `components/tracks/TimelineLessonNode.tsx` | DELETE | Legacy component, only consumer was the legacy `/tracks/[id]` |
| `tests/tracks/timeline.test.tsx` | DELETE | Tests the deleted component |
| `tests/tracks/smartCta.test.ts` | DELETE | Tests the deleted `smartTrackCta` |
| `tests/tracks/continue.test.ts` | DELETE | Tests the deleted `pickContinuePrompt` |
| `lib/progress.ts` | MODIFY | Remove `pickContinuePrompt` + `ContinuePrompt` type; remove `smartTrackCta` |

---

## Repository Setup (do once before Task T1)

### Task R0: Create the web worktree

**Files:** none — bootstrap only.

- [ ] **Step 1: Verify web `master` is at `879211c` and clean**

```bash
git -C c:/Users/ricma/BootCamp/web log master -1 --oneline
git -C c:/Users/ricma/BootCamp/web status --short
```

Expected: first command prints `879211c merge: dashboard refactor`. Second command prints nothing (clean tree). If `master` is ahead/behind, stop and reconcile before proceeding.

- [ ] **Step 2: Create the worktree on a new branch off `master`**

```bash
git -C c:/Users/ricma/BootCamp/web worktree add c:/tmp/bootcamp-web-tracks -b feat/tracks master
```

Expected: `Preparing worktree (new branch 'feat/tracks')` followed by `HEAD is now at 879211c merge: dashboard refactor`.

- [ ] **Step 3: Verify the worktree branch**

```bash
git -C c:/tmp/bootcamp-web-tracks branch --show-current
git -C c:/tmp/bootcamp-web-tracks log -1 --oneline
```

Expected: `feat/tracks`, `879211c merge: dashboard refactor`.

- [ ] **Step 4: Install deps in the worktree**

```bash
cd c:/tmp/bootcamp-web-tracks && npm install
```

Expected: `npm install` succeeds; no commit (lockfile already tracked). If `npm install` modifies `package-lock.json`, stop — that means the lockfile drifted and needs upstream fix.

- [ ] **Step 5: Smoke-test the toolchain**

```bash
cd c:/tmp/bootcamp-web-tracks && npx tsc --noEmit && npm test
```

Expected: typecheck clean, vitest passes (~261 tests). If anything fails before any code change, stop and reconcile.

---

> **From here on, all task commands run inside `c:/tmp/bootcamp-web-tracks`.** Use `cd c:/tmp/bootcamp-web-tracks` once at the start of each new shell, or chain commands.

---

## Task T1: Extend `.main-narrow` CSS

**Files:**
- Modify: `styles/app.css`

- [ ] **Step 1: Locate the existing `.main-narrow` rule**

```bash
grep -n "main-narrow" styles/app.css
```

Expected: one match around line 50: `.main-narrow { max-width: 980px; }`.

- [ ] **Step 2: Edit the rule to add `margin-inline: auto`**

In `styles/app.css`, replace:

```css
.main-narrow { max-width: 980px; }
```

with:

```css
.main-narrow { max-width: 980px; margin-inline: auto; }
```

- [ ] **Step 3: Verify the change**

```bash
grep -n "main-narrow" styles/app.css
```

Expected: `.main-narrow { max-width: 980px; margin-inline: auto; }`.

- [ ] **Step 4: Typecheck (CSS doesn't typecheck but make sure nothing broke)**

```bash
npx tsc --noEmit
```

Expected: clean. If it fails, this task didn't cause it (CSS-only edit) — investigate before continuing.

- [ ] **Step 5: Commit**

```bash
git add styles/app.css
git commit -m "$(cat <<'EOF'
feat(styles): extend .main-narrow with margin-inline: auto

Makes the class self-sufficient — a child div under the layout's
<main className="main"> centers correctly without per-page margin
overrides. Future-proofs Sub-project F (Profile uses main-narrow too).

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

Expected: one commit, one file changed.

---

## Task T2: Port `.tree-*` and `.medal-*` CSS slice

**Files:**
- Modify: `styles/components.css`

- [ ] **Step 1: Find a stable insertion point at the end of components.css**

```bash
tail -5 styles/components.css
```

Expected: the last lines of the existing file. Note the final blank line, if any.

- [ ] **Step 2: Append the skill-tree layout block**

Append the following to the end of `styles/components.css` (verbatim — these CSS values are the source of truth from `docs/superpowers/design/app.css` lines 124-149 and 211-235, with the design's `.tree-row svg.connector` rule excised per spec D2):

```css

/* ===== Skill tree layout ===== */
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

/* Section milestone (decorative) */
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

- [ ] **Step 3: Verify the rules landed**

```bash
grep -n "tree-wrap\|tree-track\|tree-section\|tree-row\|tree-node-meta\|^\.medal" styles/components.css
```

Expected: 9 hits, including all the new selectors at the end of the file.

- [ ] **Step 4: Verify typecheck still clean**

```bash
npx tsc --noEmit
```

Expected: clean.

- [ ] **Step 5: Commit**

```bash
git add styles/components.css
git commit -m "$(cat <<'EOF'
feat(styles): port tree-* + medal-* CSS slice into components.css

Verbatim port from docs/superpowers/design/app.css lines 124-149
(.tree-*) and 211-235 (.medal-*). The design's .tree-row svg.connector
rule is dropped — tree topology uses the procedural translateX zigzag
only (per Sub-project D spec, decision D2).

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

Expected: one commit.

---

## Task T3: `lib/sections.ts` chunker + tests

**Files:**
- Create: `lib/sections.ts`
- Test: `lib/sections.test.ts`

- [ ] **Step 1: Write the failing test**

Create `lib/sections.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import {
  chunkLessonsIntoSections,
  DEFAULT_SECTION_SIZE,
  type TreeSection,
} from './sections';
import type { LessonSummary } from './tracks';
import type { TrackProgress, LessonProgress } from './progress';

function lesson(id: string, position: number, level: 'foundation' | 'intermediate' | 'advanced' | string = 'foundation'): LessonSummary {
  return {
    id,
    version: 1,
    title: `Lesson ${id}`,
    summary: '',
    position,
    level,
  };
}

function progress(entries: Array<Partial<LessonProgress> & { lessonId: string }>): TrackProgress {
  return {
    trackId: 't1',
    lessons: entries.map((e) => ({
      lessonId: e.lessonId,
      lessonVersion: e.lessonVersion ?? 1,
      totalExercises: e.totalExercises ?? 6,
      passedExercises: e.passedExercises ?? 0,
      attemptedExercises: e.attemptedExercises ?? 0,
      state: e.state ?? 'not_started',
      lastAttemptAt: e.lastAttemptAt ?? null,
    })),
  };
}

describe('chunkLessonsIntoSections', () => {
  it('returns [] for an empty lesson list', () => {
    expect(chunkLessonsIntoSections('Swift', [], null)).toEqual([]);
  });

  it('exposes DEFAULT_SECTION_SIZE = 6', () => {
    expect(DEFAULT_SECTION_SIZE).toBe(6);
  });

  it('all lessons no progress → section 0 unlocked, sections >= 1 locked', () => {
    const lessons = Array.from({ length: 18 }, (_, i) => lesson(`L${i + 1}`, i + 1));
    const sections = chunkLessonsIntoSections('Swift', lessons, null);
    expect(sections).toHaveLength(3);
    expect(sections[0].locked).toBe(false);
    expect(sections[0].nodes.every((n) => n.state === 'available')).toBe(true);
    expect(sections[1].locked).toBe(true);
    expect(sections[1].nodes.every((n) => n.state === 'locked')).toBe(true);
    expect(sections[2].locked).toBe(true);
  });

  it('mid-section progress: 3 complete + 1 in_progress + 2 not_started in section 0', () => {
    const lessons = Array.from({ length: 12 }, (_, i) => lesson(`L${i + 1}`, i + 1));
    const p = progress([
      { lessonId: 'L1', state: 'complete', passedExercises: 6, totalExercises: 6 },
      { lessonId: 'L2', state: 'complete', passedExercises: 6, totalExercises: 6 },
      { lessonId: 'L3', state: 'complete', passedExercises: 6, totalExercises: 6 },
      { lessonId: 'L4', state: 'in_progress', passedExercises: 4, totalExercises: 6, lastAttemptAt: '2026-05-03T10:00:00Z' },
    ]);
    const sections = chunkLessonsIntoSections('Swift', lessons, p);
    const states = sections[0].nodes.map((n) => n.state);
    expect(states).toEqual(['completed', 'completed', 'completed', 'current', 'available', 'available']);
    expect(sections[0].nodes[3].meta).toBe('In progress · 4 of 6');
    expect(sections[0].progressPct).toBe(50); // 3 of 6
    expect(sections[0].locked).toBe(false);
    expect(sections[1].locked).toBe(true);
  });

  it('full-section completion (progressPct === 100) unlocks the next section', () => {
    const lessons = Array.from({ length: 12 }, (_, i) => lesson(`L${i + 1}`, i + 1));
    const p = progress(
      Array.from({ length: 6 }, (_, i) => ({
        lessonId: `L${i + 1}`,
        state: 'complete' as const,
        passedExercises: 6,
        totalExercises: 6,
      })),
    );
    const sections = chunkLessonsIntoSections('Swift', lessons, p);
    expect(sections[0].progressPct).toBe(100);
    expect(sections[0].done).toBe(true);
    expect(sections[1].locked).toBe(false);
    expect(sections[1].nodes.every((n) => n.state === 'available')).toBe(true);
  });

  it('locked section: every lesson `locked`, no `current`, meta `Locked`', () => {
    const lessons = Array.from({ length: 12 }, (_, i) => lesson(`L${i + 1}`, i + 1));
    // Section 0 has 1 in_progress in section 0; section 1 should still be locked.
    const p = progress([
      { lessonId: 'L1', state: 'in_progress', lastAttemptAt: '2026-05-03T10:00:00Z' },
    ]);
    const sections = chunkLessonsIntoSections('Swift', lessons, p);
    expect(sections[1].locked).toBe(true);
    sections[1].nodes.forEach((n) => {
      expect(n.state).toBe('locked');
      expect(n.meta).toBe('Locked');
    });
  });

  it('single current node: most-recent lastAttemptAt wins; others render as available', () => {
    const lessons = Array.from({ length: 6 }, (_, i) => lesson(`L${i + 1}`, i + 1));
    const p = progress([
      { lessonId: 'L1', state: 'in_progress', lastAttemptAt: '2026-05-01T10:00:00Z' },
      { lessonId: 'L3', state: 'in_progress', lastAttemptAt: '2026-05-03T10:00:00Z' }, // most recent
      { lessonId: 'L5', state: 'in_progress', lastAttemptAt: '2026-05-02T10:00:00Z' },
    ]);
    const sections = chunkLessonsIntoSections('Swift', lessons, p);
    const currentNodes = sections[0].nodes.filter((n) => n.state === 'current');
    expect(currentNodes).toHaveLength(1);
    expect(currentNodes[0].lessonId).toBe('L3');
    expect(sections[0].nodes.find((n) => n.lessonId === 'L1')?.state).toBe('available');
    expect(sections[0].nodes.find((n) => n.lessonId === 'L5')?.state).toBe('available');
  });

  it('single current node: ties on lastAttemptAt broken by lessonId ASC', () => {
    const lessons = Array.from({ length: 6 }, (_, i) => lesson(`L${i + 1}`, i + 1));
    const p = progress([
      { lessonId: 'L3', state: 'in_progress', lastAttemptAt: '2026-05-03T10:00:00Z' },
      { lessonId: 'L1', state: 'in_progress', lastAttemptAt: '2026-05-03T10:00:00Z' },
    ]);
    const sections = chunkLessonsIntoSections('Swift', lessons, p);
    const current = sections[0].nodes.find((n) => n.state === 'current');
    expect(current?.lessonId).toBe('L1'); // ASC tiebreak
  });

  it('null lastAttemptAt sorts last (treated as oldest)', () => {
    const lessons = Array.from({ length: 6 }, (_, i) => lesson(`L${i + 1}`, i + 1));
    const p = progress([
      { lessonId: 'L1', state: 'in_progress', lastAttemptAt: null },
      { lessonId: 'L2', state: 'in_progress', lastAttemptAt: '2026-05-03T10:00:00Z' },
    ]);
    const sections = chunkLessonsIntoSections('Swift', lessons, p);
    const current = sections[0].nodes.find((n) => n.state === 'current');
    expect(current?.lessonId).toBe('L2');
  });

  it('custom size parameter: size=4 chunks 12 lessons into 3 sections of 4', () => {
    const lessons = Array.from({ length: 12 }, (_, i) => lesson(`L${i + 1}`, i + 1));
    const sections = chunkLessonsIntoSections('Swift', lessons, null, 4);
    expect(sections).toHaveLength(3);
    sections.forEach((s) => expect(s.nodes).toHaveLength(4));
  });

  it('section title and meta copy: foundation', () => {
    const lessons = Array.from({ length: 6 }, (_, i) => lesson(`L${i + 1}`, i + 1, 'foundation'));
    const sections = chunkLessonsIntoSections('Swift', lessons, null);
    expect(sections[0].title).toBe('Swift · Part 1');
    expect(sections[0].meta).toBe('6 lessons · ~24 min');
  });

  it('section meta copy: intermediate uses 6 min/lesson', () => {
    const lessons = Array.from({ length: 6 }, (_, i) => lesson(`L${i + 1}`, i + 1, 'intermediate'));
    const sections = chunkLessonsIntoSections('Kotlin', lessons, null);
    expect(sections[0].title).toBe('Kotlin · Part 1');
    expect(sections[0].meta).toBe('6 lessons · ~36 min');
  });

  it('section meta copy: advanced uses 8 min/lesson', () => {
    const lessons = Array.from({ length: 6 }, (_, i) => lesson(`L${i + 1}`, i + 1, 'advanced'));
    const sections = chunkLessonsIntoSections('Swift', lessons, null);
    expect(sections[0].meta).toBe('6 lessons · ~48 min');
  });

  it('section meta copy: unknown level falls back to 5 min PER LESSON (not total)', () => {
    const lessons = Array.from({ length: 6 }, (_, i) => lesson(`L${i + 1}`, i + 1, 'mystery'));
    const sections = chunkLessonsIntoSections('Swift', lessons, null);
    // 6 * 5 = 30, NOT 5
    expect(sections[0].meta).toBe('6 lessons · ~30 min');
  });

  it('completed lesson meta is "Mastered"', () => {
    const lessons = [lesson('L1', 1)];
    const p = progress([{ lessonId: 'L1', state: 'complete', passedExercises: 6, totalExercises: 6 }]);
    const sections = chunkLessonsIntoSections('Swift', lessons, p);
    expect(sections[0].nodes[0].meta).toBe('Mastered');
  });

  it('available lesson meta is "Tap to start"', () => {
    const lessons = [lesson('L1', 1)];
    const sections = chunkLessonsIntoSections('Swift', lessons, null);
    expect(sections[0].nodes[0].meta).toBe('Tap to start');
  });
});
```

- [ ] **Step 2: Run the test (expect FAIL)**

```bash
npm test -- sections.test
```

Expected: FAIL — `Cannot find module './sections'` (or similar). Test discovery should report 16 cases queued.

- [ ] **Step 3: Create the implementation**

Create `lib/sections.ts`:

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
const FALLBACK_MINUTES_PER_LESSON = 5;

export type TreeNode = {
  lessonId: string;
  title: string;
  level: string;
  state: SkillNodeState;
  meta: string;
};

export type TreeSection = {
  index: number;
  title: string;
  meta: string;
  progressPct: number;
  done: boolean;
  locked: boolean;
  nodes: TreeNode[];
};

function pickCurrentLessonId(
  lessons: LessonSummary[],
  progressByLessonId: Map<string, LessonProgress>,
): string | null {
  const inProgress = lessons
    .map((l) => progressByLessonId.get(l.id))
    .filter((p): p is LessonProgress => !!p && p.state === 'in_progress');
  if (inProgress.length === 0) return null;
  inProgress.sort((a, b) => {
    // lastAttemptAt DESC (null treated as oldest, sorted last)
    const ta = a.lastAttemptAt ? Date.parse(a.lastAttemptAt) : -Infinity;
    const tb = b.lastAttemptAt ? Date.parse(b.lastAttemptAt) : -Infinity;
    if (tb !== ta) return tb - ta;
    // tie: lessonId ASC
    return a.lessonId < b.lessonId ? -1 : a.lessonId > b.lessonId ? 1 : 0;
  });
  return inProgress[0].lessonId;
}

function metaForLesson(state: SkillNodeState, lp: LessonProgress | undefined): string {
  switch (state) {
    case 'completed':
      return 'Mastered';
    case 'current':
      return `In progress · ${lp?.passedExercises ?? 0} of ${lp?.totalExercises ?? 0}`;
    case 'available':
      return 'Tap to start';
    case 'locked':
      return 'Locked';
  }
}

export function chunkLessonsIntoSections(
  trackTitle: string,
  lessons: LessonSummary[],
  progress: TrackProgress | null,
  size: number = DEFAULT_SECTION_SIZE,
): TreeSection[] {
  if (lessons.length === 0) return [];

  const progressByLessonId = new Map<string, LessonProgress>();
  for (const lp of progress?.lessons ?? []) progressByLessonId.set(lp.lessonId, lp);

  const currentLessonId = pickCurrentLessonId(lessons, progressByLessonId);

  // Chunk into raw sections.
  const chunks: LessonSummary[][] = [];
  for (let i = 0; i < lessons.length; i += size) {
    chunks.push(lessons.slice(i, i + size));
  }

  // First pass: progressPct + done.
  const sections: TreeSection[] = chunks.map((chunk, index) => {
    const completedCount = chunk.filter(
      (l) => progressByLessonId.get(l.id)?.state === 'complete',
    ).length;
    const progressPct = Math.round((100 * completedCount) / chunk.length);
    const done = progressPct === 100;
    const firstLevel = chunk[0]?.level ?? 'foundation';
    const minutesPerLesson = MINUTES_PER_LEVEL[firstLevel] ?? FALLBACK_MINUTES_PER_LESSON;
    const minutes = chunk.length * minutesPerLesson;
    return {
      index,
      title: `${trackTitle} · Part ${index + 1}`,
      meta: `${chunk.length} lessons · ~${minutes} min`,
      progressPct,
      done,
      locked: false, // filled in next pass
      nodes: [], // filled in next pass
    };
  });

  // Second pass: locks (cascading).
  for (let i = 1; i < sections.length; i++) {
    sections[i].locked = sections.slice(0, i).some((s) => s.progressPct < 100);
  }

  // Third pass: node states.
  for (let i = 0; i < sections.length; i++) {
    const section = sections[i];
    const chunk = chunks[i];
    section.nodes = chunk.map((l) => {
      const lp = progressByLessonId.get(l.id);
      let state: SkillNodeState;
      if (section.locked) {
        state = 'locked';
      } else if (lp?.state === 'complete') {
        state = 'completed';
      } else if (lp?.state === 'in_progress' && l.id === currentLessonId) {
        state = 'current';
      } else {
        state = 'available';
      }
      return {
        lessonId: l.id,
        title: l.title,
        level: l.level ?? 'foundation',
        state,
        meta: metaForLesson(state, lp),
      };
    });
  }

  return sections;
}
```

- [ ] **Step 4: Run the test (expect PASS)**

```bash
npm test -- sections.test
```

Expected: PASS, all ~16 cases. If any fail, fix the implementation before continuing.

- [ ] **Step 5: Typecheck**

```bash
npx tsc --noEmit
```

Expected: clean.

- [ ] **Step 6: Commit**

```bash
git add lib/sections.ts lib/sections.test.ts
git commit -m "$(cat <<'EOF'
feat(tracks): add lib/sections.ts chunker + tests

Frontend chunker that groups a flat lesson list into TreeSection rows
with section-level locks, single-current-node selection (most-recent
lastAttemptAt with lessonId ASC tiebreak, null sorts last), and meta
copy driven by per-level minute estimates (foundation=4, intermediate=6,
advanced=8, unknown→5 per lesson). Default size 6 lessons per section.

When curriculum tooling adds real Section grouping, swap the chunker
for a passthrough that uses backend-supplied groupings. Per-level
minute estimates lift to a shared config when E (Lesson Player)
introduces a second consumer.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

Expected: one commit, two files.

---

## Task T4: `TreeNode` component + tests

**Files:**
- Create: `components/tracks/TreeNode.tsx`
- Test: `components/tracks/TreeNode.test.tsx`

- [ ] **Step 1: Write the failing test**

Create `components/tracks/TreeNode.test.tsx`:

```tsx
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { TreeNode } from './TreeNode';
import type { TreeNode as TreeNodeData } from '@/lib/sections';

function node(overrides: Partial<TreeNodeData> = {}): TreeNodeData {
  return {
    lessonId: 'L1',
    title: 'Variables & types',
    level: 'foundation',
    state: 'available',
    meta: 'Tap to start',
    ...overrides,
  };
}

describe('TreeNode', () => {
  it('renders title and meta', () => {
    render(<TreeNode node={node()} index={0} tint="swift" onSelect={() => {}} />);
    expect(screen.getByText('Variables & types')).toBeInTheDocument();
    expect(screen.getByText('Tap to start')).toBeInTheDocument();
  });

  it('renders SkillNode with state and tint', () => {
    const { container } = render(<TreeNode node={node({ state: 'completed' })} index={0} tint="kotlin" onSelect={() => {}} />);
    const btn = container.querySelector('button.node');
    expect(btn).toBeInTheDocument();
    expect(btn?.classList.contains('completed')).toBe(true);
    expect(btn?.classList.contains('tint-kotlin')).toBe(true);
  });

  it('fires onSelect with lessonId when state is available', () => {
    const onSelect = vi.fn();
    render(<TreeNode node={node({ state: 'available' })} index={0} tint="swift" onSelect={onSelect} />);
    fireEvent.click(screen.getByRole('button'));
    expect(onSelect).toHaveBeenCalledWith('L1');
  });

  it('fires onSelect when state is current', () => {
    const onSelect = vi.fn();
    render(<TreeNode node={node({ state: 'current' })} index={0} tint="swift" onSelect={onSelect} />);
    fireEvent.click(screen.getByRole('button'));
    expect(onSelect).toHaveBeenCalledWith('L1');
  });

  it('fires onSelect when state is completed (review)', () => {
    const onSelect = vi.fn();
    render(<TreeNode node={node({ state: 'completed' })} index={0} tint="swift" onSelect={onSelect} />);
    fireEvent.click(screen.getByRole('button'));
    expect(onSelect).toHaveBeenCalledWith('L1');
  });

  it('does NOT fire onSelect when state is locked (button is disabled)', () => {
    const onSelect = vi.fn();
    render(<TreeNode node={node({ state: 'locked' })} index={0} tint="swift" onSelect={onSelect} />);
    fireEvent.click(screen.getByRole('button'));
    expect(onSelect).not.toHaveBeenCalled();
  });

  it('zigzag offset: even index → -90 + sin(0)*20 = -90', () => {
    const { container } = render(<TreeNode node={node()} index={0} tint="swift" onSelect={() => {}} />);
    const inner = container.querySelector('.tree-row > div') as HTMLElement;
    expect(inner.style.transform).toBe('translateX(-90px)');
  });

  it('zigzag offset: odd index → +90 + sin(1)*20 ≈ 106.83', () => {
    const { container } = render(<TreeNode node={node()} index={1} tint="swift" onSelect={() => {}} />);
    const inner = container.querySelector('.tree-row > div') as HTMLElement;
    // sin(1) ≈ 0.8414709848...; +90 + sin(1)*20 ≈ 106.8294...
    const px = parseFloat(inner.style.transform.replace('translateX(', '').replace('px)', ''));
    expect(px).toBeCloseTo(90 + Math.sin(1) * 20, 4);
  });

  it('renders inside a .tree-row container', () => {
    const { container } = render(<TreeNode node={node()} index={0} tint="swift" onSelect={() => {}} />);
    expect(container.querySelector('.tree-row')).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run the test (expect FAIL)**

```bash
npm test -- TreeNode
```

Expected: FAIL — `Cannot find module './TreeNode'`.

- [ ] **Step 3: Create the component**

Create `components/tracks/TreeNode.tsx`:

```tsx
'use client';
import { Icon, type IconName } from '@/components/ui/Icon';
import { SkillNode, type SkillNodeTint } from '@/components/ui/SkillNode';
import type { TreeNode as TreeNodeData } from '@/lib/sections';

const ICON_FOR_STATE: Record<TreeNodeData['state'], IconName> = {
  completed: 'check',
  current: 'play',
  available: 'play',
  locked: 'lock',
};

const ICON_SIZE_FOR_STATE: Record<TreeNodeData['state'], number> = {
  completed: 24,
  current: 20,
  available: 20,
  locked: 20,
};

export type TreeNodeProps = {
  node: TreeNodeData;
  index: number;
  tint: SkillNodeTint;
  onSelect: (lessonId: string) => void;
};

export function TreeNode({ node, index, tint, onSelect }: TreeNodeProps) {
  const offset = (index % 2 === 0 ? -90 : 90) + Math.sin(index) * 20;
  return (
    <div className="tree-row">
      <div
        style={{
          transform: `translateX(${offset}px)`,
          position: 'relative',
          display: 'flex',
          alignItems: 'center',
          gap: 16,
        }}
      >
        <SkillNode
          state={node.state}
          tint={tint}
          onClick={() => onSelect(node.lessonId)}
          aria-label={node.title}
        >
          <Icon name={ICON_FOR_STATE[node.state]} size={ICON_SIZE_FOR_STATE[node.state]} />
        </SkillNode>
        <div>
          <div style={{ fontWeight: 600, fontSize: 'var(--t-sm)' }}>{node.title}</div>
          <div className="mono muted" style={{ fontSize: 'var(--t-2xs)', marginTop: 2 }}>
            {node.meta}
          </div>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Run the test (expect PASS)**

```bash
npm test -- TreeNode
```

Expected: PASS, 9 cases.

- [ ] **Step 5: Typecheck**

```bash
npx tsc --noEmit
```

Expected: clean.

- [ ] **Step 6: Commit**

```bash
git add components/tracks/TreeNode.tsx components/tracks/TreeNode.test.tsx
git commit -m "$(cat <<'EOF'
feat(tracks): TreeNode component + tests

Pure presentational tree row consuming the SkillNode primitive (A) with
the procedural zigzag offset (i % 2 === 0 ? -90 : 90) + sin(i)*20.
Locked nodes render a disabled button (SkillNode handles the disabled
attr); all other states are clickable and fire onSelect with the lessonId.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

Expected: one commit.

---

## Task T5: `TreeSection` component + tests

**Files:**
- Create: `components/tracks/TreeSection.tsx`
- Test: `components/tracks/TreeSection.test.tsx`

- [ ] **Step 1: Write the failing test**

Create `components/tracks/TreeSection.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { TreeSection } from './TreeSection';
import type { TreeSection as TreeSectionData, TreeNode as TreeNodeData } from '@/lib/sections';

function nodeData(overrides: Partial<TreeNodeData> = {}): TreeNodeData {
  return {
    lessonId: 'L1',
    title: 'Lesson 1',
    level: 'foundation',
    state: 'available',
    meta: 'Tap to start',
    ...overrides,
  };
}

function section(overrides: Partial<TreeSectionData> = {}): TreeSectionData {
  return {
    index: 0,
    title: 'Swift · Part 1',
    meta: '6 lessons · ~24 min',
    progressPct: 50,
    done: false,
    locked: false,
    nodes: [nodeData(), nodeData({ lessonId: 'L2', title: 'Lesson 2' })],
    ...overrides,
  };
}

describe('TreeSection', () => {
  it('renders the section title and meta', () => {
    render(<TreeSection section={section()} tint="swift" onSelectLesson={() => {}} />);
    expect(screen.getByText('Swift · Part 1')).toBeInTheDocument();
    expect(screen.getByText('6 lessons · ~24 min')).toBeInTheDocument();
  });

  it('renders progress bar fill matching progressPct', () => {
    const { container } = render(<TreeSection section={section({ progressPct: 65 })} tint="swift" onSelectLesson={() => {}} />);
    const fill = container.querySelector('.bar-fill') as HTMLElement;
    expect(fill.style.width).toBe('65%');
    expect(screen.getByText('65%')).toBeInTheDocument();
  });

  it('section-head icon: book when in progress', () => {
    const { container } = render(<TreeSection section={section({ done: false, locked: false })} tint="swift" onSelectLesson={() => {}} />);
    expect(container.querySelector('[data-section-head-icon="book"]')).toBeInTheDocument();
  });

  it('section-head icon: check when done', () => {
    const { container } = render(<TreeSection section={section({ done: true, locked: false, progressPct: 100 })} tint="swift" onSelectLesson={() => {}} />);
    expect(container.querySelector('[data-section-head-icon="check"]')).toBeInTheDocument();
  });

  it('section-head icon: lock when locked', () => {
    const { container } = render(<TreeSection section={section({ locked: true, progressPct: 0, nodes: [nodeData({ state: 'locked', meta: 'Locked' })] })} tint="swift" onSelectLesson={() => {}} />);
    expect(container.querySelector('[data-section-head-icon="lock"]')).toBeInTheDocument();
  });

  it('renders one TreeNode per node entry', () => {
    const { container } = render(<TreeSection section={section()} tint="swift" onSelectLesson={() => {}} />);
    const buttons = container.querySelectorAll('button.node');
    expect(buttons).toHaveLength(2);
  });

  it('renders milestone row when NOT locked', () => {
    const { container } = render(<TreeSection section={section({ locked: false })} tint="swift" onSelectLesson={() => {}} />);
    expect(container.querySelector('.medal')).toBeInTheDocument();
  });

  it('does NOT render milestone row when locked', () => {
    const { container } = render(<TreeSection section={section({ locked: true, progressPct: 0, nodes: [nodeData({ state: 'locked' })] })} tint="swift" onSelectLesson={() => {}} />);
    expect(container.querySelector('.medal')).toBeNull();
  });

  it('milestone copy is "Section badge" when not done', () => {
    render(<TreeSection section={section({ done: false, progressPct: 50 })} tint="swift" onSelectLesson={() => {}} />);
    expect(screen.getByText('Section badge')).toBeInTheDocument();
  });

  it('milestone copy is "Badge earned" when done', () => {
    render(<TreeSection section={section({ done: true, progressPct: 100 })} tint="swift" onSelectLesson={() => {}} />);
    expect(screen.getByText('Badge earned')).toBeInTheDocument();
  });

  it('trophy element is decorative (aria-hidden)', () => {
    const { container } = render(<TreeSection section={section({ done: true, progressPct: 100 })} tint="swift" onSelectLesson={() => {}} />);
    const medal = container.querySelector('.medal');
    expect(medal?.getAttribute('aria-hidden')).toBe('true');
  });

  it('applies the tint to the .tree-track', () => {
    const { container } = render(<TreeSection section={section()} tint="kotlin" onSelectLesson={() => {}} />);
    expect(container.querySelector('.tree-track.tint-kotlin')).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run the test (expect FAIL)**

```bash
npm test -- TreeSection
```

Expected: FAIL — module not found.

- [ ] **Step 3: Create the component**

Create `components/tracks/TreeSection.tsx`:

```tsx
'use client';
import { Icon, type IconName } from '@/components/ui/Icon';
import type { SkillNodeTint } from '@/components/ui/SkillNode';
import type { TreeSection as TreeSectionData } from '@/lib/sections';
import { TreeNode } from './TreeNode';

function headIconName(s: TreeSectionData): IconName {
  if (s.done) return 'check';
  if (s.locked) return 'lock';
  return 'book';
}

function headIconStyle(s: TreeSectionData): React.CSSProperties {
  if (s.done) {
    return {
      background: 'color-mix(in oklch, var(--success-400) 22%, var(--bg-2))',
      color: 'var(--success-400)',
      borderColor: 'color-mix(in oklch, var(--success-400) 40%, transparent)',
    };
  }
  if (s.locked) {
    return {
      background: 'var(--bg-2)',
      color: 'var(--text-3)',
      borderColor: 'var(--line-2)',
    };
  }
  return {
    background: 'var(--bg-3)',
    color: 'var(--text-1)',
    borderColor: 'var(--line-2)',
  };
}

export type TreeSectionProps = {
  section: TreeSectionData;
  tint: SkillNodeTint;
  onSelectLesson: (lessonId: string) => void;
};

export function TreeSection({ section, tint, onSelectLesson }: TreeSectionProps) {
  const icon = headIconName(section);
  return (
    <div className="tree-section">
      <div className="tree-section-head">
        <div
          className="lesson-icon"
          data-section-head-icon={icon}
          style={headIconStyle(section)}
        >
          <Icon name={icon} size={20} />
        </div>
        <div style={{ flex: 1 }}>
          <h3 className="h3">{section.title}</h3>
          <div className="muted mono" style={{ fontSize: 'var(--t-xs)', marginTop: 4 }}>
            {section.meta}
          </div>
        </div>
        <div style={{ width: 160 }}>
          <div className="bar">
            <div className="bar-fill" style={{ width: `${section.progressPct}%` }} />
          </div>
          <div
            className="mono muted"
            style={{ fontSize: 'var(--t-xs)', textAlign: 'right', marginTop: 6 }}
          >
            {section.progressPct}%
          </div>
        </div>
      </div>

      <div className={`tree-track tint-${tint}`}>
        {section.nodes.map((n, i) => (
          <TreeNode
            key={n.lessonId}
            node={n}
            index={i}
            tint={tint}
            onSelect={onSelectLesson}
          />
        ))}

        {!section.locked && (
          <div className="tree-row">
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
              <div
                className="medal"
                aria-hidden="true"
                style={section.done ? undefined : { filter: 'grayscale(0.4)', opacity: 0.7 }}
              >
                <Icon name="trophy" size={32} />
              </div>
              <div
                className="mono"
                style={{
                  fontSize: 'var(--t-xs)',
                  color: section.done ? 'var(--amber-300)' : 'var(--text-3)',
                }}
              >
                {section.done ? 'Badge earned' : 'Section badge'}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Run the test (expect PASS)**

```bash
npm test -- TreeSection
```

Expected: PASS, 12 cases.

- [ ] **Step 5: Typecheck**

```bash
npx tsc --noEmit
```

Expected: clean.

- [ ] **Step 6: Commit**

```bash
git add components/tracks/TreeSection.tsx components/tracks/TreeSection.test.tsx
git commit -m "$(cat <<'EOF'
feat(tracks): TreeSection component + tests

Renders section head (state-themed icon + title + meta + progress bar)
and the .tree-track containing TreeNodes plus a decorative milestone
medal at the end (only when !locked). Milestone copy is hard-coded
("Badge earned" when done, else "Section badge"); F (Profile/gamification)
will wire it to real useBadges data.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task T6: `TreePageHead` component + tests

**Files:**
- Create: `components/tracks/TreePageHead.tsx`
- Test: `components/tracks/TreePageHead.test.tsx`

- [ ] **Step 1: Write the failing test**

Create `components/tracks/TreePageHead.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { TreePageHead } from './TreePageHead';

describe('TreePageHead', () => {
  it('renders eyebrow with capitalized track name', () => {
    render(<TreePageHead trackTitle="Swift Foundations" language="swift" totalLessons={26} completedLessons={4} />);
    expect(screen.getByText('Skill tree · Swift track')).toBeInTheDocument();
  });

  it('renders eyebrow for Kotlin', () => {
    render(<TreePageHead trackTitle="Kotlin" language="kotlin" totalLessons={10} completedLessons={0} />);
    expect(screen.getByText('Skill tree · Kotlin track')).toBeInTheDocument();
  });

  it('renders the h-display headline', () => {
    render(<TreePageHead trackTitle="Swift" language="swift" totalLessons={1} completedLessons={0} />);
    const h1 = screen.getByRole('heading', { level: 1 });
    expect(h1).toHaveTextContent('Your path forward.');
    expect(h1.classList.contains('h-display')).toBe(true);
  });

  it('renders the muted intro copy', () => {
    render(<TreePageHead trackTitle="Swift" language="swift" totalLessons={1} completedLessons={0} />);
    expect(screen.getByText(/Sections unlock as you master the previous one/)).toBeInTheDocument();
  });

  it('renders language badge with iris tint for Swift', () => {
    const { container } = render(<TreePageHead trackTitle="Swift" language="swift" totalLessons={1} completedLessons={0} />);
    expect(container.querySelector('.badge.badge-iris')).toBeInTheDocument();
  });

  it('renders language badge with amber tint for Kotlin', () => {
    const { container } = render(<TreePageHead trackTitle="Kotlin" language="kotlin" totalLessons={1} completedLessons={0} />);
    expect(container.querySelector('.badge.badge-amber')).toBeInTheDocument();
  });

  it('renders "X of Y lessons" badge', () => {
    render(<TreePageHead trackTitle="Swift" language="swift" totalLessons={26} completedLessons={4} />);
    expect(screen.getByText('4 of 26 lessons')).toBeInTheDocument();
  });

  it('falls back to a neutral badge for unknown languages', () => {
    const { container } = render(<TreePageHead trackTitle="Mystery" language="rust" totalLessons={1} completedLessons={0} />);
    const langBadge = container.querySelectorAll('.badge')[0];
    // Rust → no iris/amber tint applied; default `.badge` only.
    expect(langBadge.classList.contains('badge-iris')).toBe(false);
    expect(langBadge.classList.contains('badge-amber')).toBe(false);
  });
});
```

- [ ] **Step 2: Run the test (expect FAIL)**

```bash
npm test -- TreePageHead
```

Expected: FAIL — module not found.

- [ ] **Step 3: Create the component**

Create `components/tracks/TreePageHead.tsx`:

```tsx
'use client';
import { cn } from '@/components/ui/cn';

const LANGUAGE_BADGE_TINT: Record<string, string> = {
  swift: 'badge-iris',
  kotlin: 'badge-amber',
};

function languageDisplayName(language: string): string {
  if (language === 'swift') return 'Swift';
  if (language === 'kotlin') return 'Kotlin';
  return language.charAt(0).toUpperCase() + language.slice(1);
}

export type TreePageHeadProps = {
  trackTitle: string;
  language: string;
  totalLessons: number;
  completedLessons: number;
};

export function TreePageHead({ trackTitle, language, totalLessons, completedLessons }: TreePageHeadProps) {
  const langName = languageDisplayName(language);
  const langBadgeTint = LANGUAGE_BADGE_TINT[language];
  return (
    <div className="page-head">
      <div>
        <div className="eyebrow" style={{ marginBottom: 10 }}>
          Skill tree · {langName} track
        </div>
        <h1 className="h-display">Your path forward.</h1>
        <p className="muted" style={{ marginTop: 8, fontSize: 'var(--t-lg)' }}>
          Sections unlock as you master the previous one. Tap any node to begin.
        </p>
      </div>
      <div className="row" style={{ gap: 8 }}>
        <span className={cn('badge', langBadgeTint)}>
          <span className="badge-dot" />
          {langName}
        </span>
        <span className="badge">
          <span className="badge-dot" />
          {completedLessons} of {totalLessons} lessons
        </span>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Run the test (expect PASS)**

```bash
npm test -- TreePageHead
```

Expected: PASS, 8 cases.

- [ ] **Step 5: Commit**

```bash
git add components/tracks/TreePageHead.tsx components/tracks/TreePageHead.test.tsx
git commit -m "$(cat <<'EOF'
feat(tracks): TreePageHead component + tests

Page-head with eyebrow ("Skill tree · {Language} track"), h-display
headline ("Your path forward."), muted intro, and right-side row of
two badges (language tint + lesson count). Unknown languages render
without an iris/amber tint (capitalized name still shows).

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task T7: `TreeSkeleton` placeholder

**Files:**
- Create: `components/tracks/TreeSkeleton.tsx`

No test (visual placeholder). Follows the same inline-style pattern as `DashboardSkeleton.tsx` (Sub-project C) — there is no shared `.skeleton` class, just `background: var(--bg-3)` rectangles.

- [ ] **Step 1: Create the component**

Create `components/tracks/TreeSkeleton.tsx`:

```tsx
'use client';

const BLOCK = { background: 'var(--bg-3)', borderRadius: 4 } as const;
const CIRCLE = { background: 'var(--bg-3)', borderRadius: '50%' } as const;

export function TreeSkeleton() {
  return (
    <div className="tree-wrap" data-testid="tree-skeleton" aria-busy="true">
      {[0, 1, 2].map((s) => (
        <div className="tree-section" key={s}>
          <div className="tree-section-head">
            <div style={{ ...CIRCLE, width: 48, height: 48 }} />
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6 }}>
              <div style={{ ...BLOCK, width: '60%', height: 18 }} />
              <div style={{ ...BLOCK, width: '30%', height: 12 }} />
            </div>
            <div style={{ ...BLOCK, width: 160, height: 14 }} />
          </div>
          <div className="tree-track">
            {[0, 1, 2, 3].map((r) => {
              const offset = (r % 2 === 0 ? -90 : 90) + Math.sin(r) * 20;
              return (
                <div className="tree-row" key={r}>
                  <div
                    style={{
                      transform: `translateX(${offset}px)`,
                      display: 'flex',
                      alignItems: 'center',
                      gap: 16,
                    }}
                  >
                    <div style={{ ...CIRCLE, width: 64, height: 64 }} />
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                      <div style={{ ...BLOCK, width: 140, height: 14 }} />
                      <div style={{ ...BLOCK, width: 80, height: 10 }} />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
```

- [ ] **Step 2: Typecheck**

```bash
npx tsc --noEmit
```

Expected: clean.

- [ ] **Step 3: Commit**

```bash
git add components/tracks/TreeSkeleton.tsx
git commit -m "$(cat <<'EOF'
feat(tracks): TreeSkeleton placeholder

Three skeleton sections × four rows each, mirroring the real tree
structure (zigzag offset, section head, lesson rows). Uses inline
var(--bg-3) blocks/circles, matching the existing DashboardSkeleton
pattern from Sub-project C.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task T8: Rewrite `/tracks/page.tsx`

**Files:**
- Rewrite: `app/(authed)/tracks/page.tsx`
- Test: `app/(authed)/tracks/page.test.tsx`

**Note:** This task replaces the legacy track-index UI. The old file imports `pickContinuePrompt` and uses `AppShell` — both go away. The new file consumes `useActiveTrack` (from C), `chunkLessonsIntoSections` (T3), and the three components from T4-T7.

- [ ] **Step 1: Write the failing test**

Create `app/(authed)/tracks/page.test.tsx`:

```tsx
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import TracksPage from './page';
import * as trackContext from '@/lib/track-context';
import * as tracksLib from '@/lib/tracks';
import * as progressLib from '@/lib/progress';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
}));

const mockUseActiveTrack = vi.spyOn(trackContext, 'useActiveTrack');
const mockFetchTrack = vi.spyOn(tracksLib, 'fetchTrack');
const mockFetchProgress = vi.spyOn(progressLib, 'fetchTrackProgress');

beforeEach(() => {
  mockUseActiveTrack.mockReset();
  mockFetchTrack.mockReset();
  mockFetchProgress.mockReset();
});

afterEach(() => {
  vi.restoreAllMocks();
});

const swiftTrack = {
  id: 'swift',
  title: 'Swift Foundations',
  description: 'Swift desc',
  language: 'swift',
  kind: 'foundation',
  version: 1,
  lessonCount: 6,
  starterRepoUrl: null,
  lessons: Array.from({ length: 6 }, (_, i) => ({
    id: `L${i + 1}`,
    version: 1,
    title: `Lesson ${i + 1}`,
    summary: '',
    position: i + 1,
    level: 'foundation',
  })),
};

describe('TracksPage', () => {
  it('renders TreeSkeleton while track context is loading', () => {
    mockUseActiveTrack.mockReturnValue({ trackId: null, tracks: [], setTrackId: vi.fn(), loading: true });
    render(<TracksPage />);
    expect(screen.getByTestId('tree-skeleton')).toBeInTheDocument();
  });

  it('renders empty-track state when no active trackId after loading', () => {
    mockUseActiveTrack.mockReturnValue({ trackId: null, tracks: [], setTrackId: vi.fn(), loading: false });
    render(<TracksPage />);
    expect(screen.getByText(/Pick a track from the topbar/i)).toBeInTheDocument();
  });

  it('renders inline error with retry when fetchTrack rejects', async () => {
    mockUseActiveTrack.mockReturnValue({ trackId: 'swift', tracks: [swiftTrack as any], setTrackId: vi.fn(), loading: false });
    mockFetchTrack.mockRejectedValueOnce(new Error('boom'));
    mockFetchProgress.mockResolvedValueOnce(null);
    render(<TracksPage />);
    await waitFor(() => expect(screen.getByText('boom')).toBeInTheDocument());
    expect(screen.getByRole('button', { name: /retry/i })).toBeInTheDocument();
  });

  it('renders the tree with no progress when fetchTrackProgress fails', async () => {
    mockUseActiveTrack.mockReturnValue({ trackId: 'swift', tracks: [swiftTrack as any], setTrackId: vi.fn(), loading: false });
    mockFetchTrack.mockResolvedValueOnce(swiftTrack as any);
    mockFetchProgress.mockRejectedValueOnce(new Error('progress fail'));
    render(<TracksPage />);
    await waitFor(() => expect(screen.getByText('Swift Foundations · Part 1')).toBeInTheDocument());
    // All 6 lessons available (no progress) — first section has 6 buttons.
    const buttons = document.querySelectorAll('button.node');
    expect(buttons).toHaveLength(6);
  });

  it('renders empty-lessons state for a track with zero lessons', async () => {
    mockUseActiveTrack.mockReturnValue({ trackId: 'swift', tracks: [{ ...swiftTrack, lessons: [] } as any], setTrackId: vi.fn(), loading: false });
    mockFetchTrack.mockResolvedValueOnce({ ...swiftTrack, lessons: [] } as any);
    mockFetchProgress.mockResolvedValueOnce(null);
    render(<TracksPage />);
    await waitFor(() => expect(screen.getByText(/No lessons in this track yet/i)).toBeInTheDocument());
  });

  it('renders the tree happy path: page-head + section + lesson nodes', async () => {
    mockUseActiveTrack.mockReturnValue({ trackId: 'swift', tracks: [swiftTrack as any], setTrackId: vi.fn(), loading: false });
    mockFetchTrack.mockResolvedValueOnce(swiftTrack as any);
    mockFetchProgress.mockResolvedValueOnce(null);
    render(<TracksPage />);
    await waitFor(() => expect(screen.getByText('Swift Foundations · Part 1')).toBeInTheDocument());
    expect(screen.getByText('Your path forward.')).toBeInTheDocument();
    expect(screen.getByText('0 of 6 lessons')).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run the test (expect FAIL)**

```bash
npm test -- "tracks/page.test"
```

Expected: FAIL — the new shape doesn't match the old `page.tsx` exports / behavior. Some tests may load the old module and fail on missing mocks; that's fine.

- [ ] **Step 3: Replace `app/(authed)/tracks/page.tsx`**

Overwrite `app/(authed)/tracks/page.tsx` with:

```tsx
'use client';
import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useActiveTrack } from '@/lib/track-context';
import { fetchTrack, type TrackDetail } from '@/lib/tracks';
import { fetchTrackProgress, type TrackProgress } from '@/lib/progress';
import { chunkLessonsIntoSections } from '@/lib/sections';
import { TreePageHead } from '@/components/tracks/TreePageHead';
import { TreeSection } from '@/components/tracks/TreeSection';
import { TreeSkeleton } from '@/components/tracks/TreeSkeleton';
import type { SkillNodeTint } from '@/components/ui/SkillNode';

function NarrowMain({ children }: { children: React.ReactNode }) {
  return <div className="main-narrow">{children}</div>;
}

function EmptyTrackState() {
  return (
    <div className="card" style={{ padding: 24, marginTop: 32 }}>
      <h2 className="h3" style={{ marginBottom: 8 }}>No active track</h2>
      <p className="muted">Pick a track from the topbar switcher to see your skill tree.</p>
    </div>
  );
}

function InlineError({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="card" style={{ marginTop: 32, padding: 24 }}>
      <h3 className="h3" style={{ marginBottom: 8 }}>Couldn&apos;t load track</h3>
      <p className="muted">{message}</p>
      <button type="button" onClick={onRetry} className="btn btn-primary" style={{ marginTop: 16 }}>
        Retry
      </button>
    </div>
  );
}

export default function TracksPage() {
  const router = useRouter();
  const { trackId, tracks, loading: trackLoading } = useActiveTrack();
  const [detail, setDetail] = useState<TrackDetail | null>(null);
  const [progress, setProgress] = useState<TrackProgress | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!trackId) {
      setDetail(null);
      setProgress(null);
      return;
    }
    setError(null);
    setDetail(null);
    setProgress(null);
    try {
      const [t, p] = await Promise.all([
        fetchTrack(trackId),
        fetchTrackProgress(trackId).catch(() => null),
      ]);
      if (!t) {
        setError('Track not found');
        return;
      }
      setDetail(t);
      setProgress(p);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load track');
    }
  }, [trackId]);

  useEffect(() => {
    void load();
  }, [load]);

  if (trackLoading || (trackId && !detail && !error)) {
    return <NarrowMain><TreeSkeleton /></NarrowMain>;
  }
  if (!trackLoading && !trackId) {
    return <NarrowMain><EmptyTrackState /></NarrowMain>;
  }
  if (error) {
    return <NarrowMain><InlineError message={error} onRetry={load} /></NarrowMain>;
  }
  if (!detail) {
    return <NarrowMain><TreeSkeleton /></NarrowMain>;
  }

  const sections = chunkLessonsIntoSections(detail.title, detail.lessons, progress);
  const totalLessons = detail.lessons.length;
  const completedLessons = sections.reduce(
    (acc, s) => acc + s.nodes.filter((n) => n.state === 'completed').length,
    0,
  );
  const tint: SkillNodeTint =
    detail.language === 'kotlin' ? 'kotlin' :
    detail.language === 'swift'  ? 'swift'  : 'shared';

  return (
    <NarrowMain>
      <TreePageHead
        trackTitle={detail.title}
        language={detail.language}
        totalLessons={totalLessons}
        completedLessons={completedLessons}
      />
      {sections.length === 0 ? (
        <p className="muted" style={{ marginTop: 32 }}>No lessons in this track yet.</p>
      ) : (
        <div className="tree-wrap">
          {sections.map((s) => (
            <TreeSection
              key={s.index}
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
```

- [ ] **Step 4: Run the test (expect PASS)**

```bash
npm test -- "tracks/page.test"
```

Expected: PASS, 6 cases. If any test fails, fix the implementation. The most common cause is a state-flow issue — re-read the conditional render guards.

- [ ] **Step 5: Run the full vitest suite to catch any regression**

```bash
npm test
```

Expected: PASS. Note that `tests/tracks/continue.test.ts` tests `pickContinuePrompt` (still exists in `lib/progress.ts`) and `tests/tracks/smartCta.test.ts` tests `smartTrackCta` (still exists). Both should still pass — the deletions happen in T11.

- [ ] **Step 6: Typecheck**

```bash
npx tsc --noEmit
```

Expected: clean.

- [ ] **Step 7: Commit**

```bash
git add app/(authed)/tracks/page.tsx app/(authed)/tracks/page.test.tsx
git commit -m "$(cat <<'EOF'
feat(tracks): rewrite /tracks/page.tsx to render the active-track tree

Drops the legacy track-index grid and renders the skill tree for the
active track instead. Composes TreePageHead + chunkLessonsIntoSections
+ TreeSection. Handles loading, no-active-track, error+retry,
zero-lessons, and happy-path states. Uses 'shared' tint as fallback
for unrecognized languages.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task T9: Convert `/tracks/[id]/page.tsx` to redirect

**Files:**
- Rewrite: `app/(authed)/tracks/[id]/page.tsx`
- Test: `app/(authed)/tracks/[id]/page.test.tsx`

- [ ] **Step 1: Write the failing test**

Create `app/(authed)/tracks/[id]/page.test.tsx`:

```tsx
import { render } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as nav from 'next/navigation';
import * as trackContext from '@/lib/track-context';
import TrackRedirectPage from './page';

vi.mock('next/navigation', () => ({
  useParams: vi.fn(),
  useRouter: vi.fn(),
}));

const mockUseActiveTrack = vi.spyOn(trackContext, 'useActiveTrack');

beforeEach(() => {
  vi.mocked(nav.useParams).mockReset();
  vi.mocked(nav.useRouter).mockReset();
  mockUseActiveTrack.mockReset();
});

const tracks = [
  { id: 'swift', title: 'Swift', description: '', language: 'swift', kind: 'foundation', version: 1, lessonCount: 6, starterRepoUrl: null },
  { id: 'kotlin', title: 'Kotlin', description: '', language: 'kotlin', kind: 'foundation', version: 1, lessonCount: 6, starterRepoUrl: null },
];

describe('TrackRedirectPage', () => {
  it('calls setTrackId and router.replace when ID exists in tracks', () => {
    const setTrackId = vi.fn();
    const replace = vi.fn();
    vi.mocked(nav.useParams).mockReturnValue({ id: 'swift' });
    vi.mocked(nav.useRouter).mockReturnValue({ replace, push: vi.fn() } as any);
    mockUseActiveTrack.mockReturnValue({ trackId: 'kotlin', tracks: tracks as any, setTrackId, loading: false });
    render(<TrackRedirectPage />);
    expect(setTrackId).toHaveBeenCalledWith('swift');
    expect(replace).toHaveBeenCalledWith('/tracks');
  });

  it('does NOT call setTrackId when ID is not in tracks but still redirects', () => {
    const setTrackId = vi.fn();
    const replace = vi.fn();
    vi.mocked(nav.useParams).mockReturnValue({ id: 'bogus' });
    vi.mocked(nav.useRouter).mockReturnValue({ replace, push: vi.fn() } as any);
    mockUseActiveTrack.mockReturnValue({ trackId: 'kotlin', tracks: tracks as any, setTrackId, loading: false });
    render(<TrackRedirectPage />);
    expect(setTrackId).not.toHaveBeenCalled();
    expect(replace).toHaveBeenCalledWith('/tracks');
  });

  it('does nothing while track context is loading', () => {
    const setTrackId = vi.fn();
    const replace = vi.fn();
    vi.mocked(nav.useParams).mockReturnValue({ id: 'swift' });
    vi.mocked(nav.useRouter).mockReturnValue({ replace, push: vi.fn() } as any);
    mockUseActiveTrack.mockReturnValue({ trackId: null, tracks: [], setTrackId, loading: true });
    render(<TrackRedirectPage />);
    expect(setTrackId).not.toHaveBeenCalled();
    expect(replace).not.toHaveBeenCalled();
  });

  it('renders null', () => {
    vi.mocked(nav.useParams).mockReturnValue({ id: 'swift' });
    vi.mocked(nav.useRouter).mockReturnValue({ replace: vi.fn(), push: vi.fn() } as any);
    mockUseActiveTrack.mockReturnValue({ trackId: null, tracks: tracks as any, setTrackId: vi.fn(), loading: false });
    const { container } = render(<TrackRedirectPage />);
    expect(container).toBeEmptyDOMElement();
  });
});
```

- [ ] **Step 2: Run the test (expect FAIL)**

```bash
npm test -- "tracks/\[id\]/page.test"
```

Expected: FAIL — the old module still imports `fetchTrack`, `TimelineLessonNode`, etc. and won't match the new test contract.

- [ ] **Step 3: Replace `app/(authed)/tracks/[id]/page.tsx`**

Overwrite the file with:

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

- [ ] **Step 4: Run the test (expect PASS)**

```bash
npm test -- "tracks/\[id\]/page.test"
```

Expected: PASS, 4 cases.

- [ ] **Step 5: Run the full vitest suite**

```bash
npm test
```

Expected: PASS. Legacy tests in `tests/tracks/` still pass — they test functions that still exist in `lib/progress.ts` (deletions are T11).

- [ ] **Step 6: Typecheck**

```bash
npx tsc --noEmit
```

Expected: clean.

- [ ] **Step 7: Commit**

```bash
git add app/(authed)/tracks/[id]/page.tsx app/(authed)/tracks/[id]/page.test.tsx
git commit -m "$(cat <<'EOF'
feat(tracks): convert /tracks/[id] to redirect route

Preserves direct-link bookmarks (e.g., /tracks/swift-foundations) by
calling setTrackId(id) — only when the ID exists in the user's tracks
list — then router.replace('/tracks'). The /tracks page handles any
"track not found" rendering downstream.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task T10: Playwright e2e

**Files:**
- Create: `tests/e2e/tracks.spec.ts`

**Note:** Existing e2e specs (`dashboard.spec.ts`, `lesson.spec.ts`) follow a fixture-driven pattern. Read `tests/e2e/global-setup.ts` first if anything in this task is unclear about test data — it seeds the dev fixtures and login state.

- [ ] **Step 1: Inspect existing e2e structure for the auth + nav pattern**

```bash
grep -l "page.goto\|describe\|test\b" tests/e2e/*.spec.ts | head -3
```

Expected: at least `dashboard.spec.ts` and `lesson.spec.ts`. Read the dashboard spec (`tests/e2e/dashboard.spec.ts`) to confirm the auth fixture pattern (typically `test.use({ storageState: ... })` set in global-setup).

- [ ] **Step 2: Create the e2e spec**

Create `tests/e2e/tracks.spec.ts`:

```ts
import { test, expect } from '@playwright/test';

test.describe('Tracks page', () => {
  test('renders the skill tree with at least one section and lesson node', async ({ page }) => {
    await page.goto('/tracks');
    // Page-head copy
    await expect(page.getByRole('heading', { name: 'Your path forward.' })).toBeVisible();
    // At least one section title — fixture has Swift active by default
    await expect(page.locator('.tree-section').first()).toBeVisible();
    await expect(page.locator('button.node').first()).toBeVisible();
  });

  test('clicking an available lesson node navigates to /lesson/{id}', async ({ page }) => {
    await page.goto('/tracks');
    // Find the first non-locked, non-completed node — should be `available` or `current`.
    const node = page.locator('button.node:not(.locked):not(.completed)').first();
    await node.click();
    await expect(page).toHaveURL(/\/lesson\/.+/);
  });

  test('locked nodes do not navigate (button disabled)', async ({ page }) => {
    await page.goto('/tracks');
    // Wait for tree
    await expect(page.locator('.tree-section').first()).toBeVisible();
    const lockedNodes = page.locator('button.node.locked');
    const count = await lockedNodes.count();
    if (count === 0) {
      test.skip(true, 'No locked nodes in fixture (all sections complete)');
    }
    const before = page.url();
    await lockedNodes.first().click({ force: true }).catch(() => {/* disabled buttons may reject click */});
    expect(page.url()).toBe(before);
  });

  test('sidebar Continue Lesson regression: still navigates to /tracks', async ({ page }) => {
    await page.goto('/dashboard');
    await page.getByRole('link', { name: /continue lesson/i }).click();
    await expect(page).toHaveURL(/\/tracks/);
  });

  test('redirect: /tracks/[id] sets the active track and lands on /tracks', async ({ page }) => {
    await page.goto('/tracks/kotlin');
    await expect(page).toHaveURL(/\/tracks$/);
    // The eyebrow should reflect the Kotlin track
    await expect(page.getByText(/Kotlin track/)).toBeVisible();
  });
});
```

- [ ] **Step 3: Run the e2e against a running dev server**

In one shell:

```bash
npm run dev
```

Wait for `Ready - started server on 0.0.0.0:3001`.

In another shell:

```bash
npm run test:e2e -- tests/e2e/tracks.spec.ts
```

Expected: PASS, 5 specs (one may auto-skip if the seeded fixture has no locked sections). If a test fails because the e2e fixture has different track IDs than `kotlin` / `swift`, adjust the IDs to match — the fixture lives at `tests/e2e/global-setup.ts`.

- [ ] **Step 4: Stop the dev server**

In the dev shell, Ctrl+C.

- [ ] **Step 5: Commit**

```bash
git add tests/e2e/tracks.spec.ts
git commit -m "$(cat <<'EOF'
test(e2e): tracks page navigation + node interactions

Five Playwright specs: tree renders, available-node navigation,
locked-node disabled-click regression, sidebar Continue Lesson
regression check (D5), and /tracks/[id] redirect behavior.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task T11: Delete legacy code + tests

**Files:**
- Delete: `components/tracks/TimelineLessonNode.tsx`
- Delete: `tests/tracks/timeline.test.tsx`
- Delete: `tests/tracks/smartCta.test.ts`
- Delete: `tests/tracks/continue.test.ts`
- Modify: `lib/progress.ts` (remove `pickContinuePrompt`, `ContinuePrompt` type, `smartTrackCta`)

- [ ] **Step 1: Confirm no live consumers of the doomed exports**

```bash
grep -rn "pickContinuePrompt\|smartTrackCta\|TimelineLessonNode\|\bContinuePrompt\b" \
  app/ components/ lib/ tests/ \
  --include="*.tsx" --include="*.ts" \
  | grep -v "lib/progress.ts" \
  | grep -v "tests/tracks/" \
  | grep -v "components/tracks/TimelineLessonNode.tsx"
```

Expected: empty. If any live consumer remains, stop and add the missing rewrite to T8/T9.

- [ ] **Step 2: Delete the four files**

```bash
rm components/tracks/TimelineLessonNode.tsx
rm tests/tracks/timeline.test.tsx
rm tests/tracks/smartCta.test.ts
rm tests/tracks/continue.test.ts
```

- [ ] **Step 3: Trim `lib/progress.ts`**

Open `lib/progress.ts` and remove:

1. The `ContinuePrompt` type export (likely in the type-export block near the top of the file).
2. The `smartTrackCta(...)` function (currently around line 63).
3. The `pickContinuePrompt(...)` function (currently around line 96).

Do NOT touch:
- `LessonProgressState`, `LessonProgress`, `TrackProgress`, `ConceptProgress`, `ConceptsProgress` types
- `fetchTrackProgress(trackId)` function
- The `BASE` constant
- Any other exports

After editing, run:

```bash
grep -n "pickContinuePrompt\|smartTrackCta\|ContinuePrompt" lib/progress.ts
```

Expected: empty.

- [ ] **Step 4: Verify the empty `tests/tracks/` directory cleanup**

```bash
ls tests/tracks/ 2>/dev/null
```

Expected: directory empty or not present. If empty:

```bash
rmdir tests/tracks/
```

- [ ] **Step 5: Typecheck**

```bash
npx tsc --noEmit
```

Expected: clean. If a downstream file still imports `pickContinuePrompt` / `smartTrackCta` / `TimelineLessonNode`, fix the consumer in this same task (it's a missed reference from T8/T9).

- [ ] **Step 6: Run the full vitest suite**

```bash
npm test
```

Expected: PASS. Test count should drop relative to before (legacy tests gone) but new test count from T3-T9 should bring totals to ~290-310.

- [ ] **Step 7: Run the build to confirm Next.js still type-checks pages**

```bash
npm run build
```

Expected: clean build. Watch for "module not found" errors — those mean a stale import slipped through.

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "$(cat <<'EOF'
chore(tracks): remove TimelineLessonNode, pickContinuePrompt, smartTrackCta + their tests

The legacy /tracks/[id] timeline component, the legacy /tracks index
helper (pickContinuePrompt + ContinuePrompt type), and the legacy
track-detail CTA helper (smartTrackCta) are all unused after T8/T9
rewrites. Their unit tests are deleted alongside.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

Expected: one commit, multiple file deletions + one file edit.

---

## Task T12: Verification + Merge

**Files:** none — verification + merge only.

- [ ] **Step 1: Run the full verification gate**

```bash
cd c:/tmp/bootcamp-web-tracks
npx tsc --noEmit && npm test && npm run build
```

Expected: all three green.

- [ ] **Step 2: Run e2e against dev**

In one shell:

```bash
npm run dev
```

In another:

```bash
npm run test:e2e
```

Expected: full e2e suite passes (existing dashboard/lesson/app-shell/design-system + new tracks).

- [ ] **Step 3: Stop the dev server (Ctrl+C in dev shell)**

- [ ] **Step 4: Manual smoke test**

Restart `npm run dev` and walk through these scenarios in a browser at `http://localhost:3001`:

  1. Sign in (storage-state should still be valid from e2e). Navigate to `/tracks`. Tree renders with the active track. Pulse animation visible on the `current` node (if any).
  2. Click an `available` node → lands on `/lesson/{id}`. Back-button → returns to `/tracks` with the same active track.
  3. Switch the track via the topbar `SegmentedControl` → `/tracks` rerenders the new track's tree.
  4. Direct-link `http://localhost:3001/tracks/swift` (or whichever track exists in the fixture) → redirects to `/tracks` with that track active. URL ends in `/tracks`.
  5. Direct-link `http://localhost:3001/tracks/bogus-id` → redirects to `/tracks`, no console error.
  6. Click the sidebar "Continue Lesson" button → lands on `/tracks`, current node pulsing.
  7. Toggle density via tweaks panel → tree CSS still respects density tokens (spacing should change).

If any scenario fails, stop and fix forward in a new commit on `feat/tracks`.

- [ ] **Step 5: Stop the dev server**

- [ ] **Step 6: Verify branch state before merge**

```bash
git -C c:/tmp/bootcamp-web-tracks log master..feat/tracks --oneline
git -C c:/tmp/bootcamp-web-tracks status --short
```

Expected: 11-12 commits on `feat/tracks`, clean working tree.

- [ ] **Step 7: Merge to master in the main checkout**

```bash
cd c:/Users/ricma/BootCamp/web
git checkout master
git merge --no-ff feat/tracks -m "merge: tracks design refactor — Sub-project D"
```

Expected: merge succeeds with no conflicts (feat/tracks branched off master and master hasn't moved).

- [ ] **Step 8: Run verification on master**

```bash
cd c:/Users/ricma/BootCamp/web
npm install  # in case lockfile drifted
npx tsc --noEmit && npm test && npm run build
```

Expected: all three green.

- [ ] **Step 9: Capture the new master SHA**

```bash
git -C c:/Users/ricma/BootCamp/web log master -1 --oneline
```

Expected: a new merge commit. Note the SHA — it'll be referenced when updating `NEXT-SESSION-PROMPT.md`.

- [ ] **Step 10: Clean up the worktree and feature branch**

```bash
git -C c:/Users/ricma/BootCamp/web branch -d feat/tracks
git -C c:/Users/ricma/BootCamp/web worktree remove c:/tmp/bootcamp-web-tracks
```

Expected: both succeed.

- [ ] **Step 11: Update `NEXT-SESSION-PROMPT.md`**

Edit `c:/Users/ricma/BootCamp/docs/superpowers/NEXT-SESSION-PROMPT.md` to:

1. Replace the title and intro (now resuming **E — Lesson Player** instead of D).
2. Replace `Web master is at 879211c.` with the new SHA from Step 9.
3. Replace the canonical-view-router checkmarks: `tree → SkillTree ✅ shipped (Sub-project D)`. Promote E (Lesson Player) to `⏳ THIS SUB-PROJECT (E)`.
4. Move D's locked decisions / Sections to a "Past sub-projects" entry: `**D — Tracks / Skill Tree.** Spec '2026-05-03-tracks-design.md', plan '2026-05-03-tracks-plan.md'. Merged 2026-05-03 at master '<NEW SHA>'. <N> commits.`
5. Open the door for E: bullet 5 exercise renderers + lesson-player chrome from `app-lesson.jsx`. Note any D-era patterns E should reuse (e.g., the redirect-route pattern, the load-on-`trackId` data flow).

- [ ] **Step 12: Commit the prompt update — DOCS-ONLY, no git repo at BootCamp root**

The BootCamp root is not git-tracked (only `web/`, `platform/`, etc. are). Save the file; no commit needed.

- [ ] **Step 13: Update memory**

Update `c:/Users/ricma/.claude/projects/c--Users-ricma-BootCamp/memory/bootcamp_platform_project.md` to add D to the merged sub-projects line, with the new master SHA.

---

## Summary

12 commits on `feat/tracks` branch off web `master@879211c`:

```
1. feat(styles): extend .main-narrow with margin-inline: auto
2. feat(styles): port tree-* + medal-* CSS slice into components.css
3. feat(tracks): add lib/sections.ts chunker + tests
4. feat(tracks): TreeNode component + tests
5. feat(tracks): TreeSection component + tests
6. feat(tracks): TreePageHead component + tests
7. feat(tracks): TreeSkeleton placeholder
8. feat(tracks): rewrite /tracks/page.tsx to render the active-track tree
9. feat(tracks): convert /tracks/[id] to redirect route
10. test(e2e): tracks page navigation + node interactions
11. chore(tracks): remove TimelineLessonNode, pickContinuePrompt, smartTrackCta + their tests
12. (merge) merge: tracks design refactor — Sub-project D
```

## Test plan

| Surface | Where | Cases |
|---|---|---|
| Chunker logic | `lib/sections.test.ts` (Vitest) | ~16 (empty, no-progress, mid, full-unlocks, locked, single-current, ties, null-attempt, custom size, foundation/intermediate/advanced/unknown meta, completed/available meta) |
| TreeNode primitive | `components/tracks/TreeNode.test.tsx` | 9 (states + tint + onSelect + zigzag + container) |
| TreeSection composition | `components/tracks/TreeSection.test.tsx` | 12 (head copy, progress bar, head icon × 3 states, node count, milestone gating × 2, milestone copy × 2, aria-hidden, tint) |
| TreePageHead | `components/tracks/TreePageHead.test.tsx` | 8 (eyebrow × 2 langs, h-display, intro, badge × 2 langs + unknown, lesson count) |
| Page integration | `app/(authed)/tracks/page.test.tsx` | 6 (loading, no-active-track, error+retry, progress-fail-graceful, zero-lessons, happy path) |
| Redirect | `app/(authed)/tracks/[id]/page.test.tsx` | 4 (ID exists, ID missing, loading, renders null) |
| E2E navigation | `tests/e2e/tracks.spec.ts` (Playwright) | 5 (renders, click available, locked disabled, sidebar continue, /[id] redirect) |

Net web test count expectation: ~290-310 (from 261 at C merge, +50-60 new, -25-30 deleted).

## Sub-agent batching

If using `superpowers:subagent-driven-development`, T1-T2 (CSS edits) are sequential and trivial; T3-T7 are independent and can be parallelized across sub-agents (each pure function or pure presentational component); T8-T9 depend on T3-T7 but are independent of each other; T10 depends on T8+T9; T11 depends on T8+T9+T10; T12 is sequential.

## Depends on

- Sub-project A (UI Foundation) — `SkillNode` primitive, `Icon` component, `cn` utility, `.node` / `.tint-*` CSS, `.skeleton` class
- Sub-project B (App Shell) — `(authed)/layout.tsx` providing `<main className="main">`, `Sidebar` `ContinueLessonButton`, `Topbar` track switcher
- Sub-project C (Dashboard) — `useActiveTrack` hook + `TrackProvider` mounted in `(authed)/layout.tsx`
- Pre-existing — `fetchTrack`, `TrackDetail`, `LessonSummary` from `lib/tracks`; `fetchTrackProgress`, `TrackProgress`, `LessonProgress`, `LessonProgressState` from `lib/progress`
