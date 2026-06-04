import * as request from 'supertest';
import * as bcrypt from 'bcryptjs';
import { INestApplication } from '@nestjs/common';
import { PrismaService } from '../../src/prisma/prisma.service';
import { newId } from '../../src/shared/ids';

export type SeededAuth = { cookie: string; userId: string; email: string };

/**
 * Seed an ACTIVE user directly and log in to obtain the bc.access cookie.
 * Replaces the old `POST /api/auth/register` flow now that registration is
 * invite-only. Defaults to a student; pass role for instructor/admin.
 */
export async function createUserAndLogin(
  app: INestApplication,
  prisma: PrismaService,
  opts: { role?: 'student' | 'instructor' | 'admin'; email?: string; name?: string } = {},
): Promise<SeededAuth> {
  const email = opts.email ?? `user-${newId()}@test.com`;
  const userId = newId();
  await prisma.user.create({
    data: {
      id: userId,
      email,
      name: opts.name ?? 'Tester',
      passwordHash: await bcrypt.hash('password123', 10),
      role: opts.role ?? 'student',
      status: 'active',
    },
  });
  const res = await request(app.getHttpServer())
    .post('/api/auth/login')
    .send({ email, password: 'password123' });
  const raw = res.headers['set-cookie'] as unknown as string | string[];
  const arr = Array.isArray(raw) ? raw : [raw];
  const cookie = arr.find((c: string) => c.startsWith('bc.access='))!;
  return { cookie, userId, email };
}
