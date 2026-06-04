import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  UseGuards,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import { IsIn, IsString } from 'class-validator';
import { UserRole } from '@prisma/client';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { AdminService } from './admin.service';

class ChangeRoleDto {
  @IsString()
  @IsIn(['student', 'instructor', 'admin'])
  role: UserRole;
}

@Controller('api/admin')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin')
export class AdminController {
  constructor(private readonly service: AdminService) {}

  @Get('users')
  listUsers() {
    return this.service.listUsers();
  }

  @Patch('users/:id/role')
  @UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
  changeRole(
    @Param('id') id: string,
    @Body() dto: ChangeRoleDto,
    @CurrentUser() user: { userId: string; role: string },
  ) {
    return this.service.changeRole(id, dto.role, user.userId);
  }
}
