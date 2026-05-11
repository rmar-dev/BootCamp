import { ExamDifficultyOverrideRepository } from '../../src/state/repositories/exam-difficulty-override.repository';

describe('ExamDifficultyOverrideRepository', () => {
  let repo: ExamDifficultyOverrideRepository;
  const findMany = jest.fn();
  const findUnique = jest.fn();
  const upsert = jest.fn();
  const del = jest.fn();
  const mockPrisma = {
    examDifficultyOverride: { findMany, findUnique, upsert, delete: del },
  } as any;

  beforeEach(() => {
    findMany.mockReset();
    findUnique.mockReset();
    upsert.mockReset();
    del.mockReset();
    repo = new ExamDifficultyOverrideRepository(mockPrisma);
  });

  describe('findByStudent', () => {
    it('queries by studentId', async () => {
      const rows = [{ id: 'o1' }, { id: 'o2' }];
      findMany.mockResolvedValueOnce(rows);
      const r = await repo.findByStudent('s1');
      expect(r).toBe(rows);
      expect(findMany).toHaveBeenCalledWith({ where: { studentId: 's1' } });
    });
  });

  describe('findOne', () => {
    it('queries by composite (studentId, exerciseId)', async () => {
      const row = { id: 'o1' };
      findUnique.mockResolvedValueOnce(row);
      const r = await repo.findOne('s1', 'ex1');
      expect(r).toBe(row);
      expect(findUnique).toHaveBeenCalledWith({
        where: { studentId_exerciseId: { studentId: 's1', exerciseId: 'ex1' } },
      });
    });
  });

  describe('upsert', () => {
    it('passes through full input and defaults absent flags to null/false', async () => {
      const row = { id: 'o1' };
      upsert.mockResolvedValueOnce(row);
      const r = await repo.upsert({
        studentId: 's1',
        exerciseId: 'ex1',
        exerciseVersion: 2,
        updatedBy: 'u1',
      });
      expect(r).toBe(row);
      expect(upsert).toHaveBeenCalledWith({
        where: { studentId_exerciseId: { studentId: 's1', exerciseId: 'ex1' } },
        update: {
          exerciseVersion: 2,
          extendTimeMs: null,
          optional: false,
          swapToExerciseId: null,
          swapToExerciseVersion: null,
          updatedBy: 'u1',
        },
        create: {
          studentId: 's1',
          exerciseId: 'ex1',
          exerciseVersion: 2,
          extendTimeMs: null,
          optional: false,
          swapToExerciseId: null,
          swapToExerciseVersion: null,
          updatedBy: 'u1',
        },
      });
    });

    it('passes provided override fields through', async () => {
      upsert.mockResolvedValueOnce({});
      await repo.upsert({
        studentId: 's1',
        exerciseId: 'ex1',
        exerciseVersion: 2,
        extendTimeMs: 60_000,
        optional: true,
        swapToExerciseId: 'ex9',
        swapToExerciseVersion: 1,
        updatedBy: 'u1',
      });
      const args = upsert.mock.calls[0][0];
      expect(args.update).toEqual({
        exerciseVersion: 2,
        extendTimeMs: 60_000,
        optional: true,
        swapToExerciseId: 'ex9',
        swapToExerciseVersion: 1,
        updatedBy: 'u1',
      });
    });

    it("explicitly clears a field when caller passes null (e.g. removing a swap)", async () => {
      upsert.mockResolvedValueOnce({});
      await repo.upsert({
        studentId: 's1',
        exerciseId: 'ex1',
        exerciseVersion: 2,
        swapToExerciseId: null,
        swapToExerciseVersion: null,
        updatedBy: 'u1',
      });
      const args = upsert.mock.calls[0][0];
      expect(args.update.swapToExerciseId).toBeNull();
      expect(args.update.swapToExerciseVersion).toBeNull();
    });
  });

  describe('remove', () => {
    it('deletes by composite key', async () => {
      del.mockResolvedValueOnce({});
      await repo.remove('s1', 'ex1');
      expect(del).toHaveBeenCalledWith({
        where: { studentId_exerciseId: { studentId: 's1', exerciseId: 'ex1' } },
      });
    });
  });
});
