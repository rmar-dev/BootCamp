import { PrismaClient, Attempt } from '@prisma/client';
import { ReviewQueueService } from '../../src/review-queue/review-queue.service';
import { StudentRepository } from '../../src/state/repositories/student.repository';
import { ExerciseRepository } from '../../src/content/repositories/exercise.repository';
import { makeTestPrisma, resetDb } from '../helpers/db';
import { newId } from '../../src/shared/ids';

describe('ReviewQueueService', () => {
  let prisma: PrismaClient;
  let svc: ReviewQueueService;
  let students: StudentRepository;
  let exercises: ExerciseRepository;

  beforeAll(() => {
    prisma = makeTestPrisma();
    students = new StudentRepository(prisma as any);
    exercises = new ExerciseRepository(prisma as any);
    svc = new ReviewQueueService(prisma as any, students);
  });

  beforeEach(async () => {
    await resetDb(prisma);
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  async function makeStudent(): Promise<string> {
    const s = await students.create({ id: newId(), name: 'S', email: `s-${newId()}@t.com` });
    return s.id;
  }

  async function makeQuizExercise(type: 'fill_blank' | 'predict_output' | 'multiple_choice' = 'multiple_choice'): Promise<string> {
    const id = newId();
    let payload: any;
    if (type === 'multiple_choice') {
      payload = { type, questionMarkdown: 'q',
        options: [{ id: 'a', text: 'A' }, { id: 'b', text: 'B' }],
        correctOptionIds: ['a'], multiSelect: false };
    } else if (type === 'fill_blank') {
      payload = { type, language: 'swift', template: 'Fill [[0]]', blanks: [{ id: '0', expected: ['x'] }] };
    } else {
      payload = { type, displayedCode: 'print(1)', displayedLanguage: 'swift', expectedOutput: '1' };
    }
    await exercises.createDraft({
      id, lessonId: newId(), promptMarkdown: 'p', type,
      payload, pointsMax: 10, hints: [], concepts: [],
    });
    await exercises.publish(id, 1);
    return id;
  }

  async function makeAttempt(
    studentId: string,
    exerciseId: string,
    passed: boolean,
    failedAttemptsBefore: number,
    hintsUsedCount: number = 0,
  ): Promise<Attempt> {
    const id = newId();
    return prisma.attempt.create({
      data: {
        id, studentId, exerciseId, exerciseVersion: 1,
        submittedAt: new Date(), submissionPayload: {},
        passed, hintsUsedCount, failedAttemptsBefore, pointsAwarded: passed ? 10 : 0,
      },
    });
  }

  it('creates a card when a struggled pass is recorded (failedAttemptsBefore > 0)', async () => {
    const studentId = await makeStudent();
    const exerciseId = await makeQuizExercise('multiple_choice');
    const attempt = await makeAttempt(studentId, exerciseId, true, 2);

    await svc.handleSubmission(studentId, attempt);

    const card = await prisma.reviewCard.findUnique({
      where: { studentId_exerciseId: { studentId, exerciseId } },
    });
    expect(card).not.toBeNull();
    expect(card!.step).toBe(1);
    expect(card!.retiredAt).toBeNull();
    const expectedDue = new Date();
    expectedDue.setUTCDate(expectedDue.getUTCDate() + 3);
    expect(Math.abs(card!.nextDueAt.getTime() - expectedDue.getTime())).toBeLessThan(10_000);
  });

  it('creates a card when hints were used even without failed attempts', async () => {
    const studentId = await makeStudent();
    const exerciseId = await makeQuizExercise('fill_blank');
    const attempt = await makeAttempt(studentId, exerciseId, true, 0, 1);

    await svc.handleSubmission(studentId, attempt);

    const card = await prisma.reviewCard.findUnique({
      where: { studentId_exerciseId: { studentId, exerciseId } },
    });
    expect(card).not.toBeNull();
  });

  it('skips card creation for a clean first-try pass', async () => {
    const studentId = await makeStudent();
    const exerciseId = await makeQuizExercise('predict_output');
    const attempt = await makeAttempt(studentId, exerciseId, true, 0, 0);

    await svc.handleSubmission(studentId, attempt);

    const card = await prisma.reviewCard.findUnique({
      where: { studentId_exerciseId: { studentId, exerciseId } },
    });
    expect(card).toBeNull();
  });

  it('skips card creation for a failed attempt', async () => {
    const studentId = await makeStudent();
    const exerciseId = await makeQuizExercise('multiple_choice');
    const attempt = await makeAttempt(studentId, exerciseId, false, 0);

    await svc.handleSubmission(studentId, attempt);

    const card = await prisma.reviewCard.findUnique({
      where: { studentId_exerciseId: { studentId, exerciseId } },
    });
    expect(card).toBeNull();
  });

  it('skips card creation for non-quiz exercise types', async () => {
    const studentId = await makeStudent();
    // Seed a code exercise — not a quiz type
    const exerciseId = newId();
    await exercises.createDraft({
      id: exerciseId, lessonId: newId(), promptMarkdown: 'p', type: 'code',
      payload: { type: 'code', language: 'swift', starterCode: '', testCode: '', testEntryPoint: 'x' },
      pointsMax: 10, hints: [], concepts: [],
    });
    await exercises.publish(exerciseId, 1);
    const attempt = await makeAttempt(studentId, exerciseId, true, 2);

    await svc.handleSubmission(studentId, attempt);

    const card = await prisma.reviewCard.findUnique({
      where: { studentId_exerciseId: { studentId, exerciseId } },
    });
    expect(card).toBeNull();
  });

  it('is idempotent — does not create a duplicate card on second call', async () => {
    const studentId = await makeStudent();
    const exerciseId = await makeQuizExercise('multiple_choice');
    const firstAttempt = await makeAttempt(studentId, exerciseId, true, 1);

    await svc.handleSubmission(studentId, firstAttempt);
    const firstCard = await prisma.reviewCard.findUnique({
      where: { studentId_exerciseId: { studentId, exerciseId } },
    });

    // Second struggled pass on the same exercise → no second card, existing card unchanged
    const secondAttempt = await makeAttempt(studentId, exerciseId, true, 2);
    await svc.handleSubmission(studentId, secondAttempt);

    const allCards = await prisma.reviewCard.findMany({
      where: { studentId, exerciseId },
    });
    expect(allCards).toHaveLength(1);
    expect(allCards[0].id).toBe(firstCard!.id);
  });

  describe('getDueCards', () => {
    async function seedCardDue(
      studentId: string,
      exerciseId: string,
      nextDueAt: Date,
      step = 1,
      retiredAt: Date | null = null,
    ): Promise<string> {
      const id = newId();
      await prisma.reviewCard.create({
        data: { id, studentId, exerciseId, step, nextDueAt, retiredAt },
      });
      return id;
    }

    it('returns cards whose nextDueAt is in the past, sorted by dueAt ASC', async () => {
      const studentId = await makeStudent();
      const exA = await makeQuizExercise('multiple_choice');
      const exB = await makeQuizExercise('fill_blank');
      const now = new Date();
      const minusTwoHours = new Date(now.getTime() - 2 * 3600 * 1000);
      const minusOneHour = new Date(now.getTime() - 1 * 3600 * 1000);
      await seedCardDue(studentId, exA, minusOneHour);
      await seedCardDue(studentId, exB, minusTwoHours);

      const due = await svc.getDueCards(studentId);

      expect(due).toHaveLength(2);
      expect(due[0].exerciseId).toBe(exB); // older due first
      expect(due[1].exerciseId).toBe(exA);
      expect(due[0].exercise.type).toBe('fill_blank');
      expect(due[0].exercise.payload).toBeTruthy();
    });

    it('excludes cards not yet due', async () => {
      const studentId = await makeStudent();
      const exA = await makeQuizExercise('multiple_choice');
      const plusOneHour = new Date(Date.now() + 3600 * 1000);
      await seedCardDue(studentId, exA, plusOneHour);

      const due = await svc.getDueCards(studentId);
      expect(due).toEqual([]);
    });

    it('excludes retired cards', async () => {
      const studentId = await makeStudent();
      const exA = await makeQuizExercise('multiple_choice');
      const minusOneHour = new Date(Date.now() - 3600 * 1000);
      await seedCardDue(studentId, exA, minusOneHour, 4, new Date());

      const due = await svc.getDueCards(studentId);
      expect(due).toEqual([]);
    });

    it("excludes other students' cards", async () => {
      const studentA = await makeStudent();
      const studentB = await makeStudent();
      const exA = await makeQuizExercise('multiple_choice');
      const minusOneHour = new Date(Date.now() - 3600 * 1000);
      await seedCardDue(studentB, exA, minusOneHour);

      const due = await svc.getDueCards(studentA);
      expect(due).toEqual([]);
    });

    it('excludes cards whose exercise has no currently-published version', async () => {
      const studentId = await makeStudent();
      const exA = await makeQuizExercise('multiple_choice');
      const minusOneHour = new Date(Date.now() - 3600 * 1000);
      await seedCardDue(studentId, exA, minusOneHour);
      // Unpublish by nulling publishedAt on all versions
      await prisma.exercise.updateMany({
        where: { id: exA },
        data: { publishedAt: null },
      });

      const due = await svc.getDueCards(studentId);
      expect(due).toEqual([]);
    });

    it('returns the latest published exercise version in the payload', async () => {
      const studentId = await makeStudent();
      const exA = await makeQuizExercise('multiple_choice');
      // Create v2 with different prompt text and publish
      await exercises.createNextVersion(exA, {
        lessonId: newId(), promptMarkdown: 'v2 prompt', type: 'multiple_choice',
        payload: { type: 'multiple_choice', questionMarkdown: 'v2',
          options: [{ id: 'a', text: 'A' }, { id: 'b', text: 'B' }],
          correctOptionIds: ['b'], multiSelect: false },
        pointsMax: 10, hints: [], concepts: [],
      });
      await exercises.publish(exA, 2);
      const minusOneHour = new Date(Date.now() - 3600 * 1000);
      await seedCardDue(studentId, exA, minusOneHour);

      const due = await svc.getDueCards(studentId);

      expect(due).toHaveLength(1);
      expect(due[0].exercise.version).toBe(2);
      expect(due[0].exercise.promptMarkdown).toBe('v2 prompt');
    });
  });

  describe('submitReview', () => {
    async function seedCard(
      studentId: string,
      exerciseId: string,
      step: number,
      nextDueAt: Date = new Date(Date.now() - 1000),
    ): Promise<string> {
      const id = newId();
      await prisma.reviewCard.create({
        data: { id, studentId, exerciseId, step, nextDueAt },
      });
      return id;
    }

    it('on pass at step 2, advances to step 3 with nextDueAt = now + 21d', async () => {
      const studentId = await makeStudent();
      const exerciseId = await makeQuizExercise('multiple_choice');
      const cardId = await seedCard(studentId, exerciseId, 2);

      const result = await svc.submitReview(studentId, cardId, { selectedOptionIds: ['a'] });

      expect(result.passed).toBe(true);
      expect(result.card.step).toBe(3);
      expect(result.card.retiredAt).toBeNull();
      const card = await prisma.reviewCard.findUnique({ where: { id: cardId } });
      const expectedDue = new Date();
      expectedDue.setUTCDate(expectedDue.getUTCDate() + 21);
      expect(Math.abs(card!.nextDueAt.getTime() - expectedDue.getTime())).toBeLessThan(10_000);
    });

    it('on fail at step 3, resets to step 1 and nextDueAt = now + 3d', async () => {
      const studentId = await makeStudent();
      const exerciseId = await makeQuizExercise('multiple_choice');
      const cardId = await seedCard(studentId, exerciseId, 3);

      const result = await svc.submitReview(studentId, cardId, { selectedOptionIds: ['b'] });

      expect(result.passed).toBe(false);
      expect(result.card.step).toBe(1);
      expect(result.card.retiredAt).toBeNull();
      const card = await prisma.reviewCard.findUnique({ where: { id: cardId } });
      const expectedDue = new Date();
      expectedDue.setUTCDate(expectedDue.getUTCDate() + 3);
      expect(Math.abs(card!.nextDueAt.getTime() - expectedDue.getTime())).toBeLessThan(10_000);
    });

    it('on pass at step 4, retires the card (retiredAt set)', async () => {
      const studentId = await makeStudent();
      const exerciseId = await makeQuizExercise('fill_blank');
      const cardId = await seedCard(studentId, exerciseId, 4);

      const result = await svc.submitReview(studentId, cardId, { '0': 'x' });

      expect(result.passed).toBe(true);
      expect(result.card.retiredAt).not.toBeNull();
      const card = await prisma.reviewCard.findUnique({ where: { id: cardId } });
      expect(card!.retiredAt).not.toBeNull();
    });

    it('writes a ReviewAttempt row on every submit (pass or fail)', async () => {
      const studentId = await makeStudent();
      const exerciseId = await makeQuizExercise('predict_output');
      const cardId = await seedCard(studentId, exerciseId, 1);

      await svc.submitReview(studentId, cardId, '1');
      await svc.submitReview(studentId, cardId, 'wrong');

      const attempts = await prisma.reviewAttempt.findMany({
        where: { reviewCardId: cardId },
        orderBy: { submittedAt: 'asc' },
      });
      expect(attempts).toHaveLength(2);
      expect(attempts[0].passed).toBe(true);
      expect(attempts[1].passed).toBe(false);
      expect(attempts[0].studentId).toBe(studentId);
      expect(attempts[0].exerciseId).toBe(exerciseId);
    });

    it('throws when card does not belong to the calling student', async () => {
      const studentA = await makeStudent();
      const studentB = await makeStudent();
      const exerciseId = await makeQuizExercise('multiple_choice');
      const cardId = await seedCard(studentB, exerciseId, 1);

      await expect(svc.submitReview(studentA, cardId, { selectedOptionIds: ['a'] }))
        .rejects.toThrow(/not found/i);
    });

    it('throws when card is already retired', async () => {
      const studentId = await makeStudent();
      const exerciseId = await makeQuizExercise('multiple_choice');
      const cardId = newId();
      await prisma.reviewCard.create({
        data: {
          id: cardId, studentId, exerciseId, step: 4,
          nextDueAt: new Date(), retiredAt: new Date(),
        },
      });

      await expect(svc.submitReview(studentId, cardId, { selectedOptionIds: ['a'] }))
        .rejects.toThrow(/retired/i);
    });

    it('grades a multiple_choice submission using serverCheck', async () => {
      const studentId = await makeStudent();
      const exerciseId = await makeQuizExercise('multiple_choice');
      const cardId = await seedCard(studentId, exerciseId, 1);

      const pass = await svc.submitReview(studentId, cardId, { selectedOptionIds: ['a'] });
      expect(pass.passed).toBe(true);

      // Reset state — seed another card to test fail path
      const ex2 = await makeQuizExercise('multiple_choice');
      const cardId2 = await seedCard(studentId, ex2, 1);
      const fail = await svc.submitReview(studentId, cardId2, { selectedOptionIds: ['b'] });
      expect(fail.passed).toBe(false);
    });
  });
});
