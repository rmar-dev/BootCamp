import {
  Body,
  Controller,
  Get,
  Param,
  Put,
  UseGuards,
} from '@nestjs/common';
import { FeedbackStatus } from '@prisma/client';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { FeedbackService } from './feedback.service';

// Instructor inbox. Reads return every feedback row for the caller's
// assigned students (or every row for admin). Status mutations are gated
// inside the service by `students.instructorId === caller.userId`.
@Controller('api/instructor/feedback')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('instructor', 'admin')
export class FeedbackInstructorController {
  constructor(private readonly service: FeedbackService) {}

  @Get()
  async listInbox(@CurrentUser() user: { userId: string; role: string }) {
    return this.service.listInbox(user);
  }

  @Put(':id/status')
  async setStatus(
    @Param('id') id: string,
    @Body() body: { status: FeedbackStatus; instructorReply?: string },
    @CurrentUser() user: { userId: string; role: string },
  ) {
    return this.service.setStatus(id, user, body.status, body.instructorReply);
  }
}
