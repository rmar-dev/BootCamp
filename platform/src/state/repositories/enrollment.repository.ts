import { Injectable } from '@nestjs/common';
import { Enrollment, EnrollmentStatus, LessonLevel } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

export type CreateEnrollmentInput = {
  id: string;
  studentId: string;
  trackId: string;
  trackVersion: number;
  assignedLevel: LessonLevel;
  currentLessonId?: string | null;
  currentLessonVersion?: number | null;
};

@Injectable()
export class EnrollmentRepository {
  constructor(private readonly prisma: PrismaService) {}

  async create(input: CreateEnrollmentInput): Promise<Enrollment> {
    return this.prisma.enrollment.create({
      data: {
        id: input.id,
        studentId: input.studentId,
        trackId: input.trackId,
        trackVersion: input.trackVersion,
        assignedLevel: input.assignedLevel,
        currentLessonId: input.currentLessonId ?? null,
        currentLessonVersion: input.currentLessonVersion ?? null,
        status: 'active',
      },
    });
  }

  async findById(id: string): Promise<Enrollment | null> {
    return this.prisma.enrollment.findUnique({ where: { id } });
  }

  async findByStudentAndTrack(
    studentId: string,
    trackId: string,
  ): Promise<Enrollment | null> {
    return this.prisma.enrollment.findUnique({
      where: { studentId_trackId: { studentId, trackId } },
    });
  }

  async listByStudent(studentId: string): Promise<Enrollment[]> {
    return this.prisma.enrollment.findMany({ where: { studentId } });
  }

  async setCurrentLesson(
    enrollmentId: string,
    lessonId: string,
    lessonVersion: number,
  ): Promise<Enrollment> {
    return this.prisma.enrollment.update({
      where: { id: enrollmentId },
      data: { currentLessonId: lessonId, currentLessonVersion: lessonVersion },
    });
  }

  async setStatus(
    enrollmentId: string,
    status: EnrollmentStatus,
  ): Promise<Enrollment> {
    return this.prisma.enrollment.update({
      where: { id: enrollmentId },
      data: { status },
    });
  }
}
