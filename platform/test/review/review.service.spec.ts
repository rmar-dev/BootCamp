import { Test } from '@nestjs/testing';
import { ReviewService } from '../../src/review/review.service';
import { ReviewRepository } from '../../src/review/review.repository';
import { ReviewProvider, REVIEW_PROVIDER } from '../../src/review/review-provider.interface';
import { newId } from '../../src/shared/ids';

function makeExercise(type: string, language = 'swift') {
  return {
    id: newId(),
    version: 1,
    lessonId: newId(),
    promptMarkdown: 'Write a function.',
    type,
    payload: {
      type,
      language,
      starterCode: '',
      testCode: '',
      testEntryPoint: 'run',
    },
    pointsMax: 100,
    hints: [],
    concepts: [],
    publishedAt: new Date(),
  } as any;
}

function makeService(providerOverride?: Partial<ReviewProvider>) {
  const repository = {
    create: jest.fn().mockResolvedValue({}),
    findByAttemptId: jest.fn(),
  } as unknown as ReviewRepository;

  const provider: ReviewProvider = {
    review: jest.fn().mockResolvedValue('Great code!'),
    ...providerOverride,
  };

  const svc = new ReviewService(repository, provider);
  return { svc, repository, provider };
}

describe('ReviewService', () => {
  beforeEach(() => {
    process.env.AI_REVIEW_ENABLED = 'true';
  });

  afterEach(() => {
    delete process.env.AI_REVIEW_ENABLED;
  });

  it('generates a review for a code exercise', async () => {
    const { svc, repository, provider } = makeService();
    const attemptId = newId();
    const studentId = newId();
    const exercise = makeExercise('code');

    await svc.generateReview(attemptId, studentId, exercise, 'let x = 1', true, '');

    expect(provider.review).toHaveBeenCalledTimes(1);
    expect(repository.create).toHaveBeenCalledWith(
      expect.objectContaining({ attemptId, studentId, markdown: 'Great code!' }),
    );
  });

  it('skips review for multiple_choice exercise', async () => {
    const { svc, repository, provider } = makeService();
    const exercise = makeExercise('multiple_choice');

    await svc.generateReview(newId(), newId(), exercise, '', true, '');

    expect(provider.review).not.toHaveBeenCalled();
    expect(repository.create).not.toHaveBeenCalled();
  });

  it('is a no-op when AI_REVIEW_ENABLED is not true', async () => {
    delete process.env.AI_REVIEW_ENABLED;
    const { svc, repository, provider } = makeService();
    const exercise = makeExercise('code');

    await svc.generateReview(newId(), newId(), exercise, 'let x = 1', true, '');

    expect(provider.review).not.toHaveBeenCalled();
    expect(repository.create).not.toHaveBeenCalled();
  });

  it('catches errors from the provider and does not throw', async () => {
    const { svc } = makeService({
      review: jest.fn().mockRejectedValue(new Error('Provider failure')),
    });
    const exercise = makeExercise('fix_bug');

    await expect(
      svc.generateReview(newId(), newId(), exercise, 'broken code', false, 'error'),
    ).resolves.not.toThrow();
  });
});

describe('ReviewService.waitForReview', () => {
  let service: ReviewService;
  let repo: { findByAttemptId: jest.Mock };

  beforeEach(async () => {
    repo = { findByAttemptId: jest.fn() };
    const module = await Test.createTestingModule({
      providers: [
        ReviewService,
        { provide: ReviewRepository, useValue: repo },
        { provide: REVIEW_PROVIDER, useValue: { review: jest.fn() } },
      ],
    }).compile();
    service = module.get(ReviewService);
  });

  it('returns review immediately if already present', async () => {
    repo.findByAttemptId.mockResolvedValue({ markdown: 'done', createdAt: new Date() });
    const r = await service.waitForReview('a-1', { timeoutMs: 100, pollIntervalMs: 10 });
    expect(r?.markdown).toBe('done');
    expect(repo.findByAttemptId).toHaveBeenCalledTimes(1);
  });

  it('polls until review appears', async () => {
    repo.findByAttemptId
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ markdown: 'ready', createdAt: new Date() });
    const r = await service.waitForReview('a-2', { timeoutMs: 1000, pollIntervalMs: 10 });
    expect(r?.markdown).toBe('ready');
    expect(repo.findByAttemptId).toHaveBeenCalledTimes(3);
  });

  it('returns null on timeout', async () => {
    repo.findByAttemptId.mockResolvedValue(null);
    const r = await service.waitForReview('a-3', { timeoutMs: 50, pollIntervalMs: 10 });
    expect(r).toBeNull();
  });
});
