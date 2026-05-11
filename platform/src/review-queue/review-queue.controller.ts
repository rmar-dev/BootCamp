import {
  Controller,
  Get,
  Post,
  Param,
  Body,
  UseGuards,
  HttpCode,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { StudentRepository } from '../state/repositories/student.repository';
import {
  ReviewQueueService,
  ReviewQueueItem,
  ReviewSubmitResult,
} from './review-queue.service';

@Controller('api/review')
export class ReviewQueueController {
  constructor(
    private readonly service: ReviewQueueService,
    private readonly students: StudentRepository,
  ) {}

  @Get('queue')
  @UseGuards(JwtAuthGuard)
  async getQueue(
    @CurrentUser() user: { userId: string },
  ): Promise<{ due: ReviewQueueItem[] }> {
    const student = await this.students.findByUserId(user.userId);
    if (!student) return { due: [] };
    const due = await this.service.getDueCards(student.id);
    return { due };
  }

  @Post(':cardId/submit')
  @HttpCode(200)
  @UseGuards(JwtAuthGuard)
  async submit(
    @Param('cardId') cardId: string,
    @Body() body: unknown,
    @CurrentUser() user: { userId: string },
  ): Promise<ReviewSubmitResult> {
    const student = await this.students.findByUserId(user.userId);
    // No Student row yet → falls through to the service's ownership check
    // which will return a proper 404 on the card lookup. Avoids the misleading
    // "Review card not found" message for a "no student profile" condition.
    return this.service.submitReview(student?.id ?? '', cardId, body);
  }
}
