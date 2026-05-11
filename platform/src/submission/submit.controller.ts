import {
  Body,
  Controller,
  HttpCode,
  Post,
  UseGuards,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import { IsInt, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { SubmissionService } from './submission.service';

class SubmitDto {
  @IsString()
  @MinLength(1)
  exerciseId: string;

  @IsInt()
  exerciseVersion: number;

  @IsOptional()
  @IsString()
  @MaxLength(65536)
  code?: string;

  @IsOptional()
  answer?: unknown;

  @IsOptional()
  @IsString()
  repoUrl?: string;

  @IsOptional()
  @IsString()
  commitSha?: string;

  @IsOptional()
  @IsString()
  notes?: string;
}

@Controller('api/submit')
export class SubmitController {
  constructor(private readonly submission: SubmissionService) {}

  @Post()
  @HttpCode(200)
  @UseGuards(JwtAuthGuard)
  @UsePipes(new ValidationPipe({ transform: true, whitelist: false }))
  async submit(
    @CurrentUser() user: { userId: string; email: string; role: string },
    @Body() dto: SubmitDto,
  ) {
    return this.submission.submit(user.userId, {
      exerciseId: dto.exerciseId,
      exerciseVersion: dto.exerciseVersion,
      code: dto.code,
      answer: dto.answer,
      repoUrl: dto.repoUrl,
      commitSha: dto.commitSha,
      notes: dto.notes,
    });
  }
}
