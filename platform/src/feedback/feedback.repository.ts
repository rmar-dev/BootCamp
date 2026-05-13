import { Injectable } from '@nestjs/common';
import { FeedbackStatus, Prisma, StudentFeedback } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

export type CreateFeedbackInput = {
  studentId: string;
  lessonId: string | null;
  rating: number | null;
  comment: string;
};

@Injectable()
export class FeedbackRepository {
  constructor(private readonly prisma: PrismaService) {}

  async create(input: CreateFeedbackInput): Promise<StudentFeedback> {
    return this.prisma.studentFeedback.create({
      data: {
        studentId: input.studentId,
        lessonId: input.lessonId,
        rating: input.rating,
        comment: input.comment,
      },
    });
  }

  async findByStudent(studentId: string): Promise<StudentFeedback[]> {
    return this.prisma.studentFeedback.findMany({
      where: { studentId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findById(id: string): Promise<StudentFeedback | null> {
    return this.prisma.studentFeedback.findUnique({ where: { id } });
  }

  /**
   * Inbox for an instructor — feedback from every student currently assigned
   * to them. StudentFeedback has no Prisma relation to Student (kept FK-free
   * so deletion of either side doesn't cascade), so we resolve the student
   * ids first and then query feedback by `studentId IN (...)`. Capped at
   * 200 rows; the inbox UI never asks for more than that.
   */
  async findForInstructor(instructorUserId: string): Promise<StudentFeedback[]> {
    const students = await this.prisma.student.findMany({
      where: { instructorId: instructorUserId },
      select: { id: true },
    });
    if (students.length === 0) return [];
    return this.prisma.studentFeedback.findMany({
      where: { studentId: { in: students.map((s) => s.id) } },
      orderBy: { createdAt: 'desc' },
      take: 200,
    });
  }

  /** Admin path — every feedback row, capped. */
  async findAll(): Promise<StudentFeedback[]> {
    return this.prisma.studentFeedback.findMany({
      orderBy: { createdAt: 'desc' },
      take: 500,
    });
  }

  async update(
    id: string,
    patch: Prisma.StudentFeedbackUncheckedUpdateInput,
  ): Promise<StudentFeedback> {
    return this.prisma.studentFeedback.update({
      where: { id },
      data: patch,
    });
  }

  async markStatus(
    id: string,
    status: FeedbackStatus,
    extra?: { instructorReply?: string; instructorReplyBy?: string },
  ): Promise<StudentFeedback> {
    const now = new Date();
    return this.update(id, {
      status,
      seenAt: status !== 'new' ? now : undefined,
      instructorReply: extra?.instructorReply ?? undefined,
      instructorReplyAt: extra?.instructorReply ? now : undefined,
      instructorReplyBy: extra?.instructorReplyBy ?? undefined,
    });
  }
}
