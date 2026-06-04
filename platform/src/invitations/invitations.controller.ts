import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  UseGuards,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import { IsEmail, IsIn, IsString, MinLength } from 'class-validator';
import { UserRole } from '@prisma/client';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { InvitationsService } from './invitations.service';

class CreateInvitationDto {
  @IsEmail()
  email: string;

  @IsString()
  @MinLength(1)
  name: string;

  @IsIn(['student', 'instructor', 'admin'])
  role: UserRole;
}

@Controller('api/invitations')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('instructor', 'admin')
export class InvitationsController {
  constructor(private readonly service: InvitationsService) {}

  @Post()
  @UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
  async create(
    @Body() dto: CreateInvitationDto,
    @CurrentUser() user: { userId: string; role: string },
  ) {
    const { invitation, token, acceptUrlPath } = await this.service.issue(
      { email: dto.email, name: dto.name, role: dto.role },
      user,
    );
    // token is returned exactly once so the client can render the magic-link card.
    return { invitation, token, acceptUrlPath };
  }

  @Get()
  async list(@CurrentUser() user: { userId: string; role: string }) {
    return this.service.list(user);
  }

  @Post(':id/revoke')
  async revoke(
    @Param('id') id: string,
    @CurrentUser() user: { userId: string; role: string },
  ) {
    await this.service.revoke(id, user);
    return { ok: true };
  }
}
