import { TodayPlanService } from '../../src/gamification/today-plan.service';
import { LessonInsightService } from '../../src/content/services/lesson-insight.service';

describe('TodayPlanService', () => {
  let svc: TodayPlanService;
  const progress = { getRecommendation: jest.fn() } as any;
  const lessons = { findByVersionWithBlocks: jest.fn() } as any;
  const exercises = { findByVersion: jest.fn() } as any;
  const insight = new LessonInsightService();

  beforeEach(() => {
    [progress, lessons, exercises].forEach((m) =>
      Object.values(m).forEach((fn: any) => fn.mockReset?.()),
    );
    svc = new TodayPlanService(progress, lessons, exercises, insight);
  });

  const stubRecommendation = (overrides: any = {}) => ({
    kind: 'continue',
    lesson: { id: 'L2', version: 1, title: 'State & bindings', trackId: 'T1', trackTitle: 'Swift' },
    reason: { message: 'pick up where you left off' },
    ...overrides,
  });

  const stubLessonWithBlocks = (id: string, version: number, position: number, exerciseRefs: Array<{ id: string; version: number } | null>) => ({
    id, version, position,
    blocks: exerciseRefs.map((ref) =>
      ref
        ? { kind: 'exercise', exerciseId: ref.id, exerciseVersion: ref.version }
        : { kind: 'concept', exerciseId: null, exerciseVersion: null },
    ),
  });

  it('returns null when recommendation is exhausted', async () => {
    progress.getRecommendation.mockResolvedValueOnce({ kind: 'exhausted', reason: { message: 'done' } });
    const r = await svc.resolve('stu-1', undefined);
    expect(r).toBeNull();
  });

  it('hydrates a "continue" recommendation with position from the lesson', async () => {
    progress.getRecommendation.mockResolvedValueOnce(stubRecommendation());
    lessons.findByVersionWithBlocks.mockResolvedValueOnce(
      stubLessonWithBlocks('L2', 1, 8, [{ id: 'ex1', version: 1 }, { id: 'ex2', version: 1 }]),
    );
    exercises.findByVersion
      .mockResolvedValueOnce({ id: 'ex1', version: 1, type: 'multiple_choice' })
      .mockResolvedValueOnce({ id: 'ex2', version: 1, type: 'code' });

    const r = await svc.resolve('stu-1', undefined);
    expect(r).toEqual({
      lessonId: 'L2',
      lessonVersion: 1,
      trackId: 'T1',
      trackTitle: 'Swift',
      title: 'State & bindings',
      position: 8,
      estimatedMinutes: 5,                  // 30s + 240s = 270s = 5 min
      typeLabel: 'Concept + code',
      recommendationKind: 'continue',
      reasonMessage: 'pick up where you left off',
      conceptHint: null,
    });
  });

  it('passes trackId filter through to recommendation service', async () => {
    progress.getRecommendation.mockResolvedValueOnce({ kind: 'exhausted', reason: { message: '' } });
    await svc.resolve('stu-1', 'T-kotlin');
    expect(progress.getRecommendation).toHaveBeenCalledWith('stu-1', 'T-kotlin');
  });

  it('hydrates conceptHint on concept_gap', async () => {
    progress.getRecommendation.mockResolvedValueOnce({
      kind: 'concept_gap',
      lesson: { id: 'L1', version: 1, title: 'Optionals', trackId: 'T1', trackTitle: 'Swift' },
      reason: { message: 'practice optionals', concept: 'optionals', passed: 1, total: 4 },
    });
    lessons.findByVersionWithBlocks.mockResolvedValueOnce(
      stubLessonWithBlocks('L1', 1, 1, [{ id: 'ex1', version: 1 }]),
    );
    exercises.findByVersion.mockResolvedValueOnce({ id: 'ex1', version: 1, type: 'multiple_choice' });

    const r = await svc.resolve('stu-1', 'T1');
    expect(r?.conceptHint).toBe('optionals');
    expect(r?.recommendationKind).toBe('concept_gap');
  });

  it('returns null when lesson lookup misses', async () => {
    progress.getRecommendation.mockResolvedValueOnce(stubRecommendation());
    lessons.findByVersionWithBlocks.mockResolvedValueOnce(null);
    const r = await svc.resolve('stu-1', undefined);
    expect(r).toBeNull();
  });

  it('skips concept blocks (no exerciseId) when computing exercises', async () => {
    progress.getRecommendation.mockResolvedValueOnce(stubRecommendation());
    lessons.findByVersionWithBlocks.mockResolvedValueOnce(
      stubLessonWithBlocks('L2', 1, 8, [null, { id: 'ex1', version: 1 }, null]),
    );
    exercises.findByVersion.mockResolvedValueOnce({ id: 'ex1', version: 1, type: 'multiple_choice' });

    const r = await svc.resolve('stu-1', undefined);
    expect(exercises.findByVersion).toHaveBeenCalledTimes(1);
    expect(r?.estimatedMinutes).toBe(1);
    expect(r?.typeLabel).toBe('Concept + quiz');
  });
});
