import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { FeedbackStatus, StudentFeedback } from '@prisma/client';
import { EnsureStudentService } from '../submission/ensure-student';
import { StudentRepository } from '../state/repositories/student.repository';
import { FeedbackRepository } from './feedback.repository';

const MAX_COMMENT = 4000;

@Injectable()
export class FeedbackService {
  constructor(
    private readonly feedback: FeedbackRepository,
    private readonly ensureStudent: EnsureStudentService,
    private readonly students: StudentRepository,
  ) {}

  async createForStudent(input: {
    studentUserId: string;
    lessonId: string | null;
    rating: number | null;
    comment: string;
  }): Promise<StudentFeedback> {
    const comment = input.comment?.trim() ?? '';
    if (comment.length === 0) {
      throw new BadRequestException('comment cannot be empty');
    }
    if (comment.length > MAX_COMMENT) {
      throw new BadRequestException(`comment cannot exceed ${MAX_COMMENT} characters`);
    }
    if (input.rating != null && (input.rating < 1 || input.rating > 5)) {
      throw new BadRequestException('rating must be between 1 and 5');
    }
    // Per-lesson feedback requires a rating; general feedback doesn't.
    if (input.lessonId && input.rating == null) {
      throw new BadRequestException('per-lesson feedback requires a rating (1–5)');
    }
    const { id: studentId } = await this.ensureStudent.ensureStudent(input.studentUserId);
    return this.feedback.create({
      studentId,
      lessonId: input.lessonId,
      rating: input.rating,
      comment,
    });
  }

  async listMine(studentUserId: string): Promise<StudentFeedback[]> {
    const { id: studentId } = await this.ensureStudent.ensureStudent(studentUserId);
    return this.feedback.findByStudent(studentId);
  }

  async listInbox(caller: {
    userId: string;
    role: string;
  }): Promise<StudentFeedback[]> {
    if (caller.role === 'admin') return this.feedback.findAll();
    return this.feedback.findForInstructor(caller.userId);
  }

  /**
   * Mark a feedback row's status. Optional `instructorReply` short-circuits
   * the new → seen → resolved progression: when supplied, the row jumps to
   * 'resolved' and the reply is stored alongside. Authorization: caller
   * must be the assigned instructor of the student who wrote the feedback
   * (or admin).
   */
  async setStatus(
    id: string,
    caller: { userId: string; role: string },
    status: FeedbackStatus,
    instructorReply?: string,
  ): Promise<StudentFeedback> {
    const row = await this.feedback.findById(id);
    if (!row) throw new NotFoundException('Feedback not found');
    if (caller.role !== 'admin') {
      const student = await this.students.findById(row.studentId);
      if (!student || student.instructorId !== caller.userId) {
        throw new ForbiddenException('Not assigned to this student');
      }
    }
    if (instructorReply !== undefined) {
      const trimmed = instructorReply.trim();
      if (trimmed.length === 0) {
        throw new BadRequestException('instructorReply cannot be empty when supplied');
      }
      if (trimmed.length > MAX_COMMENT) {
        throw new BadRequestException(
          `instructorReply cannot exceed ${MAX_COMMENT} characters`,
        );
      }
      return this.feedback.markStatus(id, 'resolved', {
        instructorReply: trimmed,
        instructorReplyBy: caller.userId,
      });
    }
    return this.feedback.markStatus(id, status);
  }
}
