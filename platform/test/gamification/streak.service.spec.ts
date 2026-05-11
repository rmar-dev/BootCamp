import { StreakService } from '../../src/gamification/streak.service';
import { AttemptRepository } from '../../src/state/repositories/attempt.repository';

function daysAgo(n: number): Date {
  const d = new Date();
  d.setUTCHours(12, 0, 0, 0); // noon UTC so no timezone edge cases
  d.setUTCDate(d.getUTCDate() - n);
  return d;
}

function today(): Date {
  return daysAgo(0);
}

describe('StreakService', () => {
  let service: StreakService;
  let mockAttempts: jest.Mocked<Pick<AttemptRepository, 'listSubmissionDatesByStudent'>>;
  const mockPrisma = {
    reviewAttempt: {
      findMany: jest.fn().mockResolvedValue([]),
    },
  };

  beforeEach(() => {
    mockAttempts = {
      listSubmissionDatesByStudent: jest.fn(),
    };
    service = new StreakService(
      mockAttempts as unknown as AttemptRepository,
      mockPrisma as any,
    );
  });

  it('returns streak 0 with no attempts', async () => {
    mockAttempts.listSubmissionDatesByStudent.mockResolvedValue([]);
    const result = await service.getCurrentStreak('student-1');
    expect(result).toEqual({ current: 0, activeToday: false, incrementedToday: false });
  });

  it('returns streak 1 with only today submission', async () => {
    mockAttempts.listSubmissionDatesByStudent.mockResolvedValue([today()]);
    const result = await service.getCurrentStreak('student-1');
    expect(result).toEqual({ current: 1, activeToday: true, incrementedToday: true });
  });

  it('returns streak 1 with only yesterday submission, activeToday false', async () => {
    mockAttempts.listSubmissionDatesByStudent.mockResolvedValue([daysAgo(1)]);
    const result = await service.getCurrentStreak('student-1');
    expect(result).toEqual({ current: 1, activeToday: false, incrementedToday: false });
  });

  it('returns correct streak for consecutive days including today', async () => {
    mockAttempts.listSubmissionDatesByStudent.mockResolvedValue([
      today(),
      daysAgo(1),
      daysAgo(2),
      daysAgo(3),
    ]);
    const result = await service.getCurrentStreak('student-1');
    expect(result).toEqual({ current: 4, activeToday: true, incrementedToday: true });
  });

  it('breaks streak at a gap — only counts from most recent consecutive run', async () => {
    mockAttempts.listSubmissionDatesByStudent.mockResolvedValue([
      today(),
      daysAgo(1),
      // gap: daysAgo(2) missing
      daysAgo(3),
      daysAgo(4),
    ]);
    const result = await service.getCurrentStreak('student-1');
    expect(result).toEqual({ current: 2, activeToday: true, incrementedToday: true });
  });

  it('returns streak 0 when most recent submission is older than yesterday', async () => {
    mockAttempts.listSubmissionDatesByStudent.mockResolvedValue([
      daysAgo(5),
      daysAgo(6),
      daysAgo(7),
    ]);
    const result = await service.getCurrentStreak('student-1');
    expect(result).toEqual({ current: 0, activeToday: false, incrementedToday: false });
  });

  it('exposes incrementedToday: true when most recent activity is today', async () => {
    mockAttempts.listSubmissionDatesByStudent.mockResolvedValueOnce([today(), daysAgo(1), daysAgo(2)]);
    const r = await service.getCurrentStreak('s1');
    expect(r.incrementedToday).toBe(true);
  });

  it('exposes incrementedToday: false when most recent activity was yesterday', async () => {
    mockAttempts.listSubmissionDatesByStudent.mockResolvedValueOnce([daysAgo(1), daysAgo(2)]);
    const r = await service.getCurrentStreak('s1');
    expect(r.incrementedToday).toBe(false);
  });

  it('exposes incrementedToday: false on empty streak', async () => {
    mockAttempts.listSubmissionDatesByStudent.mockResolvedValueOnce([]);
    const r = await service.getCurrentStreak('s1');
    expect(r.incrementedToday).toBe(false);
  });
});
