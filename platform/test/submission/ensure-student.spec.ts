import { PrismaClient } from '@prisma/client';
import { EnsureStudentService } from '../../src/submission/ensure-student';
import { StudentRepository } from '../../src/state/repositories/student.repository';
import { UserRepository } from '../../src/auth/user.repository';
import { makeTestPrisma, resetDb } from '../helpers/db';
import { newId } from '../../src/shared/ids';

describe('EnsureStudentService', () => {
  let prisma: PrismaClient;
  let svc: EnsureStudentService;
  let studentRepo: StudentRepository;
  let userRepo: UserRepository;

  beforeAll(() => {
    prisma = makeTestPrisma();
    studentRepo = new StudentRepository(prisma as any);
    userRepo = new UserRepository(prisma as any);
    svc = new EnsureStudentService(studentRepo, userRepo);
  });

  beforeEach(async () => {
    await resetDb(prisma);
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it('creates a student on first call for a known user', async () => {
    const userId = newId();
    await userRepo.create({
      id: userId,
      email: 'bob@test.com',
      name: 'Bob',
      role: 'student',
    });

    const student = await svc.ensureStudent(userId);

    expect(student.userId).toBe(userId);
    expect(student.email).toBe('bob@test.com');
    expect(student.name).toBe('Bob');
  });

  it('returns existing student on second call without creating a duplicate', async () => {
    const userId = newId();
    await userRepo.create({
      id: userId,
      email: 'carol@test.com',
      name: 'Carol',
      role: 'student',
    });

    const first = await svc.ensureStudent(userId);
    const second = await svc.ensureStudent(userId);

    expect(second.id).toBe(first.id);

    const all = await prisma.student.findMany({ where: { userId } });
    expect(all).toHaveLength(1);
  });

  it('throws NotFoundException when user does not exist', async () => {
    const unknownUserId = newId();
    await expect(svc.ensureStudent(unknownUserId)).rejects.toThrow(
      `User ${unknownUserId} not found`,
    );
  });
});
