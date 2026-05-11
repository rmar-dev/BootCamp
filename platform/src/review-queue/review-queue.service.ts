import { Injectable, NotFoundException, ConflictException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { StudentRepository } from '../state/repositories/student.repository';
import { Attempt } from '@prisma/client';
import { newId } from '../shared/ids';
import { intervalDaysFor, addDays, MAX_STEP } from './intervals';
import { serverCheck } from '../submission/server-check';
import { ExercisePayload } from '../content/types/exercise-payload.types';

export type ReviewQueueItem = {
  cardId: string;
  exerciseId: string;
  step: number;
  dueAt: string;
  exercise: {
    id: string;
    version: number;
    type: 'fill_blank' | 'predict_output' | 'multiple_choice';
    promptMarkdown: string;
    payload: unknown;
    pointsMax: number;
  };
};

export type ReviewSubmitResult = {
  passed: boolean;
  card: {
    step: number;
    nextDueAt: string | null;
    retiredAt: string | null;
  };
};

@Injectable()
export class ReviewQueueService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly students: StudentRepository,
  ) {}

  // Called by SubmissionService after each passing attempt. Idempotent.
  async handleSubmission(studentId: string, attempt: Attempt): Promise<void> {
    if (!attempt.passed) return;

    const struggled = attempt.failedAttemptsBefore > 0 || attempt.hintsUsedCount > 0;
    if (!struggled) return;

    const exercise = await this.prisma.exercise.findFirst({
      where: { id: attempt.exerciseId },
      orderBy: { version: 'desc' },
      select: { type: true },
    });
    if (!exercise) return;
    if (exercise.type !== 'fill_blank' && exercise.type !== 'predict_output' && exercise.type !== 'multiple_choice') {
      return;
    }

    const now = new Date();
    const nextDueAt = addDays(now, intervalDaysFor(1));

    try {
      await this.prisma.reviewCard.create({
        data: {
          id: newId(),
          studentId,
          exerciseId: attempt.exerciseId,
          step: 1,
          nextDueAt,
          createdAt: now,
        },
      });
    } catch (err: any) {
      // Unique constraint violation on (studentId, exerciseId) — card already exists, ignore.
      if (err?.code === 'P2002') return;
      throw err;
    }
  }

  async getDueCards(studentId: string): Promise<ReviewQueueItem[]> {
    const now = new Date();
    const cards = await this.prisma.reviewCard.findMany({
      where: {
        studentId,
        retiredAt: null,
        nextDueAt: { lte: now },
      },
      orderBy: { nextDueAt: 'asc' },
    });
    if (cards.length === 0) return [];

    const exerciseIds = [...new Set(cards.map((c) => c.exerciseId))];

    // Fetch all published exercise versions for these ids; keep the latest version per id.
    const exerciseRows = await this.prisma.exercise.findMany({
      where: { id: { in: exerciseIds }, publishedAt: { not: null } },
      orderBy: [{ id: 'asc' }, { version: 'desc' }],
      select: {
        id: true,
        version: true,
        type: true,
        promptMarkdown: true,
        payload: true,
        pointsMax: true,
      },
    });
    const latestByExerciseId = new Map<string, (typeof exerciseRows)[number]>();
    for (const ex of exerciseRows) {
      if (!latestByExerciseId.has(ex.id)) latestByExerciseId.set(ex.id, ex);
    }

    const items: ReviewQueueItem[] = [];
    for (const card of cards) {
      const ex = latestByExerciseId.get(card.exerciseId);
      if (!ex) continue; // No published version — filter out
      if (ex.type !== 'fill_blank' && ex.type !== 'predict_output' && ex.type !== 'multiple_choice') {
        continue; // Defensive: card was created for a quiz, but exercise type changed — skip
      }
      items.push({
        cardId: card.id,
        exerciseId: card.exerciseId,
        step: card.step,
        dueAt: card.nextDueAt.toISOString(),
        exercise: {
          id: ex.id,
          version: ex.version,
          type: ex.type,
          promptMarkdown: ex.promptMarkdown,
          payload: ex.payload,
          pointsMax: ex.pointsMax,
        },
      });
    }

    return items;
  }

  async submitReview(
    studentId: string,
    cardId: string,
    payload: unknown,
  ): Promise<ReviewSubmitResult> {
    const card = await this.prisma.reviewCard.findUnique({ where: { id: cardId } });
    if (!card || card.studentId !== studentId) {
      throw new NotFoundException('Review card not found');
    }
    if (card.retiredAt !== null) {
      throw new ConflictException('Review card is already retired');
    }

    const exercise = await this.prisma.exercise.findFirst({
      where: { id: card.exerciseId, publishedAt: { not: null } },
      orderBy: { version: 'desc' },
    });
    if (!exercise) {
      throw new NotFoundException('Underlying exercise is not currently published');
    }

    // Translate the client-side submission payload into what serverCheck expects.
    let answer: unknown;
    switch (exercise.type) {
      case 'multiple_choice': {
        const p = payload as { selectedOptionIds?: unknown };
        if (!p || !Array.isArray(p.selectedOptionIds)) {
          throw new BadRequestException('Invalid submission payload');
        }
        answer = p.selectedOptionIds;
        break;
      }
      case 'fill_blank': {
        if (typeof payload !== 'object' || payload === null) {
          throw new BadRequestException('Invalid submission payload');
        }
        answer = payload;
        break;
      }
      case 'predict_output': {
        answer = payload;
        break;
      }
      default:
        throw new ConflictException('Card exercise type is not a quiz');
    }

    const { passed } = serverCheck(exercise.payload as unknown as ExercisePayload, answer);

    const now = new Date();
    const result = await this.prisma.$transaction(async (tx) => {
      await tx.reviewAttempt.create({
        data: {
          id: newId(),
          reviewCardId: card.id,
          studentId,
          exerciseId: card.exerciseId,
          submittedAt: now,
          passed,
        },
      });

      let nextStep: number;
      let retiredAt: Date | null = null;
      let nextDueAt: Date;
      if (passed) {
        if (card.step + 1 > MAX_STEP) {
          nextStep = card.step;       // don't advance step past MAX; retire instead
          retiredAt = now;
          nextDueAt = card.nextDueAt; // frozen
        } else {
          nextStep = card.step + 1;
          nextDueAt = addDays(now, intervalDaysFor(nextStep));
        }
      } else {
        nextStep = 1;
        nextDueAt = addDays(now, intervalDaysFor(1));
      }

      const updated = await tx.reviewCard.update({
        where: { id: card.id },
        data: { step: nextStep, nextDueAt, lastReviewedAt: now, retiredAt },
      });
      return updated;
    });

    return {
      passed,
      card: {
        step: result.step,
        nextDueAt: result.retiredAt ? null : result.nextDueAt.toISOString(),
        retiredAt: result.retiredAt ? result.retiredAt.toISOString() : null,
      },
    };
  }
}
