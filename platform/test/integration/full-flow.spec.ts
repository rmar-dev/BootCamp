import { Test } from '@nestjs/testing';
import { AppModule } from '../../src/app.module';
import { TrackRepository } from '../../src/content/repositories/track.repository';
import { LessonRepository } from '../../src/content/repositories/lesson.repository';
import { ExerciseRepository } from '../../src/content/repositories/exercise.repository';
import { PublishService } from '../../src/content/services/publish.service';
import { StudentRepository } from '../../src/state/repositories/student.repository';
import { EnrollmentRepository } from '../../src/state/repositories/enrollment.repository';
import { AttemptService } from '../../src/state/services/attempt.service';
import { ProgressService } from '../../src/state/services/progress.service';
import { PrismaService } from '../../src/prisma/prisma.service';
import { resetDb } from '../helpers/db';
import { newId } from '../../src/shared/ids';

describe('Full curriculum + state flow', () => {
  let app: import('@nestjs/common').INestApplication;
  let prisma: PrismaService;
  let tracks: TrackRepository;
  let lessons: LessonRepository;
  let exercises: ExerciseRepository;
  let publish: PublishService;
  let students: StudentRepository;
  let enrollments: EnrollmentRepository;
  let attempts: AttemptService;
  let progress: ProgressService;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleRef.createNestApplication();
    await app.init();
    prisma = moduleRef.get(PrismaService);
    tracks = moduleRef.get(TrackRepository);
    lessons = moduleRef.get(LessonRepository);
    exercises = moduleRef.get(ExerciseRepository);
    publish = moduleRef.get(PublishService);
    students = moduleRef.get(StudentRepository);
    enrollments = moduleRef.get(EnrollmentRepository);
    attempts = moduleRef.get(AttemptService);
    progress = moduleRef.get(ProgressService);
  });

  beforeEach(async () => {
    await resetDb(prisma);
  });

  afterAll(async () => {
    await app.close();
  });

  it('runs an end-to-end student journey through one lesson with two exercises', async () => {
    // 1. Author content
    const exAId = newId();
    await exercises.createDraft({
      id: exAId,
      lessonId: newId(),
      promptMarkdown: 'Pick the right answer',
      type: 'multiple_choice',
      payload: {
        type: 'multiple_choice',
        questionMarkdown: 'What is 2+2?',
        options: [
          { id: 'a', text: '3' },
          { id: 'b', text: '4' },
        ],
        correctOptionIds: ['b'],
        multiSelect: false,
      },
      pointsMax: 100,
      hints: ['Think about it.'],
      concepts: ['arithmetic'],
    });

    const exBId = newId();
    await exercises.createDraft({
      id: exBId,
      lessonId: newId(),
      promptMarkdown: 'Write code',
      type: 'code',
      payload: {
        type: 'code',
        language: 'swift',
        starterCode: 'func answer() -> Int { return 0 }',
        testCode: 'assert(answer() == 1)',
        testEntryPoint: 'runTests',
      },
      pointsMax: 100,
      hints: [],
      concepts: ['functions'],
    });

    const lessonId = newId();
    await lessons.createDraft({
      id: lessonId,
      trackId: newId(),
      position: 0,
      title: 'Lesson 1',
      level: 'beginner',
      summary: 'First lesson',
      blocks: [
        {
          id: newId(),
          position: 0,
          kind: 'explanation',
          explanationMarkdown: 'Welcome',
        },
        {
          id: newId(),
          position: 1,
          kind: 'exercise',
          exerciseId: exAId,
          exerciseVersion: 1,
        },
        {
          id: newId(),
          position: 2,
          kind: 'exercise',
          exerciseId: exBId,
          exerciseVersion: 1,
        },
      ],
    });

    const trackId = newId();
    await tracks.createDraft({
      id: trackId,
      title: 'Swift Fundamentals',
      language: 'swift',
      kind: 'fundamentals',
      description: 'd',
      lessons: [{ id: lessonId, version: 1 }],
    });

    // 2. Publish everything
    await publish.publishTrack(trackId, 1);

    // 3. Enroll a student
    const studentId = newId();
    await students.create({ id: studentId, name: 'Pat', email: 'pat@x.com' });
    await enrollments.create({
      id: newId(),
      studentId,
      trackId,
      trackVersion: 1,
      assignedLevel: 'beginner',
      currentLessonId: lessonId,
      currentLessonVersion: 1,
    });

    // 4. Attempt the multiple choice — pass first try
    const r1 = await attempts.recordAttempt({
      studentId,
      exerciseId: exAId,
      exerciseVersion: 1,
      submissionPayload: {
        type: 'multiple_choice',
        selectedOptionIds: ['b'],
      },
      passed: true,
      hintsUsedCount: 0,
    });
    expect(r1.attempt.pointsAwarded).toBe(100);

    // 5. Attempt the code exercise — fail twice, then pass with one hint
    await attempts.recordAttempt({
      studentId,
      exerciseId: exBId,
      exerciseVersion: 1,
      submissionPayload: { type: 'code', code: 'still 0' },
      passed: false,
      hintsUsedCount: 0,
    });
    await attempts.recordAttempt({
      studentId,
      exerciseId: exBId,
      exerciseVersion: 1,
      submissionPayload: { type: 'code', code: 'still 0' },
      passed: false,
      hintsUsedCount: 0,
    });
    const r4 = await attempts.recordAttempt({
      studentId,
      exerciseId: exBId,
      exerciseVersion: 1,
      submissionPayload: { type: 'code', code: 'return 1' },
      passed: true,
      hintsUsedCount: 0,
    });
    // 2 failed attempts before * 5% = 10% penalty → 90
    expect(r4.attempt.pointsAwarded).toBe(90);
    expect(r4.exerciseResult.attemptsCount).toBe(3);

    // 6. Verify lesson is completed
    const lessonDone = await progress.isLessonCompleted(studentId, lessonId, 1);
    expect(lessonDone).toBe(true);

    // 7. Verify track is completed (only one lesson)
    const trackDone = await progress.isTrackCompleted(studentId, trackId, 1);
    expect(trackDone).toBe(true);
  });
});
