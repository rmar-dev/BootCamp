import { UserRepository } from '../../src/auth/user.repository';
import { makeTestPrisma, resetDb } from '../helpers/db';
import { newId } from '../../src/shared/ids';
import { PrismaClient } from '@prisma/client';

describe('UserRepository', () => {
  let prisma: PrismaClient;
  let repo: UserRepository;

  beforeAll(() => {
    prisma = makeTestPrisma();
    repo = new UserRepository(prisma as any);
  });

  afterAll(() => prisma.$disconnect());

  beforeEach(() => resetDb(prisma));

  it('creates a user with password hash', async () => {
    const id = newId();
    const user = await repo.create({
      id,
      email: 'alice@test.com',
      name: 'Alice',
      passwordHash: 'hashed',
      role: 'student',
    });
    expect(user.id).toBe(id);
    expect(user.email).toBe('alice@test.com');
    expect(user.role).toBe('student');
    expect(user.passwordHash).toBe('hashed');
  });

  it('findByEmail returns null for unknown email', async () => {
    const result = await repo.findByEmail('nobody@test.com');
    expect(result).toBeNull();
  });

  it('findByEmail returns the user after creation', async () => {
    await repo.create({ id: newId(), email: 'bob@test.com', name: 'Bob', role: 'student' });
    const user = await repo.findByEmail('bob@test.com');
    expect(user).not.toBeNull();
    expect(user!.name).toBe('Bob');
  });

  it('findById returns the correct user', async () => {
    const id = newId();
    await repo.create({ id, email: 'carol@test.com', name: 'Carol', role: 'instructor' });
    const user = await repo.findById(id);
    expect(user).not.toBeNull();
    expect(user!.role).toBe('instructor');
  });

  it('findByGoogleId returns user with googleId', async () => {
    const id = newId();
    await repo.create({ id, email: 'dave@test.com', name: 'Dave', role: 'student', googleId: 'goog-123' });
    const user = await repo.findByGoogleId('goog-123');
    expect(user).not.toBeNull();
    expect(user!.email).toBe('dave@test.com');
  });
});
