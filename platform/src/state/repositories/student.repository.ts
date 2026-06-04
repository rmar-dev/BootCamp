import { Injectable } from '@nestjs/common';
import { Language, Prisma, Student } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

export type CreateStudentInput = {
  id: string;
  name: string;
  email: string;
  cohortId?: string | null;
  userId?: string | null;
  instructorId?: string | null;
};

@Injectable()
export class StudentRepository {
  constructor(private readonly prisma: PrismaService) {}

  async create(input: CreateStudentInput, tx?: Prisma.TransactionClient): Promise<Student> {
    return (tx ?? this.prisma).student.create({
      data: {
        id: input.id,
        name: input.name,
        email: input.email,
        cohortId: input.cohortId ?? null,
        userId: input.userId ?? null,
        instructorId: input.instructorId ?? null,
      },
    });
  }

  async findById(id: string): Promise<Student | null> {
    return this.prisma.student.findUnique({ where: { id } });
  }

  async findByEmail(email: string): Promise<Student | null> {
    return this.prisma.student.findUnique({ where: { email } });
  }

  async findByUserId(userId: string): Promise<Student | null> {
    return this.prisma.student.findFirst({ where: { userId } });
  }

  async findAll(): Promise<Student[]> {
    return this.prisma.student.findMany();
  }

  async findByCohort(cohortId: string): Promise<Student[]> {
    return this.prisma.student.findMany({ where: { cohortId } });
  }

  async findByInstructor(instructorUserId: string): Promise<Student[]> {
    return this.prisma.student.findMany({
      where: { instructorId: instructorUserId },
      orderBy: { createdAt: 'asc' },
    });
  }

  async findUnassigned(): Promise<Student[]> {
    return this.prisma.student.findMany({
      where: { instructorId: null },
      orderBy: { createdAt: 'asc' },
    });
  }

  async assignInstructor(studentId: string, instructorUserId: string | null): Promise<Student> {
    return this.prisma.student.update({
      where: { id: studentId },
      data: { instructorId: instructorUserId },
    });
  }

  async setLanguage(studentId: string, language: Language | null): Promise<Student> {
    return this.prisma.student.update({
      where: { id: studentId },
      data: { language },
    });
  }
}
