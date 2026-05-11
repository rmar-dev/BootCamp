import type {
  ExercisePayload,
  ExerciseTypeValue,
  LessonBlock,
  Language,
} from './exercise-payloads';
import { fetchLesson, BASE, type LessonResponse } from './api';

// ── Draft model ──────────────────────────────────────────────────────────────
// A LessonDraft mirrors `Lesson` from exercise-payloads.ts but represents an
// in-progress, unpublished authoring state. Drafts are stored in localStorage
// keyed by id; saving to a server is mocked until the instructor-write API
// lands (see TODO at the bottom of this file).

export type Level = 'beginner' | 'intermediate' | 'advanced';

export interface LessonDraft {
  /** Stable client-generated id; backend will assign final UUID at create. */
  id: string;
  /** Slug used in markdown filename — informs the eventual `lesson:<track>/<slug>` UUID. */
  slug: string;
  title: string;
  summary: string;
  level: Level;
  trackId: string | null;
  /** ISO timestamp — last-modified, used for sorting the index. */
  updatedAt: string;
  /** Has this draft been "published" via the mock save? */
  publishedAt: string | null;
  blocks: LessonBlock[];
  /** When this draft was forked from a published lesson, the source identity.
   * Lets the future write API decide PUT-vs-POST when persisting. */
  forkedFrom?: { lessonId: string; version: number; title: string };
  /** Author's intent at last publish: 'update' bumps the source lesson to a
   * new version (PUT semantics); 'new' creates a separate published lesson
   * (POST semantics). Only meaningful for forked drafts; non-forked drafts
   * always behave as 'new'. Persisted so the future write API knows what to do. */
  publishIntent?: 'update' | 'new';
}

// ── Storage ──────────────────────────────────────────────────────────────────

const STORAGE_KEY = 'bootcamp.builder.drafts.v1';

function isBrowser(): boolean {
  return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';
}

function readAll(): LessonDraft[] {
  if (!isBrowser()) return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as LessonDraft[]) : [];
  } catch {
    // Corrupted draft store — start fresh rather than throwing in the UI.
    return [];
  }
}

function writeAll(drafts: LessonDraft[]): void {
  if (!isBrowser()) return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(drafts));
}

export function listDrafts(): LessonDraft[] {
  return readAll().sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export function getDraft(id: string): LessonDraft | null {
  return readAll().find((d) => d.id === id) ?? null;
}

export function saveDraft(draft: LessonDraft): LessonDraft {
  const next: LessonDraft = { ...draft, updatedAt: new Date().toISOString() };
  const all = readAll();
  const idx = all.findIndex((d) => d.id === draft.id);
  if (idx >= 0) all[idx] = next;
  else all.push(next);
  writeAll(all);
  return next;
}

export function deleteDraft(id: string): void {
  writeAll(readAll().filter((d) => d.id !== id));
}

export function publishDraft(
  id: string,
  intent: 'update' | 'new' = 'new',
): LessonDraft | null {
  const draft = getDraft(id);
  if (!draft) return null;
  // 'update' is only valid for forked drafts; coerce to 'new' otherwise so
  // the persisted intent never lies about what the future write API can do.
  const effective = draft.forkedFrom ? intent : 'new';
  return saveDraft({
    ...draft,
    publishedAt: new Date().toISOString(),
    publishIntent: effective,
  });
}

// ── Factories ────────────────────────────────────────────────────────────────

let counter = 0;
function nextId(prefix: string): string {
  counter += 1;
  // Time + counter avoids collisions when multiple blocks are added in the
  // same millisecond (e.g. duplicate). Crypto-strength uniqueness isn't
  // required here — drafts only live in the current browser.
  return `${prefix}_${Date.now().toString(36)}${counter.toString(36)}`;
}

export function createDraftLesson(): LessonDraft {
  const now = new Date().toISOString();
  return {
    id: nextId('lesson'),
    slug: 'untitled-lesson',
    title: 'Untitled lesson',
    summary: '',
    level: 'beginner',
    trackId: null,
    updatedAt: now,
    publishedAt: null,
    blocks: [],
  };
}

export function createExplanationBlock(): LessonBlock {
  return { kind: 'explanation', id: nextId('blk'), markdown: '' };
}

export function createVideoBlock(): LessonBlock {
  return {
    kind: 'video',
    id: nextId('blk'),
    video: { url: '', title: '', description: '', durationLabel: '' },
  };
}

/**
 * Deep-copy a block coming from another lesson so the import is a fresh entity
 * — fresh ids, no aliasing back to the source. Authors can then edit it in
 * isolation without affecting the original published lesson.
 */
export function cloneBlock(block: LessonBlock): LessonBlock {
  if (block.kind === 'explanation') {
    return { kind: 'explanation', id: nextId('blk'), markdown: block.markdown };
  }
  if (block.kind === 'video') {
    return { kind: 'video', id: nextId('blk'), video: { ...block.video } };
  }
  return {
    kind: 'exercise',
    id: nextId('blk'),
    exercise: {
      ...block.exercise,
      id: nextId('ex'),
      // Drop per-student state; an imported block starts unattempted.
      attemptStatus: 'unattempted',
      lastResponse: undefined,
      // Deep-copy payload + arrays so future edits don't bleed across drafts.
      payload: structuredClone(block.exercise.payload),
      hints: block.exercise.hints ? [...block.exercise.hints] : [],
    },
  };
}

export function createExerciseBlock(
  type: ExerciseTypeValue,
  language: Language = 'swift',
): LessonBlock {
  return {
    kind: 'exercise',
    id: nextId('blk'),
    exercise: {
      id: nextId('ex'),
      version: 1,
      type,
      promptMarkdown: '',
      pointsMax: 100,
      payload: defaultPayload(type, language),
      attemptStatus: 'unattempted',
      hints: [],
    },
  };
}

export function defaultPayload(type: ExerciseTypeValue, language: Language): ExercisePayload {
  switch (type) {
    case 'code':
      return {
        type: 'code',
        language,
        starterCode: language === 'swift' ? 'func solve() {\n  // your code here\n}\n' : 'fun solve() {\n  // your code here\n}\n',
        testCode: '',
        testEntryPoint: language === 'swift' ? 'Tests' : 'TestKt',
      };
    case 'fix_bug':
      return {
        type: 'fix_bug',
        language,
        brokenCode: '',
        testCode: '',
        testEntryPoint: language === 'swift' ? 'Tests' : 'TestKt',
      };
    case 'fill_blank':
      return {
        type: 'fill_blank',
        language,
        template: 'let answer = ___1',
        blanks: [{ id: '1', expected: ['42'] }],
      };
    case 'predict_output':
      return {
        type: 'predict_output',
        displayedCode: 'print("Hello, BootCamp!")',
        displayedLanguage: language,
        expectedOutput: 'Hello, BootCamp!',
      };
    case 'multiple_choice':
      return {
        type: 'multiple_choice',
        questionMarkdown: '',
        options: [
          { id: 'a', text: 'Option A' },
          { id: 'b', text: 'Option B' },
        ],
        correctOptionIds: ['a'],
        multiSelect: false,
      };
    case 'capstone_submission':
      return { type: 'capstone_submission' };
    case 'visual_playground':
      return {
        type: 'visual_playground',
        language,
        primitive: 'button',
        controls: [
          { kind: 'text', id: 'label', label: 'Label', default: 'Tap me' },
          { kind: 'slider', id: 'radius', label: 'Corner radius', min: 0, max: 32, default: 16, unit: 'pt' },
        ],
      };
  }
}

// ── Validation (lightweight) ─────────────────────────────────────────────────
// Just enough to surface red squiggles in the inspector before save. Backend
// will run the canonical Zod check at publish time.

export interface ValidationIssue {
  blockId?: string;
  field: string;
  message: string;
}

export function validateDraft(draft: LessonDraft): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  if (!draft.title.trim()) issues.push({ field: 'title', message: 'Title is required.' });
  if (!draft.slug.trim() || !/^[a-z0-9-]+$/.test(draft.slug)) {
    issues.push({ field: 'slug', message: 'Slug must be lowercase, numbers and hyphens only.' });
  }
  if (draft.blocks.length === 0) {
    issues.push({ field: 'blocks', message: 'Add at least one block.' });
  }
  for (const b of draft.blocks) {
    if (b.kind === 'explanation' && !b.markdown.trim()) {
      issues.push({ blockId: b.id, field: 'markdown', message: 'Explanation is empty.' });
    }
    if (b.kind === 'video' && !b.video.url.trim()) {
      issues.push({ blockId: b.id, field: 'url', message: 'Video URL is required.' });
    }
    if (b.kind === 'exercise' && !b.exercise.promptMarkdown.trim() && b.exercise.type !== 'capstone_submission') {
      issues.push({ blockId: b.id, field: 'prompt', message: 'Exercise prompt is empty.' });
    }
  }
  return issues;
}

// ── Mock save ────────────────────────────────────────────────────────────────
// TODO(backend): once POST /api/instructor/lessons + POST /api/instructor/exercises
// land, replace this with a real fetch chain (create exercise versions first,
// then the lesson with their ids/versions, then optionally PUBLISH). Until
// then, the builder writes to localStorage so authors can iterate.

export async function mockSave(draft: LessonDraft): Promise<LessonDraft> {
  await new Promise((r) => setTimeout(r, 220));
  return saveDraft(draft);
}

// ── Real backend persistence (POST/PUT /api/instructor/content/lessons) ─────
// Used by Publish in the builder. "Save draft" remains local-only — drafts
// are intentionally not pushed to the DB until the instructor commits to
// publishing. That keeps the instructor write surface lean and avoids a flood
// of zombie unpublished lesson rows from intermediate save clicks.

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function isUuid(s: string): boolean {
  return UUID_RE.test(s);
}

interface SaveExerciseRef {
  blockIndex: number;
  id: string;
  version: number;
}

interface SaveLessonResult {
  lessonId: string;
  lessonVersion: number;
  trackId: string;
  trackVersion: number;
  exercises: SaveExerciseRef[];
}

function buildSavePayload(draft: LessonDraft): unknown {
  return {
    trackId: draft.trackId,
    title: draft.title,
    level: draft.level,
    summary: draft.summary,
    publish: true,
    blocks: draft.blocks.map((b) => {
      if (b.kind === 'explanation') {
        return { kind: 'explanation', markdown: b.markdown };
      }
      if (b.kind === 'video') {
        return {
          kind: 'video',
          videoUrl: b.video.url,
          videoTitle: b.video.title,
          videoDescription: b.video.description,
          videoDurationLabel: b.video.durationLabel,
          videoPosterUrl: b.video.posterUrl,
        };
      }
      // For exercises, only forward existingExerciseId when the local id is a
      // real UUID — i.e. it came from a fork. Locally-created exercises carry
      // an ex_* prefix and should land as new entities.
      const ex = b.exercise;
      const existingExerciseId = isUuid(ex.id) ? ex.id : undefined;
      return {
        kind: 'exercise',
        ...(existingExerciseId ? { existingExerciseId } : {}),
        promptMarkdown: ex.promptMarkdown,
        type: ex.type,
        payload: ex.payload,
        pointsMax: ex.pointsMax,
        hints: ex.hints ?? [],
        concepts: [],
      };
    }),
  };
}

export class InstructorSaveError extends Error {
  constructor(public readonly status: number, message: string) {
    super(message);
    this.name = 'InstructorSaveError';
  }
}

async function callSaveEndpoint(
  draft: LessonDraft,
  intent: 'update' | 'new',
): Promise<SaveLessonResult> {
  if (!draft.trackId) {
    throw new InstructorSaveError(0, 'No track selected — cannot publish a lesson without a track.');
  }
  const useUpdate = intent === 'update' && draft.forkedFrom?.lessonId;
  const url = useUpdate
    ? `${BASE}/api/instructor/content/lessons/${draft.forkedFrom!.lessonId}`
    : `${BASE}/api/instructor/content/lessons`;
  const res = await fetch(url, {
    method: useUpdate ? 'PUT' : 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(buildSavePayload(draft)),
  });
  if (!res.ok) {
    let message: string;
    try {
      const body = (await res.json()) as { message?: string | string[] };
      const m = body?.message;
      message = Array.isArray(m) ? m.join('; ') : (m ?? `HTTP ${res.status}`);
    } catch {
      message = `HTTP ${res.status}`;
    }
    throw new InstructorSaveError(res.status, message);
  }
  return (await res.json()) as SaveLessonResult;
}

/**
 * Real publish: POSTs (intent='new') or PUTs (intent='update', forked) the
 * draft to the instructor write endpoint, then re-keys the local draft with
 * the canonical ids returned by the backend so subsequent saves of the same
 * draft round-trip cleanly.
 */
export async function publishLessonToBackend(
  draft: LessonDraft,
  intent: 'update' | 'new',
): Promise<LessonDraft> {
  const result = await callSaveEndpoint(draft, intent);

  // Re-key the local draft so the next edit→publish cycle knows it's now
  // backed by a real lesson and which exercise versions to bump.
  const exerciseRefByIdx = new Map(result.exercises.map((r) => [r.blockIndex, r] as const));
  const reKeyedBlocks = draft.blocks.map((b, idx) => {
    if (b.kind !== 'exercise') return b;
    const ref = exerciseRefByIdx.get(idx);
    if (!ref) return b;
    return {
      ...b,
      exercise: { ...b.exercise, id: ref.id, version: ref.version },
    };
  });

  const next: LessonDraft = {
    ...draft,
    blocks: reKeyedBlocks,
    publishedAt: new Date().toISOString(),
    publishIntent: intent,
    forkedFrom: {
      lessonId: result.lessonId,
      version: result.lessonVersion,
      title: draft.title,
    },
  };
  return saveDraft(next);
}

// ── Fork a published lesson into a local draft ──────────────────────────────
// Reads the latest published lesson via the existing preview API and seeds a
// new draft with its content. Block ids are kept (they're useful provenance
// markers when the write API eventually arrives), but the draft itself gets a
// fresh local id so it sits beside originals in the index without aliasing
// them. Title is suffixed with "(copy)" so authors can tell forks apart.

function slugify(input: string): string {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60) || 'untitled-lesson';
}

export function lessonResponseToDraft(lesson: LessonResponse): LessonDraft {
  const now = new Date().toISOString();
  return {
    id: nextId('lesson'),
    slug: slugify(lesson.title) + '-copy',
    title: `${lesson.title} (copy)`,
    summary: '',
    level: 'beginner',
    trackId: lesson.trackId,
    updatedAt: now,
    publishedAt: null,
    blocks: lesson.blocks,
    forkedFrom: { lessonId: lesson.id, version: lesson.version, title: lesson.title },
  };
}

export class ForkLessonNotFoundError extends Error {
  constructor(lessonId: string) {
    super(`Lesson ${lessonId} not found`);
    this.name = 'ForkLessonNotFoundError';
  }
}

export async function forkLessonToDraft(lessonId: string): Promise<LessonDraft> {
  const lesson = await fetchLesson(lessonId, { mode: 'preview' });
  if (!lesson) throw new ForkLessonNotFoundError(lessonId);
  return saveDraft(lessonResponseToDraft(lesson));
}
