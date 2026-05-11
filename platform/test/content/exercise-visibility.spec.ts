import { ExerciseVisibility } from '@prisma/client';
import { ExerciseRepository } from '../../src/content/repositories/exercise.repository';

// Focused unit test for the new G-side ExerciseRepository methods that
// drive visibility-scoped lookup + per-author lookup. Mocks Prisma so we
// can assert the query shape without paying DB cost (the broader DB suite
// covers the create/createNextVersion/publish paths against real Postgres).

describe('ExerciseRepository — G additions', () => {
  let repo: ExerciseRepository;
  const findMany = jest.fn();
  const mockPrisma = { exercise: { findMany } } as any;

  beforeEach(() => {
    findMany.mockReset();
    repo = new ExerciseRepository(mockPrisma);
  });

  // ── findByAuthor ──────────────────────────────────────────────────────────
  describe('findByAuthor', () => {
    it('queries by authorId and reduces to latest version per exercise id', async () => {
      // Two exercises with multiple versions each — newest version of each id wins.
      findMany.mockResolvedValueOnce([
        { id: 'a', version: 3, authorId: 'u1' },
        { id: 'a', version: 2, authorId: 'u1' },
        { id: 'a', version: 1, authorId: 'u1' },
        { id: 'b', version: 2, authorId: 'u1' },
        { id: 'b', version: 1, authorId: 'u1' },
      ]);
      const r = await repo.findByAuthor('u1');
      expect(r.map((x) => `${x.id}@${x.version}`)).toEqual(['a@3', 'b@2']);
      expect(findMany).toHaveBeenCalledWith({
        where: { authorId: 'u1' },
        orderBy: [{ id: 'asc' }, { version: 'desc' }],
      });
    });

    it('returns [] when the instructor has authored nothing', async () => {
      findMany.mockResolvedValueOnce([]);
      const r = await repo.findByAuthor('u1');
      expect(r).toEqual([]);
    });
  });

  // ── findVisibleForStudent ─────────────────────────────────────────────────
  describe('findVisibleForStudent', () => {
    it('builds the four-scope OR filter when cohortId is present', async () => {
      findMany.mockResolvedValueOnce([]);
      await repo.findVisibleForStudent({
        lessonId: 'L1',
        studentId: 'S1',
        cohortId: 'C1',
        trackId: 'T1',
      });
      const args = findMany.mock.calls[0][0];
      expect(args.where.lessonId).toBe('L1');
      expect(args.where.publishedAt).toEqual({ not: null });
      expect(args.where.OR).toEqual([
        { visibility: ExerciseVisibility.public },
        { visibility: ExerciseVisibility.track, scopeId: 'T1' },
        { visibility: ExerciseVisibility.private_to_student, scopeId: 'S1' },
        { visibility: ExerciseVisibility.cohort, scopeId: 'C1' },
      ]);
    });

    it('omits the cohort branch when the student has no cohort', async () => {
      findMany.mockResolvedValueOnce([]);
      await repo.findVisibleForStudent({
        lessonId: 'L1',
        studentId: 'S1',
        cohortId: null,
        trackId: 'T1',
      });
      const args = findMany.mock.calls[0][0];
      expect(args.where.OR).toEqual([
        { visibility: ExerciseVisibility.public },
        { visibility: ExerciseVisibility.track, scopeId: 'T1' },
        { visibility: ExerciseVisibility.private_to_student, scopeId: 'S1' },
      ]);
    });

    it('reduces results to the latest version per exercise id', async () => {
      findMany.mockResolvedValueOnce([
        { id: 'x', version: 5 },
        { id: 'x', version: 4 },
        { id: 'y', version: 1 },
      ]);
      const r = await repo.findVisibleForStudent({
        lessonId: 'L1',
        studentId: 'S1',
        cohortId: 'C1',
        trackId: 'T1',
      });
      expect(r.map((x) => `${x.id}@${x.version}`)).toEqual(['x@5', 'y@1']);
    });

    it('returns [] when no exercises match the lesson + visibility filters', async () => {
      findMany.mockResolvedValueOnce([]);
      const r = await repo.findVisibleForStudent({
        lessonId: 'L1',
        studentId: 'S1',
        cohortId: 'C1',
        trackId: 'T1',
      });
      expect(r).toEqual([]);
    });
  });
});
