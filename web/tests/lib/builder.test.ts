import { describe, it, expect, beforeEach } from 'vitest';
import {
  cloneBlock,
  createDraftLesson,
  createExerciseBlock,
  createExplanationBlock,
  createVideoBlock,
  defaultPayload,
  deleteDraft,
  getDraft,
  InstructorSaveError,
  lessonResponseToDraft,
  listDrafts,
  publishDraft,
  publishLessonToBackend,
  saveDraft,
  validateDraft,
  type LessonDraft,
} from '@/lib/builder';
import { vi } from 'vitest';
import type { LessonResponse } from '@/lib/api';

beforeEach(() => {
  window.localStorage.clear();
});

describe('builder draft store', () => {
  it('creates a fresh draft with sensible defaults', () => {
    const d = createDraftLesson();
    expect(d.id).toMatch(/^lesson_/);
    expect(d.title).toBe('Untitled lesson');
    expect(d.publishedAt).toBeNull();
    expect(d.blocks).toHaveLength(0);
  });

  it('round-trips through localStorage and updates `updatedAt` on save', async () => {
    const d = createDraftLesson();
    saveDraft(d);
    expect(getDraft(d.id)?.title).toBe('Untitled lesson');

    // updatedAt is rewritten on each save — wait a tick to detect the change.
    await new Promise((r) => setTimeout(r, 5));
    const saved = saveDraft({ ...d, title: 'Renamed' });
    expect(saved.title).toBe('Renamed');
    expect(saved.updatedAt > d.updatedAt).toBe(true);
  });

  it('listDrafts returns most-recently-updated first', async () => {
    const a = saveDraft({ ...createDraftLesson(), title: 'A' });
    await new Promise((r) => setTimeout(r, 5));
    const b = saveDraft({ ...createDraftLesson(), title: 'B' });
    const list = listDrafts();
    expect(list[0].id).toBe(b.id);
    expect(list[1].id).toBe(a.id);
  });

  it('deleteDraft removes only the targeted draft', () => {
    const a = saveDraft({ ...createDraftLesson(), title: 'A' });
    const b = saveDraft({ ...createDraftLesson(), title: 'B' });
    deleteDraft(a.id);
    expect(getDraft(a.id)).toBeNull();
    expect(getDraft(b.id)?.title).toBe('B');
  });

  it('publishDraft stamps publishedAt without altering blocks', () => {
    const d = saveDraft({
      ...createDraftLesson(),
      title: 'Real lesson',
      slug: 'real-lesson',
      blocks: [createExplanationBlock()],
    });
    const pub = publishDraft(d.id);
    expect(pub?.publishedAt).not.toBeNull();
    expect(pub?.blocks).toHaveLength(1);
  });
});

describe('block factories', () => {
  it('explanation defaults to empty markdown', () => {
    const b = createExplanationBlock();
    expect(b.kind).toBe('explanation');
    if (b.kind === 'explanation') expect(b.markdown).toBe('');
  });

  it('video defaults to empty url', () => {
    const b = createVideoBlock();
    expect(b.kind).toBe('video');
    if (b.kind === 'video') expect(b.video.url).toBe('');
  });

  it('exercise factory honours requested type and language', () => {
    const swiftCode = createExerciseBlock('code', 'swift');
    const kotlinCode = createExerciseBlock('code', 'kotlin');
    if (swiftCode.kind !== 'exercise' || kotlinCode.kind !== 'exercise') {
      throw new Error('expected exercise blocks');
    }
    expect(swiftCode.exercise.payload.type).toBe('code');
    if (swiftCode.exercise.payload.type === 'code') {
      expect(swiftCode.exercise.payload.language).toBe('swift');
      expect(swiftCode.exercise.payload.testEntryPoint).toBe('Tests');
    }
    if (kotlinCode.exercise.payload.type === 'code') {
      expect(kotlinCode.exercise.payload.testEntryPoint).toBe('TestKt');
    }
  });

  it('defaultPayload returns correct shape per type', () => {
    expect(defaultPayload('multiple_choice', 'swift').type).toBe('multiple_choice');
    expect(defaultPayload('fill_blank', 'swift').type).toBe('fill_blank');
    expect(defaultPayload('predict_output', 'swift').type).toBe('predict_output');
    expect(defaultPayload('capstone_submission', 'swift').type).toBe('capstone_submission');
    expect(defaultPayload('visual_playground', 'swift').type).toBe('visual_playground');
  });
});

describe('validateDraft', () => {
  it('flags blank title, bad slug, no blocks', () => {
    const issues = validateDraft({
      ...createDraftLesson(),
      title: '',
      slug: 'Bad Slug',
      blocks: [],
    });
    const fields = issues.map((i) => i.field).sort();
    expect(fields).toEqual(['blocks', 'slug', 'title']);
  });

  it('flags empty exercise prompt but not capstone (which has none)', () => {
    const draft: LessonDraft = {
      ...createDraftLesson(),
      title: 'OK',
      slug: 'ok-lesson',
      blocks: [createExerciseBlock('code'), createExerciseBlock('capstone_submission')],
    };
    const issues = validateDraft(draft);
    // The first exercise (code) has empty prompt — should flag.
    expect(issues.some((i) => i.field === 'prompt')).toBe(true);
    // The capstone shouldn't add a second prompt issue.
    const promptIssues = issues.filter((i) => i.field === 'prompt');
    expect(promptIssues).toHaveLength(1);
  });

  it('passes a complete-enough draft', () => {
    const explanation = createExplanationBlock();
    if (explanation.kind === 'explanation') explanation.markdown = '## Hello';
    const draft: LessonDraft = {
      ...createDraftLesson(),
      title: 'OK',
      slug: 'ok-lesson',
      blocks: [explanation],
    };
    expect(validateDraft(draft)).toHaveLength(0);
  });
});

describe('lessonResponseToDraft', () => {
  function makeLesson(overrides: Partial<LessonResponse> = {}): LessonResponse {
    return {
      id: 'lesson-uuid-123',
      version: 4,
      title: 'State in SwiftUI',
      trackId: 'swift-fundamentals',
      blocks: [createExplanationBlock()],
      assignment: null,
      ...overrides,
    };
  }

  it('generates a fresh draft id distinct from the source lesson id', () => {
    const draft = lessonResponseToDraft(makeLesson());
    expect(draft.id).toMatch(/^lesson_/);
    expect(draft.id).not.toBe('lesson-uuid-123');
  });

  it('records fork provenance pointing at source lesson + version', () => {
    const draft = lessonResponseToDraft(makeLesson());
    expect(draft.forkedFrom).toEqual({
      lessonId: 'lesson-uuid-123',
      version: 4,
      title: 'State in SwiftUI',
    });
  });

  it('starts as an unpublished draft so save→publish forks land separately', () => {
    const draft = lessonResponseToDraft(makeLesson());
    expect(draft.publishedAt).toBeNull();
  });

  it('suffixes title with "(copy)" so authors can spot the fork in the index', () => {
    const draft = lessonResponseToDraft(makeLesson());
    expect(draft.title).toBe('State in SwiftUI (copy)');
    expect(draft.slug).toBe('state-in-swiftui-copy');
  });

  it('preserves block ordering and content from the source lesson', () => {
    const blocks = [
      createExplanationBlock(),
      createExerciseBlock('multiple_choice'),
      createVideoBlock(),
    ];
    const draft = lessonResponseToDraft(makeLesson({ blocks }));
    expect(draft.blocks).toHaveLength(3);
    expect(draft.blocks.map((b) => b.kind)).toEqual(['explanation', 'exercise', 'video']);
  });
});

describe('publishDraft intent', () => {
  it('records "new" intent for non-forked drafts even if "update" was requested', () => {
    const d = saveDraft({
      ...createDraftLesson(),
      title: 'OK',
      slug: 'ok',
      blocks: [createExplanationBlock()],
    });
    const pub = publishDraft(d.id, 'update');
    expect(pub?.publishIntent).toBe('new');
  });

  it('records "update" intent on a forked draft when requested', () => {
    const d = saveDraft({
      ...createDraftLesson(),
      title: 'OK',
      slug: 'ok',
      forkedFrom: { lessonId: 'src', version: 2, title: 'Source' },
    });
    const pub = publishDraft(d.id, 'update');
    expect(pub?.publishIntent).toBe('update');
  });

  it('still allows "new" intent on a forked draft', () => {
    const d = saveDraft({
      ...createDraftLesson(),
      title: 'OK',
      slug: 'ok',
      forkedFrom: { lessonId: 'src', version: 2, title: 'Source' },
    });
    const pub = publishDraft(d.id, 'new');
    expect(pub?.publishIntent).toBe('new');
  });
});

describe('cloneBlock', () => {
  it('gives the clone a fresh id while preserving content', () => {
    const original = createExplanationBlock();
    if (original.kind === 'explanation') original.markdown = '# Hi';
    const clone = cloneBlock(original);
    expect(clone.id).not.toBe(original.id);
    if (clone.kind === 'explanation') expect(clone.markdown).toBe('# Hi');
  });

  it('gives an exercise clone fresh block + exercise ids and resets attempt status', () => {
    const original = createExerciseBlock('multiple_choice');
    if (original.kind === 'exercise') {
      original.exercise.attemptStatus = 'first_try';
      original.exercise.lastResponse = { picked: 'a' };
    }
    const clone = cloneBlock(original);
    if (original.kind !== 'exercise' || clone.kind !== 'exercise') {
      throw new Error('expected exercise blocks');
    }
    expect(clone.id).not.toBe(original.id);
    expect(clone.exercise.id).not.toBe(original.exercise.id);
    expect(clone.exercise.attemptStatus).toBe('unattempted');
    expect(clone.exercise.lastResponse).toBeUndefined();
  });

  it('deep-copies exercise payload so edits do not bleed into the source', () => {
    const original = createExerciseBlock('multiple_choice');
    const clone = cloneBlock(original);
    if (original.kind !== 'exercise' || clone.kind !== 'exercise') {
      throw new Error('expected exercise blocks');
    }
    if (
      original.exercise.payload.type !== 'multiple_choice' ||
      clone.exercise.payload.type !== 'multiple_choice'
    ) {
      throw new Error('expected multiple_choice payload');
    }
    clone.exercise.payload.options[0].text = 'Edited in clone';
    expect(original.exercise.payload.options[0].text).not.toBe('Edited in clone');
  });
});

describe('publishLessonToBackend', () => {
  const realUuid = '11111111-1111-1111-1111-111111111111';
  const lessonUuid = '22222222-2222-2222-2222-222222222222';
  const trackUuid = '33333333-3333-3333-3333-333333333333';

  function makeForkedDraft(): LessonDraft {
    const ex = createExerciseBlock('multiple_choice');
    if (ex.kind === 'exercise') {
      // Pretend this exercise originated from a fork: real UUID id.
      ex.exercise.id = realUuid;
      ex.exercise.promptMarkdown = 'Pick one';
    }
    return saveDraft({
      ...createDraftLesson(),
      title: 'Forked',
      slug: 'forked',
      trackId: trackUuid,
      blocks: [ex],
      forkedFrom: { lessonId: lessonUuid, version: 1, title: 'Original' },
    });
  }

  function makeNewDraft(): LessonDraft {
    return saveDraft({
      ...createDraftLesson(),
      title: 'Brand new',
      slug: 'brand-new',
      trackId: trackUuid,
      blocks: [createExplanationBlock(), createExerciseBlock('code')],
    });
  }

  function mockOk<T>(body: T): void {
    (globalThis as unknown as { fetch: typeof fetch }).fetch = vi.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => body,
    })) as unknown as typeof fetch;
  }

  function mockFail(status: number, message: string): void {
    (globalThis as unknown as { fetch: typeof fetch }).fetch = vi.fn(async () => ({
      ok: false,
      status,
      json: async () => ({ message }),
    })) as unknown as typeof fetch;
  }

  it('PUTs to the existing lesson id when intent=update on a forked draft', async () => {
    const draft = makeForkedDraft();
    const fetchSpy = vi.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => ({
        lessonId: lessonUuid,
        lessonVersion: 2,
        trackId: trackUuid,
        trackVersion: 5,
        exercises: [{ blockIndex: 0, id: realUuid, version: 2 }],
      }),
    }));
    (globalThis as unknown as { fetch: typeof fetch }).fetch = fetchSpy as unknown as typeof fetch;

    const result = await publishLessonToBackend(draft, 'update');

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const [url, init] = fetchSpy.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toContain(`/api/instructor/content/lessons/${lessonUuid}`);
    expect(init.method).toBe('PUT');
    const body = JSON.parse(init.body as string);
    // The fork-source exercise must carry existingExerciseId so the backend
    // bumps its version instead of creating a new entity.
    expect(body.blocks[0].existingExerciseId).toBe(realUuid);
    // The local draft should now reflect the new lesson version.
    expect(result.publishedAt).not.toBeNull();
    expect(result.forkedFrom?.version).toBe(2);
  });

  it('POSTs to the create endpoint when intent=new on a non-forked draft', async () => {
    const draft = makeNewDraft();
    const exerciseIdInDraft = (draft.blocks[1].kind === 'exercise' ? draft.blocks[1].exercise.id : '');
    expect(exerciseIdInDraft).toMatch(/^ex_/);

    const fetchSpy = vi.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => ({
        lessonId: lessonUuid,
        lessonVersion: 1,
        trackId: trackUuid,
        trackVersion: 4,
        exercises: [{ blockIndex: 1, id: realUuid, version: 1 }],
      }),
    }));
    (globalThis as unknown as { fetch: typeof fetch }).fetch = fetchSpy as unknown as typeof fetch;

    const result = await publishLessonToBackend(draft, 'new');

    const [url, init] = fetchSpy.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toMatch(/\/api\/instructor\/content\/lessons$/);
    expect(init.method).toBe('POST');
    const body = JSON.parse(init.body as string);
    // Locally-created exercise must NOT carry existingExerciseId — it's a brand-new entity.
    expect(body.blocks[1].existingExerciseId).toBeUndefined();
    // The local draft should be re-keyed with the canonical exercise id.
    if (result.blocks[1].kind === 'exercise') {
      expect(result.blocks[1].exercise.id).toBe(realUuid);
    }
    // Fork pointer is set so subsequent edits default to "Update original".
    expect(result.forkedFrom).toEqual({ lessonId: lessonUuid, version: 1, title: 'Brand new' });
  });

  it('throws InstructorSaveError with status + message on failure', async () => {
    const draft = makeNewDraft();
    mockFail(403, 'Insufficient role');
    await expect(publishLessonToBackend(draft, 'new')).rejects.toMatchObject({
      name: 'InstructorSaveError',
      status: 403,
      message: 'Insufficient role',
    });
  });

  it('falls back to "new" semantics when intent=update but draft is not forked', async () => {
    const draft = makeNewDraft();
    const fetchSpy = vi.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => ({
        lessonId: lessonUuid,
        lessonVersion: 1,
        trackId: trackUuid,
        trackVersion: 2,
        exercises: [],
      }),
    }));
    (globalThis as unknown as { fetch: typeof fetch }).fetch = fetchSpy as unknown as typeof fetch;

    await publishLessonToBackend(draft, 'update');
    const [url, init] = fetchSpy.mock.calls[0] as unknown as [string, RequestInit];
    // No forkedFrom → must POST regardless of intent.
    expect(init.method).toBe('POST');
    expect(url).toMatch(/\/lessons$/);
  });

  it('refuses to publish without a trackId selected', async () => {
    const draft = saveDraft({
      ...createDraftLesson(),
      title: 'No track',
      slug: 'no-track',
      trackId: null,
      blocks: [createExplanationBlock()],
    });
    mockOk({});
    await expect(publishLessonToBackend(draft, 'new')).rejects.toMatchObject({
      name: 'InstructorSaveError',
      status: 0,
    });
  });
});
