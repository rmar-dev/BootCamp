import { DifficultyBaseline } from '@prisma/client';
import { StudentDifficultyRepository } from '../../src/state/repositories/student-difficulty.repository';

describe('StudentDifficultyRepository', () => {
  let repo: StudentDifficultyRepository;
  const findUnique = jest.fn();
  const upsert = jest.fn();
  const mockPrisma = { studentDifficulty: { findUnique, upsert } } as any;

  beforeEach(() => {
    findUnique.mockReset();
    upsert.mockReset();
    repo = new StudentDifficultyRepository(mockPrisma);
  });

  describe('findByStudent', () => {
    it('returns the row when present', async () => {
      const row = { studentId: 's1', baseline: DifficultyBaseline.easy };
      findUnique.mockResolvedValueOnce(row);
      const r = await repo.findByStudent('s1');
      expect(r).toBe(row);
      expect(findUnique).toHaveBeenCalledWith({ where: { studentId: 's1' } });
    });

    it('returns null when no row', async () => {
      findUnique.mockResolvedValueOnce(null);
      const r = await repo.findByStudent('s1');
      expect(r).toBeNull();
    });
  });

  describe('getOrDefault', () => {
    it('returns the persisted baseline when a row exists', async () => {
      findUnique.mockResolvedValueOnce({ studentId: 's1', baseline: DifficultyBaseline.challenging });
      const r = await repo.getOrDefault('s1');
      expect(r).toBe(DifficultyBaseline.challenging);
    });

    it("falls back to 'standard' when no row exists, without creating one", async () => {
      findUnique.mockResolvedValueOnce(null);
      const r = await repo.getOrDefault('s1');
      expect(r).toBe(DifficultyBaseline.standard);
      expect(upsert).not.toHaveBeenCalled();
    });
  });

  describe('upsert', () => {
    it('passes baseline + updatedBy on both create and update branches', async () => {
      const row = { studentId: 's1', baseline: DifficultyBaseline.easy, updatedBy: 'u1' };
      upsert.mockResolvedValueOnce(row);
      const r = await repo.upsert('s1', DifficultyBaseline.easy, 'u1');
      expect(r).toBe(row);
      expect(upsert).toHaveBeenCalledWith({
        where: { studentId: 's1' },
        update: { baseline: DifficultyBaseline.easy, updatedBy: 'u1' },
        create: { studentId: 's1', baseline: DifficultyBaseline.easy, updatedBy: 'u1' },
      });
    });
  });
});
