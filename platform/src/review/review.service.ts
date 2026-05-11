import { Injectable, Inject, Logger } from '@nestjs/common';
import { Exercise } from '@prisma/client';
import { ReviewRepository } from './review.repository';
import { ReviewProvider, REVIEW_PROVIDER } from './review-provider.interface';
import { buildReviewPrompt } from './prompt-builder';
import { ExercisePayload } from '../content/types/exercise-payload.types';

@Injectable()
export class ReviewService {
  private readonly logger = new Logger(ReviewService.name);
  readonly enabled = process.env.AI_REVIEW_ENABLED === 'true';

  constructor(
    private readonly repository: ReviewRepository,
    @Inject(REVIEW_PROVIDER) private readonly provider: ReviewProvider,
  ) {}

  async generateReview(
    attemptId: string,
    studentId: string,
    exercise: Exercise,
    code: string,
    passed: boolean,
    stderr: string,
  ): Promise<void> {
    if (!this.enabled) return;

    const payload = exercise.payload as unknown as ExercisePayload;
    if (payload.type !== 'code' && payload.type !== 'fix_bug') return;

    try {
      const language = payload.language;
      const prompt = buildReviewPrompt({
        language,
        promptMarkdown: exercise.promptMarkdown,
        code,
        passed,
        stderr,
      });

      const markdown = await this.provider.review(prompt);

      await this.repository.create({ attemptId, studentId, markdown });
    } catch (err) {
      this.logger.warn('Failed to generate review', err);
    }
  }

  async waitForReview(
    attemptId: string,
    opts: { timeoutMs: number; pollIntervalMs?: number } = { timeoutMs: 30_000 },
  ): Promise<{ markdown: string; createdAt: Date } | null> {
    const interval = opts.pollIntervalMs ?? 250;
    const deadline = Date.now() + opts.timeoutMs;
    while (Date.now() <= deadline) {
      const review = await this.repository.findByAttemptId(attemptId);
      if (review) return { markdown: review.markdown, createdAt: review.createdAt };
      if (Date.now() + interval > deadline) break;
      await new Promise((r) => setTimeout(r, interval));
    }
    return null;
  }
}
