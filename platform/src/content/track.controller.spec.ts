import { Test } from '@nestjs/testing';
import { TrackController } from './track.controller';
import { TrackRepository } from './repositories/track.repository';
import { LessonRepository } from './repositories/lesson.repository';
import { CohortRepository } from '../state/repositories/cohort.repository';
import { StudentRepository } from '../state/repositories/student.repository';
import { UserRepository } from '../auth/user.repository';
import { EnsureStudentService } from '../submission/ensure-student';
import { PrismaService } from '../prisma/prisma.service';
import { CohortTrackAssignmentRepository } from '../skill-tree/cohort-track-assignment.repository';

describe('TrackController — cohortGate filtering', () => {
  let controller: TrackController;
  let prisma: PrismaService;
  const userId = crypto.randomUUID();
  const studentId = crypto.randomUUID();
  const cohortId = crypto.randomUUID();
  const trackId = crypto.randomUUID();
  const coreLessonId = crypto.randomUUID();
  const depthLessonId = crypto.randomUUID();

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [TrackController],
      providers: [
        TrackRepository,
        LessonRepository,
        CohortRepository,
        StudentRepository,
        UserRepository,
        EnsureStudentService,
        PrismaService,
        CohortTrackAssignmentRepository,
      ],
    }).compile();
    controller = moduleRef.get(TrackController);
    prisma = moduleRef.get(PrismaService);
    // Relies on jest --runInBand; any parallel worker would race.
    await prisma.$executeRawUnsafe(
      'TRUNCATE TABLE "Block", "Lesson", "Track", "Student", "User", "Cohort" RESTART IDENTITY CASCADE',
    );
    await prisma.user.create({
      data: { id: userId, email: 'track-test@test.com', name: 's', role: 'student' },
    });
    await prisma.cohort.create({
      data: {
        id: cohortId, name: 'c', instructorId: crypto.randomUUID(),
        startDate: new Date(), cohortLength: 'four_week', exercisesPerLessonTarget: 4,
      },
    });
    await prisma.student.create({
      data: { id: studentId, userId, name: 's', email: 'track-test@test.com', cohortId },
    });
    await prisma.track.create({
      data: {
        id: trackId, version: 1, title: 't', language: 'swift',
        kind: 'fundamentals', description: 'd',
        lessonIds: [coreLessonId, depthLessonId], lessonVersions: [1, 1],
        publishedAt: new Date(), contentHash: 'x',
      },
    });
    await prisma.lesson.create({
      data: {
        id: coreLessonId, version: 1, trackId, position: 0,
        title: 'Core', level: 'beginner', summary: 's', blockIds: [],
        publishedAt: new Date(), contentHash: 'x', cohortGate: null,
      },
    });
    await prisma.lesson.create({
      data: {
        id: depthLessonId, version: 1, trackId, position: 1,
        title: 'Depth', level: 'advanced', summary: 's', blockIds: [],
        publishedAt: new Date(), contentHash: 'x', cohortGate: 'twelve_week',
      },
    });
  });

  // authReq carries User.id (JWT sub); the controller resolves it to Student.id.
  const authReq = { user: { userId } };

  it('hides twelve_week-gated lessons from four_week cohort students', async () => {
    const detail = await controller.detail(trackId, undefined, authReq);
    expect(detail.lessons.map((l) => l.id)).toEqual([coreLessonId]);
    expect(detail.lessonCount).toBe(1);
  });

  it('shows all lessons when ?mode=preview', async () => {
    const detail = await controller.detail(trackId, 'preview', authReq);
    expect(detail.lessons).toHaveLength(2);
  });

  it('twelve_week cohort sees all lessons regardless of gate', async () => {
    await prisma.cohort.update({
      where: { id: cohortId },
      data: { cohortLength: 'twelve_week', exercisesPerLessonTarget: 10 },
    });
    const detail = await controller.detail(trackId, undefined, authReq);
    expect(detail.lessons).toHaveLength(2);
  });
});
