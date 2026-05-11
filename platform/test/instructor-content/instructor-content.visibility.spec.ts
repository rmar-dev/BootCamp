import { BadRequestException } from '@nestjs/common';
import { ExerciseVisibility, LessonLevel } from '@prisma/client';
import {
  InstructorContentService,
  type SaveLessonInput,
} from '../../src/instructor-content/instructor-content.service';

// Focused unit test for the G-side visibility/scope/authorship plumbing
// inside InstructorContentService. Mocks every collaborator so we can
// assert exactly what flows down to ExerciseRepository under the four
// scope shapes — without paying the cost of a real DB (the broader
// instructor-content suite covers end-to-end with Postgres).

const validCodePayload = {
  type: 'code' as const,
  language: 'swift' as const,
  starterCode: 'print(1)',
  testCode: 'assert(true)',
  testEntryPoint: 'main',
};

function exerciseBlock(extras: Record<string, unknown> = {}): SaveLessonInput['blocks'][number] {
  return {
    kind: 'exercise',
    promptMarkdown: 'do',
    type: 'code' as any,
    payload: validCodePayload as any,
    pointsMax: 1,
    hints: [],
    concepts: [],
    ...extras,
  } as SaveLessonInput['blocks'][number];
}

describe('InstructorContentService — visibility + author wiring', () => {
  function buildService() {
    const lessons = {
      createDraft: jest.fn().mockResolvedValue({ id: 'L1', version: 1 }),
      createNextVersion: jest.fn().mockResolvedValue({ id: 'L1', version: 2 }),
    } as any;
    const exercises = {
      createDraft: jest.fn().mockResolvedValue({ id: 'EX1', version: 1 }),
      createNextVersion: jest.fn().mockResolvedValue({ id: 'EX1', version: 2 }),
    } as any;
    const tracks = {
      createNextVersion: jest.fn().mockResolvedValue({ id: 'T1', version: 2 }),
    } as any;
    const publisher = { publishTrack: jest.fn().mockResolvedValue(undefined) } as any;
    const prisma = {
      track: {
        findFirst: jest.fn().mockImplementation(async ({ where }: any) => ({
          id: where.id,
          version: 1,
          title: 'T',
          language: 'swift',
          kind: 'fundamentals',
          description: '',
          lessonIds: [],
          lessonVersions: [],
        })),
      },
      lesson: {
        findFirst: jest.fn().mockResolvedValue({ id: 'L1', version: 1, trackId: 'T1' }),
      },
    } as any;
    return {
      svc: new InstructorContentService(lessons, exercises, tracks, publisher, prisma),
      exercises,
    };
  }

  function baseInput(overrides: Partial<SaveLessonInput> = {}): SaveLessonInput {
    return {
      trackId: 'T1',
      title: 'A lesson',
      level: LessonLevel.beginner,
      summary: 's',
      blocks: overrides.blocks ?? [exerciseBlock()],
      ...overrides,
    };
  }

  it('defaults visibility to public + scopeId null when neither lesson nor block specifies', async () => {
    const { svc, exercises } = buildService();
    await svc.createLesson(baseInput({ authorUserId: 'U1' }));
    const args = exercises.createDraft.mock.calls[0][0];
    expect(args.visibility).toBe(ExerciseVisibility.public);
    expect(args.scopeId).toBeNull();
    expect(args.authorId).toBe('U1');
  });

  it('inherits lesson-wide visibility/scope to the block when block omits its own', async () => {
    const { svc, exercises } = buildService();
    await svc.createLesson(
      baseInput({
        visibility: ExerciseVisibility.cohort,
        scopeId: 'cohort-123',
        authorUserId: 'U1',
      }),
    );
    const args = exercises.createDraft.mock.calls[0][0];
    expect(args.visibility).toBe(ExerciseVisibility.cohort);
    expect(args.scopeId).toBe('cohort-123');
  });

  it('per-block visibility/scope overrides the lesson-wide default', async () => {
    const { svc, exercises } = buildService();
    await svc.createLesson(
      baseInput({
        visibility: ExerciseVisibility.cohort,
        scopeId: 'cohort-123',
        authorUserId: 'U1',
        blocks: [
          exerciseBlock({
            visibility: ExerciseVisibility.private_to_student,
            scopeId: 'student-9',
          }),
        ],
      }),
    );
    const args = exercises.createDraft.mock.calls[0][0];
    expect(args.visibility).toBe(ExerciseVisibility.private_to_student);
    expect(args.scopeId).toBe('student-9');
  });

  it('rejects with BadRequest when non-public visibility lacks scopeId', async () => {
    const { svc } = buildService();
    await expect(
      svc.createLesson(
        baseInput({
          visibility: ExerciseVisibility.cohort,
          // scopeId intentionally omitted
          authorUserId: 'U1',
        }),
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('does NOT pass authorId to createNextVersion when authorUserId absent (preserves existing authorship)', async () => {
    const { svc, exercises } = buildService();
    await svc.createLesson(
      baseInput({
        blocks: [exerciseBlock({ existingExerciseId: 'EX-OLD' })],
      }),
    );
    const args = exercises.createNextVersion.mock.calls[0][1];
    expect(args.authorId).toBeUndefined();
    // ExerciseRepository.createNextVersion handles inheritance from the
    // prior row when authorId is omitted.
  });
});
