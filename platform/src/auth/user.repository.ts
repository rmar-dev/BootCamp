import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { User, UserRole, UserStatus } from '@prisma/client';

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

  create(input: CreateUserInput): Promise<User> {
    return this.prisma.user.create({
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

  /** Set the password hash and flip an invited user to active. */
  activate(id: string, passwordHash: string): Promise<User> {
    return this.prisma.user.update({
      where: { id },
      data: { passwordHash, status: 'active' },
    });
  }

  setStatus(id: string, status: UserStatus): Promise<User> {
    return this.prisma.user.update({ where: { id }, data: { status } });
  }
}
