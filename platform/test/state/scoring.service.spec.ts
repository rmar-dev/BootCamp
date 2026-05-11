import { ScoringService } from '../../src/state/services/scoring.service';

describe('ScoringService.computePoints', () => {
  const svc = new ScoringService();

  it('returns 0 for failed submissions regardless of inputs', () => {
    expect(
      svc.computePoints({
        passed: false,
        pointsMax: 100,
        hintsUsedCount: 0,
        failedAttemptsBefore: 0,
      }),
    ).toBe(0);
  });

  it('returns full points for a clean first-try pass', () => {
    expect(
      svc.computePoints({
        passed: true,
        pointsMax: 100,
        hintsUsedCount: 0,
        failedAttemptsBefore: 0,
      }),
    ).toBe(100);
  });

  it('subtracts 10 percent of pointsMax per hint used', () => {
    expect(
      svc.computePoints({
        passed: true,
        pointsMax: 100,
        hintsUsedCount: 2,
        failedAttemptsBefore: 0,
      }),
    ).toBe(80);
  });

  it('subtracts 5 percent of pointsMax per failed prior attempt', () => {
    expect(
      svc.computePoints({
        passed: true,
        pointsMax: 100,
        hintsUsedCount: 0,
        failedAttemptsBefore: 3,
      }),
    ).toBe(85);
  });

  it('combines hint and failed-attempt penalties', () => {
    expect(
      svc.computePoints({
        passed: true,
        pointsMax: 100,
        hintsUsedCount: 1,
        failedAttemptsBefore: 2,
      }),
    ).toBe(80);
  });

  it('floors at 20 percent of pointsMax', () => {
    expect(
      svc.computePoints({
        passed: true,
        pointsMax: 100,
        hintsUsedCount: 10,
        failedAttemptsBefore: 10,
      }),
    ).toBe(20);
  });

  it('rounds down to integer points', () => {
    expect(
      svc.computePoints({
        passed: true,
        pointsMax: 50,
        hintsUsedCount: 1,
        failedAttemptsBefore: 0,
      }),
    ).toBe(45);
  });

  it('handles a non-multiple-of-10 pointsMax with proper flooring', () => {
    // 33 - (1 * 0.10 * 33) = 33 - 3.3 = 29.7 → 29
    expect(
      svc.computePoints({
        passed: true,
        pointsMax: 33,
        hintsUsedCount: 1,
        failedAttemptsBefore: 0,
      }),
    ).toBe(29);
  });
});
