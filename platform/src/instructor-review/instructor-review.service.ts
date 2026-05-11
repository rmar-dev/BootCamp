import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  InstructorReviewRepository,
  InstructorReviewWithMessages,
} from './instructor-review.repository';
import { InstructorReview, ReviewMessage } from '@prisma/client';

export type QueueItem = {
  attemptId: string;
  studentName: string;
  studentEmail: string;
  exerciseId: string;
  exercisePrompt: string;
  lessonTitle: string;
  submittedAt: Date;
  reviewedAt: Date | null;
  queueType: 'code_review' | 'capstone_approval';
};

@Injectable()
export class InstructorReviewService {
  constructor(
    private readonly repo: InstructorReviewRepository,
    private readonly prisma: PrismaService,
  ) {}

  async getPendingQueue(instructorId: string): Promise<QueueItem[]> {
    return this.getQueue(instructorId, false);
  }

  async getReviewedQueue(instructorId: string): Promise<QueueItem[]> {
    return this.getQueue(instructorId, true);
  }

  private async getQueue(instructorId: string, reviewed: boolean): Promise<QueueItem[]> {
    // Find all cohorts for this instructor
    const cohorts = await this.prisma.cohort.findMany({
      where: { instructorId },
      select: { id: true },
    });
    const cohortIds = cohorts.map((c) => c.id);
    if (cohortIds.length === 0) return [];

    // Find students in those cohorts
    const students = await this.prisma.student.findMany({
      where: { cohortId: { in: cohortIds } },
      select: { id: true, name: true, email: true },
    });
    const studentIds = students.map((s) => s.id);
    if (studentIds.length === 0) return [];

    const studentMap = new Map(students.map((s) => [s.id, s]));

    // Find passing exercise results with best attempts
    const results = await this.prisma.exerciseResult.findMany({
      where: { studentId: { in: studentIds }, passed: true },
    });

    // Batch all lookups for exerciseResults (code_review queue)
    const bestAttemptIds = results.map((r) => r.bestAttemptId);
    const resultExerciseIds = results.map((r) => r.exerciseId);

    const [attemptsForResults, reviewsForAttempts, exercisesForResults, blocksForResults] =
      await Promise.all([
        this.prisma.attempt.findMany({ where: { id: { in: bestAttemptIds } } }),
        this.prisma.instructorReview.findMany({ where: { attemptId: { in: bestAttemptIds } } }),
        this.prisma.exercise.findMany({ where: { id: { in: resultExerciseIds } } }),
        this.prisma.block.findMany({ where: { exerciseId: { in: resultExerciseIds } } }),
      ]);

    const attemptMap = new Map(attemptsForResults.map((a) => [a.id, a]));
    const reviewMap = new Map(reviewsForAttempts.map((r) => [r.attemptId, r]));

    // For exercises with compound PK, keep latest version per id
    const exerciseMap = new Map<string, (typeof exercisesForResults)[number]>();
    for (const ex of exercisesForResults) {
      const existing = exerciseMap.get(ex.id);
      if (!existing || ex.version > existing.version) exerciseMap.set(ex.id, ex);
    }

    // For blocks, just take first block per exerciseId
    const blockMap = new Map<string, (typeof blocksForResults)[number]>();
    for (const b of blocksForResults) {
      if (b.exerciseId && !blockMap.has(b.exerciseId)) blockMap.set(b.exerciseId, b);
    }

    // Fetch all lessons needed
    const lessonIdsFromResults = [
      ...new Set(
        blocksForResults.map((b) => b.lessonId).filter(Boolean),
      ),
    ];
    const lessonsForResults = await this.prisma.lesson.findMany({
      where: { id: { in: lessonIdsFromResults } },
    });
    // Keep latest version per lesson id
    const lessonMap = new Map<string, (typeof lessonsForResults)[number]>();
    for (const l of lessonsForResults) {
      const existing = lessonMap.get(l.id);
      if (!existing || l.version > existing.version) lessonMap.set(l.id, l);
    }

    // Filter by whether an instructor review exists
    const items: QueueItem[] = [];
    for (const result of results) {
      const existing = reviewMap.get(result.bestAttemptId) ?? null;
      const hasReview = existing !== null;
      if (hasReview !== reviewed) continue;

      const attempt = attemptMap.get(result.bestAttemptId);
      if (!attempt) continue;

      const exercise = exerciseMap.get(result.exerciseId);
      if (!exercise) continue;

      const block = blockMap.get(result.exerciseId);
      let lessonTitle = 'Unknown';
      if (block) {
        const lesson = lessonMap.get(block.lessonId);
        if (lesson) lessonTitle = lesson.title;
      }

      const student = studentMap.get(result.studentId)!;
      items.push({
        attemptId: result.bestAttemptId,
        studentName: student.name,
        studentEmail: student.email,
        exerciseId: result.exerciseId,
        exercisePrompt: exercise.promptMarkdown,
        lessonTitle,
        submittedAt: attempt.submittedAt,
        reviewedAt: existing?.createdAt ?? null,
        queueType: 'code_review',
      });
    }

    if (!reviewed) {
      const capstoneAttempts = await this.prisma.attempt.findMany({
        where: { studentId: { in: studentIds }, approvedByInstructorId: null, passed: false },
      });

      // Batch lookups for capstone attempts
      const capstoneExerciseIds = [...new Set(capstoneAttempts.map((a) => a.exerciseId))];
      const [capstoneExercises, capstoneBlocks] = await Promise.all([
        this.prisma.exercise.findMany({ where: { id: { in: capstoneExerciseIds } } }),
        this.prisma.block.findMany({ where: { exerciseId: { in: capstoneExerciseIds } } }),
      ]);

      const capstoneExerciseMap = new Map<string, (typeof capstoneExercises)[number]>();
      for (const ex of capstoneExercises) {
        const existing = capstoneExerciseMap.get(ex.id);
        if (!existing || ex.version > existing.version) capstoneExerciseMap.set(ex.id, ex);
      }

      const capstoneBlockMap = new Map<string, (typeof capstoneBlocks)[number]>();
      for (const b of capstoneBlocks) {
        if (b.exerciseId && !capstoneBlockMap.has(b.exerciseId)) capstoneBlockMap.set(b.exerciseId, b);
      }

      const capstoneLessonIds = [
        ...new Set(capstoneBlocks.map((b) => b.lessonId).filter(Boolean)),
      ];
      const capstoneLessons = await this.prisma.lesson.findMany({
        where: { id: { in: capstoneLessonIds } },
      });
      const capstoneLessonMap = new Map<string, (typeof capstoneLessons)[number]>();
      for (const l of capstoneLessons) {
        const existing = capstoneLessonMap.get(l.id);
        if (!existing || l.version > existing.version) capstoneLessonMap.set(l.id, l);
      }

      for (const attempt of capstoneAttempts) {
        const exercise = capstoneExerciseMap.get(attempt.exerciseId);
        if (!exercise || exercise.type !== 'capstone_submission') continue;
        const block = capstoneBlockMap.get(attempt.exerciseId);
        let lessonTitle = 'Unknown';
        if (block) {
          const lesson = capstoneLessonMap.get(block.lessonId);
          if (lesson) lessonTitle = lesson.title;
        }
        const student = studentMap.get(attempt.studentId);
        if (!student) continue;
        items.push({
          attemptId: attempt.id, studentName: student.name, studentEmail: student.email,
          exerciseId: attempt.exerciseId, exercisePrompt: exercise.promptMarkdown, lessonTitle,
          submittedAt: attempt.submittedAt, reviewedAt: null, queueType: 'capstone_approval',
        });
      }
    }

    // Sort: pending by oldest first, reviewed by newest first
    items.sort((a, b) => {
      if (reviewed) return b.submittedAt.getTime() - a.submittedAt.getTime();
      return a.submittedAt.getTime() - b.submittedAt.getTime();
    });

    return items;
  }

  async getAttemptDetail(attemptId: string): Promise<{
    attemptId: string;
    code: string;
    exercisePrompt: string;
    language: string;
    passed: boolean;
    aiReviewMarkdown: string | null;
    submissionPayload: any;
    approvedByInstructorId: string | null;
  } | null> {
    const attempt = await this.prisma.attempt.findUnique({
      where: { id: attemptId },
    });
    if (!attempt) return null;

    const exercise = await this.prisma.exercise.findFirst({
      where: { id: attempt.exerciseId },
      orderBy: { version: 'desc' },
    });
    if (!exercise) return null;

    const payload = attempt.submissionPayload as { code?: string };
    const exercisePayload = exercise.payload as { language?: string };

    const aiReview = await this.prisma.codeReview.findUnique({
      where: { attemptId },
    });

    return {
      attemptId,
      code: payload.code ?? '',
      exercisePrompt: exercise.promptMarkdown,
      language: exercisePayload.language ?? 'plaintext',
      passed: attempt.passed,
      aiReviewMarkdown: aiReview?.markdown ?? null,
      submissionPayload: attempt.submissionPayload,
      approvedByInstructorId: attempt.approvedByInstructorId,
    };
  }

  async approveAttempt(
    attemptId: string,
    instructorId: string,
  ): Promise<{ attempt: any; exerciseResult: any }> {
    const attempt = await this.prisma.attempt.findUnique({ where: { id: attemptId } });
    if (!attempt) throw new Error('Attempt not found');

    const exercise = await this.prisma.exercise.findFirst({
      where: { id: attempt.exerciseId },
      orderBy: { version: 'desc' },
    });
    if (!exercise || exercise.type !== 'capstone_submission') {
      throw new Error('Not a capstone submission');
    }

    const pointsAwarded = exercise.pointsMax;

    return this.prisma.$transaction(async (tx) => {
      // Atomic conditional update: only succeeds if not yet approved
      const { count } = await tx.attempt.updateMany({
        where: { id: attemptId, approvedByInstructorId: null },
        data: { passed: true, pointsAwarded, approvedByInstructorId: instructorId },
      });
      if (count === 0) {
        throw new Error('Already approved');
      }

      const updatedAttempt = await tx.attempt.findUnique({ where: { id: attemptId } });

      const existingResult = await tx.exerciseResult.findFirst({
        where: { studentId: attempt.studentId, exerciseId: attempt.exerciseId },
      });

      let exerciseResult;
      if (existingResult) {
        exerciseResult = await tx.exerciseResult.update({
          where: { id: existingResult.id },
          data: {
            passed: true,
            bestAttemptId: attemptId,
            pointsEarned: Math.max(existingResult.pointsEarned, pointsAwarded),
            firstPassedAt: existingResult.firstPassedAt ?? new Date(),
          },
        });
      } else {
        const { newId } = await import('../shared/ids');
        exerciseResult = await tx.exerciseResult.create({
          data: {
            id: newId(),
            studentId: attempt.studentId,
            exerciseId: attempt.exerciseId,
            bestAttemptId: attemptId,
            passed: true,
            pointsEarned: pointsAwarded,
            attemptsCount: 1,
            firstPassedAt: new Date(),
          },
        });
      }

      return { attempt: updatedAttempt, exerciseResult };
    });
  }

  async findReviewById(id: string): Promise<InstructorReviewWithMessages | null> {
    return this.repo.findById(id);
  }

  async getAttemptById(attemptId: string) {
    return this.prisma.attempt.findUnique({ where: { id: attemptId } });
  }

  async isStudentInInstructorCohort(
    studentId: string,
    instructorId: string,
  ): Promise<boolean> {
    const cohorts = await this.prisma.cohort.findMany({
      where: { instructorId },
      select: { id: true },
    });
    const cohortIds = cohorts.map((c) => c.id);
    if (cohortIds.length === 0) return false;
    const student = await this.prisma.student.findUnique({
      where: { id: studentId },
      select: { cohortId: true },
    });
    return student?.cohortId != null && cohortIds.includes(student.cohortId);
  }

  async createReview(
    attemptId: string,
    instructorId: string,
    markdown: string,
  ): Promise<InstructorReview> {
    return this.repo.create({ attemptId, instructorId, markdown });
  }

  async updateReview(id: string, markdown: string): Promise<InstructorReview> {
    return this.repo.update(id, markdown);
  }

  async getReview(attemptId: string): Promise<InstructorReviewWithMessages | null> {
    return this.repo.findByAttemptId(attemptId);
  }

  async addMessage(
    instructorReviewId: string,
    authorId: string,
    body: string,
  ): Promise<ReviewMessage> {
    return this.repo.addMessage(instructorReviewId, authorId, body);
  }
}
