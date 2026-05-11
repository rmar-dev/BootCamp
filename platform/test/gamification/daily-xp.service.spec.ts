import { DailyXpService, DAILY_XP_TARGET } from '../../src/gamification/daily-xp.service';
import { ExerciseResultRepository } from '../../src/state/repositories/exercise-result.repository';

describe('DailyXpService', () => {
  let svc: DailyXpService;
  let repo: jest.Mocked<Pick<ExerciseResultRepository, 'sumPointsSince'>>;

  beforeEach(() => {
    repo = { sumPointsSince: jest.fn() };
    svc = new DailyXpService(repo as unknown as ExerciseResultRepository);
  });

  it('exports DAILY_XP_TARGET = 20', () => {
    expect(DAILY_XP_TARGET).toBe(20);
  });

  it('queries with UTC startOfDay and returns { earned, target }', async () => {
    repo.sumPointsSince.mockResolvedValueOnce(15);
    const r = await svc.compute('student-1');
    expect(r).toEqual({ earned: 15, target: 20 });

    const callArg = repo.sumPointsSince.mock.calls[0][1];
    expect(callArg.getUTCHours()).toBe(0);
    expect(callArg.getUTCMinutes()).toBe(0);
    expect(callArg.getUTCSeconds()).toBe(0);
    expect(callArg.getUTCMilliseconds()).toBe(0);
    const now = new Date();
    expect(callArg.getUTCFullYear()).toBe(now.getUTCFullYear());
    expect(callArg.getUTCMonth()).toBe(now.getUTCMonth());
    expect(callArg.getUTCDate()).toBe(now.getUTCDate());
  });

  it('returns zero earned when repo returns 0', async () => {
    repo.sumPointsSince.mockResolvedValueOnce(0);
    const r = await svc.compute('student-1');
    expect(r).toEqual({ earned: 0, target: 20 });
  });
});
