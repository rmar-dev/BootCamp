import { LessonAssemblerService } from '../../src/content/services/lesson-assembler.service';
import { LessonRepository } from '../../src/content/repositories/lesson.repository';
import { ExerciseRepository } from '../../src/content/repositories/exercise.repository';
import { ExamDifficultyOverrideRepository } from '../../src/state/repositories/exam-difficulty-override.repository';

// Focused unit test for the per-exam override application path. Mocks
// every collaborator so we can assert exactly how extendTimeMs / optional
// land on the ExerciseDTO under different override shapes — without paying
// the cost of seeding a real DB (the broader assembler suite covers that).

describe('LessonAssemblerService — per-exam override application', () => {
  const studentId = 'student-1';
  const lessonId = 'lesson-1';
  const exerciseId = 'ex-1';
  const otherExerciseId = 'ex-2';
  const lessonVersion = 1;
  const exerciseVersion = 1;

  function buildLesson() {
    return {
      id: lessonId,
      version: lessonVersion,
      trackId: 'track-1',
      title: 'Test',
      blocks: [
        {
          id: 'block-1',
          kind: 'exercise' as const,
          exerciseId,
          exerciseVersion,
          explanationMarkdown: null,
          videoUrl: null,
          videoTitle: null,
          videoDescription: null,
          videoDurationLabel: null,
          videoPosterUrl: null,
        },
      ],
    };
  }

  function buildExercise() {
    return {
      id: exerciseId,
      version: exerciseVersion,
      type: 'code',
      promptMarkdown: 'do the thing',
      pointsMax: 10,
      payload: { type: 'code', language: 'swift' },
      hints: [],
      publishedAt: new Date(),
      // Curriculum-style: public + no scope. Required by the new visibility
      // filter the assembler applies (scoped exercises would be hidden when
      // the test student isn't in the exercise's scope).
      visibility: 'public' as const,
      scopeId: null,
    };
  }

  function buildAssembler(overrides: Array<{ studentId: string; exerciseId: string; extendTimeMs: number | null; optional: boolean; exerciseVersion: number }>) {
    const lessons = {
      findLatestPublishedWithBlocks: jest.fn().mockResolvedValue(buildLesson()),
    } as unknown as LessonRepository;
    const exercises = {
      findByVersion: jest.fn().mockResolvedValue(buildExercise()),
    } as unknown as ExerciseRepository;
    const prisma = {
      attempt: { findMany: jest.fn().mockResolvedValue([]) },
    } as any;
    const examOverrides = {
      findByStudent: jest.fn().mockResolvedValue(overrides),
    } as unknown as ExamDifficultyOverrideRepository;
    return new LessonAssemblerService(lessons, exercises, prisma, examOverrides);
  }

  function activeAssignment() {
    return {
      status: 'active' as const,
      id: 'assign-1',
      selectedExerciseIds: [exerciseId],
    };
  }

  it('attaches extendTimeMs when an override sets it', async () => {
    const svc = buildAssembler([
      { studentId, exerciseId, extendTimeMs: 60_000, optional: false, exerciseVersion },
    ]);
    const result = await svc.assembleLatestForStudent(lessonId, activeAssignment(), studentId);
    if (result?.blocks[0].kind !== 'exercise') throw new Error('expected exercise block');
    expect(result.blocks[0].exercise.extendTimeMs).toBe(60_000);
    expect(result.blocks[0].exercise.optional).toBeUndefined();
  });

  it('attaches optional=true when an override marks the exercise optional', async () => {
    const svc = buildAssembler([
      { studentId, exerciseId, extendTimeMs: null, optional: true, exerciseVersion },
    ]);
    const result = await svc.assembleLatestForStudent(lessonId, activeAssignment(), studentId);
    if (result?.blocks[0].kind !== 'exercise') throw new Error('expected exercise block');
    expect(result.blocks[0].exercise.optional).toBe(true);
    expect(result.blocks[0].exercise.extendTimeMs).toBeUndefined();
  });

  it('attaches both fields when the override sets both', async () => {
    const svc = buildAssembler([
      { studentId, exerciseId, extendTimeMs: 30_000, optional: true, exerciseVersion },
    ]);
    const result = await svc.assembleLatestForStudent(lessonId, activeAssignment(), studentId);
    if (result?.blocks[0].kind !== 'exercise') throw new Error('expected exercise block');
    expect(result.blocks[0].exercise.extendTimeMs).toBe(30_000);
    expect(result.blocks[0].exercise.optional).toBe(true);
  });

  it('does not attach override fields when no override exists for the exercise', async () => {
    // Override exists but for a different exercise — the rendered one is untouched.
    const svc = buildAssembler([
      { studentId, exerciseId: otherExerciseId, extendTimeMs: 60_000, optional: true, exerciseVersion },
    ]);
    const result = await svc.assembleLatestForStudent(lessonId, activeAssignment(), studentId);
    if (result?.blocks[0].kind !== 'exercise') throw new Error('expected exercise block');
    expect(result.blocks[0].exercise.extendTimeMs).toBeUndefined();
    expect(result.blocks[0].exercise.optional).toBeUndefined();
  });

  it('does not attach override fields when no overrides exist at all', async () => {
    const svc = buildAssembler([]);
    const result = await svc.assembleLatestForStudent(lessonId, activeAssignment(), studentId);
    if (result?.blocks[0].kind !== 'exercise') throw new Error('expected exercise block');
    expect(result.blocks[0].exercise.extendTimeMs).toBeUndefined();
    expect(result.blocks[0].exercise.optional).toBeUndefined();
  });

  it('treats optional=false as no-op (does not stamp false on the DTO)', async () => {
    const svc = buildAssembler([
      { studentId, exerciseId, extendTimeMs: null, optional: false, exerciseVersion },
    ]);
    const result = await svc.assembleLatestForStudent(lessonId, activeAssignment(), studentId);
    if (result?.blocks[0].kind !== 'exercise') throw new Error('expected exercise block');
    // The renderer can distinguish "configured to default" from "not configured".
    // Per the override-application logic, optional=false is treated as no-op so
    // the field is omitted on the DTO.
    expect(result.blocks[0].exercise.optional).toBeUndefined();
  });
});
