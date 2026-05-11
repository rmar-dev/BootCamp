import { StudentRepository } from '../../src/state/repositories/student.repository';

describe('StudentRepository — instructor assignment', () => {
  let repo: StudentRepository;
  const findMany = jest.fn();
  const update = jest.fn();
  const mockPrisma = { student: { findMany, update } } as any;

  beforeEach(() => {
    findMany.mockReset();
    update.mockReset();
    repo = new StudentRepository(mockPrisma);
  });

  describe('findByInstructor', () => {
    it('queries by instructorId and orders by createdAt asc', async () => {
      const rows = [{ id: 's1' }, { id: 's2' }];
      findMany.mockResolvedValueOnce(rows);
      const r = await repo.findByInstructor('user-1');
      expect(r).toBe(rows);
      expect(findMany).toHaveBeenCalledWith({
        where: { instructorId: 'user-1' },
        orderBy: { createdAt: 'asc' },
      });
    });

    it('returns empty array when instructor has no students', async () => {
      findMany.mockResolvedValueOnce([]);
      const r = await repo.findByInstructor('user-1');
      expect(r).toEqual([]);
    });
  });

  describe('findUnassigned', () => {
    it('queries for instructorId IS NULL ordered by createdAt asc', async () => {
      const rows = [{ id: 's3' }];
      findMany.mockResolvedValueOnce(rows);
      const r = await repo.findUnassigned();
      expect(r).toBe(rows);
      expect(findMany).toHaveBeenCalledWith({
        where: { instructorId: null },
        orderBy: { createdAt: 'asc' },
      });
    });
  });

  describe('assignInstructor', () => {
    it('sets instructorId to the given userId', async () => {
      const updated = { id: 's1', instructorId: 'user-1' };
      update.mockResolvedValueOnce(updated);
      const r = await repo.assignInstructor('s1', 'user-1');
      expect(r).toBe(updated);
      expect(update).toHaveBeenCalledWith({
        where: { id: 's1' },
        data: { instructorId: 'user-1' },
      });
    });

    it('clears instructorId when passed null (release / unassign)', async () => {
      const updated = { id: 's1', instructorId: null };
      update.mockResolvedValueOnce(updated);
      const r = await repo.assignInstructor('s1', null);
      expect(r).toBe(updated);
      expect(update).toHaveBeenCalledWith({
        where: { id: 's1' },
        data: { instructorId: null },
      });
    });
  });
});
