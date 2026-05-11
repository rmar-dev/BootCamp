import {
  Controller,
  Get,
  Post,
  Put,
  Param,
  Body,
  UseGuards,
  NotFoundException,
  ForbiddenException,
  ConflictException,
} from '@nestjs/common';
import { PrismaClientKnownRequestError } from '@prisma/client/runtime/library';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { InstructorReviewService } from './instructor-review.service';
import { StudentRepository } from '../state/repositories/student.repository';

@Controller('api/instructor')
export class InstructorReviewController {
  constructor(
    private readonly service: InstructorReviewService,
    private readonly studentRepository: StudentRepository,
  ) {}

  @Get('queue')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('instructor')
  async getQueue(@CurrentUser() user: { userId: string }) {
    return this.service.getPendingQueue(user.userId);
  }

  @Get('queue/reviewed')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('instructor')
  async getReviewedQueue(@CurrentUser() user: { userId: string }) {
    return this.service.getReviewedQueue(user.userId);
  }

  @Get('attempt/:attemptId')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('instructor')
  async getAttemptDetail(
    @Param('attemptId') attemptId: string,
    @CurrentUser() user: { userId: string },
  ) {
    const detail = await this.service.getAttemptDetail(attemptId);
    if (!detail) throw new NotFoundException('Attempt not found');

    // Fix 6: Verify the attempt's student belongs to one of the instructor's cohorts
    const attempt = await this.service.getAttemptById(attemptId);
    if (!attempt) throw new NotFoundException('Attempt not found');
    const inCohort = await this.service.isStudentInInstructorCohort(
      attempt.studentId,
      user.userId,
    );
    if (!inCohort) throw new ForbiddenException('Student is not in your cohort');

    return detail;
  }

  @Put('approve/:attemptId')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('instructor')
  async approveAttempt(
    @Param('attemptId') attemptId: string,
    @CurrentUser() user: { userId: string },
  ) {
    try {
      return await this.service.approveAttempt(attemptId, user.userId);
    } catch (err) {
      if (err.message === 'Attempt not found') throw new NotFoundException(err.message);
      if (err.message === 'Not a capstone submission') throw new ForbiddenException(err.message);
      if (err.message === 'Already approved') throw new ConflictException(err.message);
      throw err;
    }
  }

  @Post('review')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('instructor')
  async createReview(
    @CurrentUser() user: { userId: string },
    @Body() body: { attemptId: string; markdown: string },
  ) {
    const existing = await this.service.getReview(body.attemptId);
    if (existing) {
      throw new ConflictException('A review already exists for this attempt');
    }
    try {
      return await this.service.createReview(body.attemptId, user.userId, body.markdown);
    } catch (err) {
      if (err instanceof PrismaClientKnownRequestError && err.code === 'P2002') {
        throw new ConflictException('A review already exists for this attempt');
      }
      throw err;
    }
  }

  @Put('review/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('instructor')
  async updateReview(
    @Param('id') id: string,
    @Body() body: { markdown: string },
    @CurrentUser() user: { userId: string },
  ) {
    // Fix 4: Verify the calling instructor owns this review
    const review = await this.service.findReviewById(id);
    if (!review) throw new NotFoundException('Review not found');
    if (review.instructorId !== user.userId) {
      throw new ForbiddenException('You do not own this review');
    }
    return this.service.updateReview(id, body.markdown);
  }

  @Get('review/:attemptId')
  @UseGuards(JwtAuthGuard)
  async getReview(
    @Param('attemptId') attemptId: string,
    @CurrentUser() user: { userId: string; role: string },
  ) {
    const review = await this.service.getReview(attemptId);
    if (!review) throw new NotFoundException('Instructor review not found');

    // Instructors can see any review; students can only see their own
    if (user.role !== 'instructor') {
      const student = await this.studentRepository.findByUserId(user.userId);
      const attempt = await this.service.getAttemptById(attemptId);
      if (!student || !attempt || attempt.studentId !== student.id) {
        throw new ForbiddenException('Access denied');
      }
    }

    return {
      id: review.id,
      attemptId: review.attemptId,
      instructorId: review.instructorId,
      markdown: review.markdown,
      createdAt: review.createdAt,
      updatedAt: review.updatedAt,
      messages: review.messages.map((m) => ({
        id: m.id,
        authorId: m.authorId,
        body: m.body,
        createdAt: m.createdAt,
      })),
    };
  }

  @Post('review/:id/messages')
  @UseGuards(JwtAuthGuard)
  async addMessage(
    @Param('id') id: string,
    @Body() body: { body: string },
    @CurrentUser() user: { userId: string; role: string },
  ) {
    // Fix 5: Verify caller is the review's instructor OR the student whose attempt it is
    const review = await this.service.findReviewById(id);
    if (!review) throw new NotFoundException('Review not found');

    const isInstructor = review.instructorId === user.userId;
    if (!isInstructor) {
      // Check if caller is the student whose attempt the review belongs to
      const student = await this.studentRepository.findByUserId(user.userId);
      if (!student) throw new ForbiddenException('Access denied');
      const attempt = await this.service.getAttemptById(review.attemptId);
      if (!attempt || attempt.studentId !== student.id) {
        throw new ForbiddenException('Access denied');
      }
    }

    return this.service.addMessage(id, user.userId, body.body);
  }
}
