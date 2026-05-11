import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Put,
  UseGuards,
} from '@nestjs/common';
import { HelpAnchorKind, HelpRequestStatus } from '@prisma/client';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { HelpRequestService } from './help-request.service';

// Student-facing endpoints. The "Need help?" button on the lesson page,
// exercise renderers, and attempt detail call POST /api/help-requests; the
// student-facing inbox is reached via GET /api/help-requests/:id (the
// student doesn't have an inbox UI — they navigate to a specific thread
// from a notification or an open-requests pill).
@Controller('api/help-requests')
@UseGuards(JwtAuthGuard)
export class HelpRequestStudentController {
  constructor(private readonly service: HelpRequestService) {}

  @Post()
  async create(
    @CurrentUser() user: { userId: string },
    @Body() body: {
      anchorKind: HelpAnchorKind;
      anchorId: string;
      title: string;
      body: string;
    },
  ) {
    return this.service.createForStudent({
      studentUserId: user.userId,
      anchorKind: body.anchorKind,
      anchorId: body.anchorId,
      title: body.title,
      body: body.body,
    });
  }

  @Get(':id')
  async getThread(
    @Param('id') id: string,
    @CurrentUser() user: { userId: string; role: string },
  ) {
    return this.service.getThread(id, user.userId, user.role);
  }

  @Post(':id/messages')
  async appendReply(
    @Param('id') id: string,
    @Body() body: { body: string },
    @CurrentUser() user: { userId: string; role: string },
  ) {
    return this.service.appendReply(id, user.userId, user.role, body.body);
  }

  @Put(':id/status')
  async setStatus(
    @Param('id') id: string,
    @Body() body: { status: HelpRequestStatus },
    @CurrentUser() user: { userId: string; role: string },
  ) {
    return this.service.setStatus(id, user.userId, user.role, body.status);
  }
}
