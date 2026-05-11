import { Injectable } from '@nestjs/common';
import { Cohort } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

export type CreateCohortInput = {
  id: string;
  name: string;
  instructorId: string;
  startDate: Date;
};

@Injectable()
export class CohortRepository {
  constructor(private readonly prisma: PrismaService) {}

  async create(input: CreateCohortInput): Promise<Cohort> {
    return this.prisma.cohort.create({ data: input });
  }

  async findById(id: string): Promise<Cohort | null> {
    return this.prisma.cohort.findUnique({ where: { id } });
  }

  async findByStudentId(studentId: string): Promise<Cohort | null> {
    const student = await this.prisma.student.findUnique({
      where: { id: studentId },
      select: { cohortId: true },
    });
    if (!student?.cohortId) return null;
    return this.prisma.cohort.findUnique({
      where: { id: student.cohortId },
    });
  }

  /**
   * All cohorts led by a given instructor (Cohort.instructorId === userId).
   * Used by the instructor skill-tree composer to populate the cohort
   * picker with real cohorts the caller can author for. Ordered by
   * startDate desc so the most recent cohort surfaces first.
   */
  async findByInstructor(instructorUserId: string): Promise<Cohort[]> {
    return this.prisma.cohort.findMany({
      where: { instructorId: instructorUserId },
      orderBy: { startDate: 'desc' },
    });
  }

  /**
   * Every cohort on the platform. Used by admins and by instructors when
   * authoring an override for a cohort they don't lead.
   */
  async findAll(): Promise<Cohort[]> {
    return this.prisma.cohort.findMany({ orderBy: { startDate: 'desc' } });
  }
}
