import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { HelpRequestStatus } from '@prisma/client';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { HelpRequestService } from './help-request.service';

@Controller('api/instructor/help-requests')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('instructor', 'admin')
export class HelpRequestInstructorController {
  constructor(private readonly service: HelpRequestService) {}

  /**
   * Instructor inbox. Defaults to "open + answered" (un-resolved) for the
   * default at-a-glance view. Pass ?status=resolved (or any specific status)
   * to scope to that bucket explicitly.
   */
  @Get()
  async getInbox(
    @CurrentUser() user: { userId: string },
    @Query('status') status?: HelpRequestStatus,
  ) {
    return this.service.getInbox(user.userId, status);
  }
}
