import { ExerciseResultRepository } from '../../src/state/repositories/exercise-result.repository';

describe('ExerciseResultRepository.sumPointsSince', () => {
  let repo: ExerciseResultRepository;
  const aggregate = jest.fn();
  const mockPrisma = { exerciseResult: { aggregate } } as any;

  beforeEach(() => {
    aggregate.mockReset();
    repo = new ExerciseResultRepository(mockPrisma);
  });

  it('returns 0 when no rows match', async () => {
    aggregate.mockResolvedValueOnce({ _sum: { pointsEarned: null } });
    const since = new Date('2026-05-02T00:00:00Z');
    const r = await repo.sumPointsSince('student-1', since);
    expect(r).toBe(0);
    expect(aggregate).toHaveBeenCalledWith({
      where: { studentId: 'student-1', firstPassedAt: { gte: since } },
      _sum: { pointsEarned: true },
    });
  });

  it('returns the sum when rows match', async () => {
    aggregate.mockResolvedValueOnce({ _sum: { pointsEarned: 42 } });
    const r = await repo.sumPointsSince('student-1', new Date('2026-05-02T00:00:00Z'));
    expect(r).toBe(42);
  });
});
