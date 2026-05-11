import { MasteryService } from '../../src/gamification/mastery.service';

describe('MasteryService', () => {
  const svc = new MasteryService();

  describe('compute', () => {
    it.each([
      [0,    1, 0,    100],
      [99,   1, 99,   1],
      [100,  2, 0,    200],
      [299,  2, 199,  1],
      [300,  3, 0,    300],
      [599,  3, 299,  1],
      [600,  4, 0,    400],
      [999,  4, 399,  1],
      [1000, 5, 0,    500],
      [1499, 5, 499,  1],
      [1500, 6, 0,    600],
    ])(
      'totalPoints=%i → level=%i, xpInLevel=%i, xpForNextLevel=%i',
      (totalPoints, level, xpInLevel, xpForNextLevel) => {
        expect(svc.compute(totalPoints)).toEqual({ level, xpInLevel, xpForNextLevel });
      },
    );

    it('handles totalPoints far above the table (extrapolates)', () => {
      const r = svc.compute(10_000);
      expect(r.level).toBeGreaterThan(10);
      expect(r.xpInLevel).toBeGreaterThanOrEqual(0);
      expect(r.xpForNextLevel).toBeGreaterThan(0);
    });
  });
});
