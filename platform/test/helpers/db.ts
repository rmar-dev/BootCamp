import { PrismaClient } from '@prisma/client';

export function makeTestPrisma(): PrismaClient {
  return new PrismaClient();
}

export async function resetDb(prisma: PrismaClient): Promise<void> {
  // Order matters: state half references content half via foreign-id strings (no FKs),
  // but Block has an actual FK to Lesson and must be cleared first.
  // Student may reference User via userId FK, so clear Student before User.
  await prisma.reviewAttempt.deleteMany();
  await prisma.reviewCard.deleteMany();
  await prisma.reviewMessage.deleteMany();
  await prisma.instructorReview.deleteMany();
  await prisma.studentBadge.deleteMany();
  await prisma.codeReview.deleteMany();
  await prisma.attempt.deleteMany();
  await prisma.exerciseResult.deleteMany();
  await prisma.enrollment.deleteMany();
  await prisma.student.deleteMany();
  await prisma.user.deleteMany();
  await prisma.cohort.deleteMany();
  await prisma.block.deleteMany();
  await prisma.exercise.deleteMany();
  await prisma.lesson.deleteMany();
  await prisma.track.deleteMany();
}
