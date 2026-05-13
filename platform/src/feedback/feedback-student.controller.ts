import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Post,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { FeedbackService } from './feedback.service';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Student-facing feedback surface. Two flavours via the same endpoint:
//   - per-lesson feedback (lessonId set, rating required)
//   - general platform feedback (lessonId null, comment only)
@Controller('api/feedback')
@UseGuards(JwtAuthGuard)
export class FeedbackStudentController {
  constructor(private readonly service: FeedbackService) {}

  @Post()
  async create(
    @CurrentUser() user: { userId: string },
    @Body() body: {
      lessonId?: string | null;
      rating?: number | null;
      comment: string;
    },
  ) {
    if (body.lessonId && !UUID_RE.test(body.lessonId)) {
      throw new BadRequestException(`lessonId must be a UUID — got '${body.lessonId}'`);
    }
    return this.service.createForStudent({
      studentUserId: user.userId,
      lessonId: body.lessonId ?? null,
      rating: body.rating ?? null,
      comment: body.comment,
    });
  }

  @Get('mine')
  async listMine(@CurrentUser() user: { userId: string }) {
    return this.service.listMine(user.userId);
  }
}
