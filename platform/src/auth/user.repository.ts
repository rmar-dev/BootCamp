import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Prisma, User, UserRole, UserStatus } from '@prisma/client';

export interface CreateUserInput {
  id: string;
  email: string;
  name: string;
  passwordHash?: string;
  role: UserRole;
  googleId?: string;
  status?: UserStatus;
}

@Injectable()
export class UserRepository {
  constructor(private readonly prisma: PrismaService) {}

  create(input: CreateUserInput, tx?: Prisma.TransactionClient): Promise<User> {
    return (tx ?? this.prisma).user.create({
      data: {
        id: input.id,
        email: input.email,
        name: input.name,
        passwordHash: input.passwordHash ?? null,
        role: input.role,
        googleId: input.googleId ?? null,
        status: input.status ?? 'active',
      },
    });
  }

  findByEmail(email: string): Promise<User | null> {
    return this.prisma.user.findUnique({ where: { email } });
  }

  findById(id: string): Promise<User | null> {
    return this.prisma.user.findUnique({ where: { id } });
  }

  findByGoogleId(googleId: string): Promise<User | null> {
    return this.prisma.user.findUnique({ where: { googleId } });
  }

  update(id: string, data: Partial<Omit<User, 'id' | 'createdAt'>>): Promise<User> {
    return this.prisma.user.update({ where: { id }, data });
  }

  /**
   * Set the password hash and flip an INVITED user to active. Returns the
   * updated user, or null if the user was not in 'invited' state (already
   * active, disabled, or missing) — callers must treat null as failure.
   */
  async activate(id: string, passwordHash: string, tx?: Prisma.TransactionClient): Promise<User | null> {
    const client = tx ?? this.prisma;
    const res = await client.user.updateMany({
      where: { id, status: 'invited' },
      data: { passwordHash, status: 'active' },
    });
    if (res.count === 0) return null;
    return client.user.findUnique({ where: { id } });
  }

  setStatus(id: string, status: UserStatus, tx?: Prisma.TransactionClient): Promise<User> {
    return (tx ?? this.prisma).user.update({ where: { id }, data: { status } });
  }

  findAll(): Promise<User[]> {
    return this.prisma.user.findMany({ orderBy: { createdAt: 'asc' } });
  }

  setRole(id: string, role: UserRole): Promise<User> {
    return this.prisma.user.update({ where: { id }, data: { role } });
  }
}
