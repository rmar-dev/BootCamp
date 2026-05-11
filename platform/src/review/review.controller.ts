import {
  Controller,
  Get,
  Param,
  UseGuards,
  NotFoundException,
  ForbiddenException,
  Res,
  Query,
} from '@nestjs/common';
import { Response } from 'express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { ReviewRepository } from './review.repository';
import { ReviewService } from './review.service';
import { StudentRepository } from '../state/repositories/student.repository';
import { chunkMarkdown } from './chunk-markdown.util';

export type ReviewResponse = {
  markdown: string;
  createdAt: Date;
};

const SSE_CHUNK_SIZE = 40;
const SSE_CHUNK_DELAY_MS = 30;
const SSE_DEFAULT_TIMEOUT_MS = 30_000;
const SSE_MIN_TIMEOUT_MS = 100;
const SSE_MAX_TIMEOUT_MS = 60_000;

@Controller('api/reviews')
export class ReviewController {
  constructor(
    private readonly reviewRepository: ReviewRepository,
    private readonly studentRepository: StudentRepository,
    private readonly reviewService: ReviewService,
  ) {}

  @Get(':attemptId')
  @UseGuards(JwtAuthGuard)
  async getReview(
    @Param('attemptId') attemptId: string,
    @CurrentUser() user: { userId: string },
  ): Promise<ReviewResponse> {
    const review = await this.reviewRepository.findByAttemptId(attemptId);
    if (!review) {
      throw new NotFoundException(`Review for attempt ${attemptId} not found`);
    }

    const student = await this.studentRepository.findByUserId(user.userId);
    if (!student || student.id !== review.studentId) {
      throw new ForbiddenException('You do not have access to this review');
    }

    return {
      markdown: review.markdown,
      createdAt: review.createdAt,
    };
  }

  @Get(':attemptId/stream')
  @UseGuards(JwtAuthGuard)
  async streamReview(
    @Param('attemptId') attemptId: string,
    @CurrentUser() user: { userId: string },
    @Res() res: Response,
    @Query('timeoutMs') timeoutMsParam?: string,
  ): Promise<void> {
    const student = await this.studentRepository.findByUserId(user.userId);
    if (!student) {
      throw new ForbiddenException('You do not have access to this review');
    }

    // Eager ownership check if a review already exists.
    const existing = await this.reviewRepository.findByAttemptId(attemptId);
    if (existing && existing.studentId !== student.id) {
      throw new ForbiddenException('You do not have access to this review');
    }

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('X-Accel-Buffering', 'no');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders?.();

    const parsed = timeoutMsParam ? Number(timeoutMsParam) : NaN;
    const timeoutMs = Number.isFinite(parsed)
      ? Math.min(SSE_MAX_TIMEOUT_MS, Math.max(SSE_MIN_TIMEOUT_MS, parsed))
      : SSE_DEFAULT_TIMEOUT_MS;
    const review = await this.reviewService.waitForReview(attemptId, { timeoutMs });
    if (!review) {
      res.write(`event: error\ndata: timeout\n\n`);
      res.end();
      return;
    }

    // Re-check ownership now that the review row exists.
    const fresh = await this.reviewRepository.findByAttemptId(attemptId);
    if (fresh && fresh.studentId !== student.id) {
      res.write(`event: error\ndata: forbidden\n\n`);
      res.end();
      return;
    }

    for (const chunk of chunkMarkdown(review.markdown, SSE_CHUNK_SIZE)) {
      res.write(`event: chunk\ndata: ${JSON.stringify(chunk)}\n\n`);
      await new Promise((r) => setTimeout(r, SSE_CHUNK_DELAY_MS));
    }
    res.write(`event: done\ndata:\n\n`);
    res.end();
  }
}
