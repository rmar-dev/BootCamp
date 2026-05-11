import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { ExerciseRepository } from '../content/repositories/exercise.repository';
import { RunnerService } from '../execution/runner.service';
import { AttemptService } from '../state/services/attempt.service';
import { EnsureStudentService } from './ensure-student';
import { ExerciseResultRepository } from '../state/repositories/exercise-result.repository';
import { ExercisePayload } from '../content/types/exercise-payload.types';
import { SubmissionPayload } from '../content/types/submission-payload.types';
import { serverCheck } from './server-check';
import { BadgeService } from '../gamification/badge.service';
import { BadgeDefinition } from '../gamification/badge.definitions';
import { ReviewService } from '../review/review.service';
import { ReviewQueueService } from '../review-queue/review-queue.service';
import { PrismaService } from '../prisma/prisma.service';
import { ExerciseAttemptStatus } from '../content/types/attempt-status';
import { computeStatus } from '../content/services/attempt-status.util';

export type SubmitRequest = {
  exerciseId: string;
  exerciseVersion: number;
  code?: string;
  answer?: unknown;
  repoUrl?: string;
  commitSha?: string;
  notes?: string;
};

export type SubmitResponse = {
  passed: boolean;
  pointsAwarded: number;
  totalPointsExercise: number;
  totalPoints: number;
  outcome?: string;
  stdout?: string;
  stderr?: string;
  newBadges: BadgeDefinition[];
  attemptId: string;
  newAttemptStatus: ExerciseAttemptStatus;
};

@Injectable()
export class SubmissionService {
  private readonly logger = new Logger(SubmissionService.name);

  constructor(
    private readonly exercises: ExerciseRepository,
    private readonly runner: RunnerService,
    private readonly attemptService: AttemptService,
    private readonly ensureStudentSvc: EnsureStudentService,
    private readonly results: ExerciseResultRepository,
    private readonly badgeService: BadgeService,
    private readonly reviewService: ReviewService,
    private readonly reviewQueueService: ReviewQueueService,
    private readonly prisma: PrismaService,
  ) {}

  async submit(userId: string, req: SubmitRequest): Promise<SubmitResponse> {
    // 1. Fetch exercise
    const exercise = await this.exercises.findByVersion(
      req.exerciseId,
      req.exerciseVersion,
    );
    if (!exercise || !exercise.publishedAt) {
      throw new NotFoundException(
        `Exercise ${req.exerciseId} v${req.exerciseVersion} not found`,
      );
    }

    // 2. Cast payload
    const payload = exercise.payload as unknown as ExercisePayload;

    // 3. Check answer
    let passed: boolean;
    let outcome: string | undefined;
    let stdout: string | undefined;
    let stderr: string | undefined;

    if (payload.type === 'code' || payload.type === 'fix_bug') {
      const runResponse = await this.runner.run({
        exerciseId: req.exerciseId,
        exerciseVersion: req.exerciseVersion,
        code: req.code!,
      });
      passed = runResponse.passed;
      outcome = runResponse.outcome;
      stdout = runResponse.stdout;
      stderr = runResponse.stderr;
    } else if (payload.type === 'capstone_submission') {
      passed = false;
      outcome = 'pending_review';
    } else if (payload.type === 'visual_playground') {
      // Visual playgrounds are exploration-only — auto-pass when submitted.
      // Points are typically authored as 0; if non-zero, the student gets
      // them just for engaging.
      passed = true;
    } else {
      const checkResult = serverCheck(payload, req.answer);
      passed = checkResult.passed;
    }

    // 5. Ensure student
    const student = await this.ensureStudentSvc.ensureStudent(userId);
    const studentId = student.id;

    // 6. Build SubmissionPayload
    let submissionPayload: SubmissionPayload;
    switch (payload.type) {
      case 'code':
        submissionPayload = { type: 'code', code: req.code! };
        break;
      case 'fix_bug':
        submissionPayload = { type: 'fix_bug', code: req.code! };
        break;
      case 'multiple_choice':
        submissionPayload = {
          type: 'multiple_choice',
          selectedOptionIds: req.answer as string[],
        };
        break;
      case 'fill_blank':
        submissionPayload = {
          type: 'fill_blank',
          blanks: req.answer as Record<string, string>,
        };
        break;
      case 'predict_output':
        submissionPayload = {
          type: 'predict_output',
          answer: String(req.answer),
        };
        break;
      case 'capstone_submission':
        submissionPayload = {
          type: 'capstone_submission',
          repoUrl: req.repoUrl!,
          commitSha: req.commitSha!,
          notes: req.notes ?? '',
        };
        break;
      case 'visual_playground':
        submissionPayload = {
          type: 'visual_playground',
          state: (req.answer as Record<string, string | number | boolean>) ?? {},
        };
        break;
    }

    // 7. Record attempt
    const { attempt, exerciseResult } = await this.attemptService.recordAttempt({
      studentId,
      exerciseId: req.exerciseId,
      exerciseVersion: req.exerciseVersion,
      submissionPayload,
      passed,
      hintsUsedCount: 0,
    });

    // 8. Sum all points for student
    const allResults = await this.results.listByStudent(studentId);
    const totalPoints = allResults.reduce((sum, r) => sum + r.pointsEarned, 0);

    // 9. Check and award badges. BadgeService returns the full Prisma Badge
    // rows; we narrow to the public BadgeDefinition shape so internal columns
    // (authorUserId, scopeId, criteriaKind, ...) never leak to the client.
    //
    // Per the project invariant ("Gamification cannot fail submission") this
    // path MUST swallow errors: with the DB-backed badge service, a Postgres
    // hiccup or scope-resolution failure must not turn a successful exercise
    // submission into a 500. On failure we log + return zero new badges; the
    // student keeps their points and the next submission will retry.
    let newBadges: BadgeDefinition[] = [];
    try {
      const awardedBadges = await this.badgeService.checkAndAward(studentId, {
        attempt,
        exerciseResult,
        totalPoints,
        exerciseType: exercise.type,
        exerciseId: req.exerciseId,
        lessonId: exercise.lessonId,
        lessonVersion: 1,
      });
      newBadges = awardedBadges.map((b) => ({
        id: b.code,
        name: b.name,
        description: b.description,
        icon: b.icon,
      }));
    } catch (err) {
      this.logger.warn(
        `badge award failed for student=${studentId} attempt=${attempt.id}: ${
          err instanceof Error ? err.message : String(err)
        }`,
      );
    }

    // 10. Fire-and-forget review generation for code/fix_bug
    if (payload.type === 'code' || payload.type === 'fix_bug') {
      this.reviewService.generateReview(attempt.id, studentId, exercise, req.code!, passed, stderr ?? '')
        .catch((err) => this.logger.warn('review generation failed', err));
    }

    // 10b. Fire-and-forget review-queue card creation for quiz passes
    if (passed) {
      this.reviewQueueService.handleSubmission(studentId, attempt)
        .catch((err) => this.logger.warn('review-queue handleSubmission failed', err));
    }

    // 11. Query version-scoped attempts to compute post-insert status
    const versionScopedAttempts = await this.prisma.attempt.findMany({
      where: { studentId, exerciseId: req.exerciseId, exerciseVersion: req.exerciseVersion },
      orderBy: { submittedAt: 'asc' },
      select: { passed: true },
    });
    const newAttemptStatus = computeStatus(versionScopedAttempts);

    // 12. Return response
    return {
      passed,
      pointsAwarded: attempt.pointsAwarded,
      totalPointsExercise: exerciseResult.pointsEarned,
      totalPoints,
      outcome,
      stdout,
      stderr,
      newBadges,
      attemptId: attempt.id,
      newAttemptStatus,
    };
  }
}
