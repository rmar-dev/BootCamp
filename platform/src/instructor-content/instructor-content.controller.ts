import { Body, Controller, Param, Post, Put, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import {
  InstructorContentService,
  type SaveLessonInput,
  type SaveLessonResult,
} from './instructor-content.service';

@Controller('api/instructor/content')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('instructor', 'admin')
export class InstructorContentController {
  constructor(private readonly service: InstructorContentService) {}

  @Post('lessons')
  async createLesson(
    @Body() body: SaveLessonInput,
    @CurrentUser() user: { userId: string },
  ): Promise<SaveLessonResult> {
    // Stamp authorship server-side so the body cannot impersonate a different
    // instructor. Body-supplied authorUserId is ignored.
    return this.service.createLesson({ ...body, authorUserId: user.userId });
  }

  @Put('lessons/:id')
  async updateLesson(
    @Param('id') id: string,
    @Body() body: SaveLessonInput,
    @CurrentUser() user: { userId: string },
  ): Promise<SaveLessonResult> {
    return this.service.updateLesson(id, { ...body, authorUserId: user.userId });
  }
}
