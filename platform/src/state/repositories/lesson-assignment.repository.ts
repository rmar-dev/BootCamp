import { Injectable } from '@nestjs/common';
import { LessonAssignment } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

export type CreateAssignmentInput = {
  studentId: string;
  lessonId: string;
  lessonVersion: number;
  selectedExerciseIds: string[];
};

@Injectable()
export class LessonAssignmentRepository {
  constructor(private readonly prisma: PrismaService) {}

  async create(input: CreateAssignmentInput): Promise<LessonAssignment> {
    return this.prisma.lessonAssignment.create({ data: input });
  }

  async findActive(studentId: string, lessonId: string): Promise<LessonAssignment | null> {
    return this.prisma.lessonAssignment.findFirst({
      where: { studentId, lessonId, completedAt: null },
      orderBy: { selectedAt: 'desc' },
    });
  }

  async markCompleted(id: string): Promise<LessonAssignment> {
    return this.prisma.lessonAssignment.update({
      where: { id },
      data: { completedAt: new Date() },
    });
  }
}
