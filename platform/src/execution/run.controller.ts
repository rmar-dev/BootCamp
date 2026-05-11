import {
  Controller,
  Post,
  Body,
  HttpCode,
  HttpException,
  HttpStatus,
  UsePipes,
  ValidationPipe,
  UseGuards,
} from '@nestjs/common';
import { RunnerService } from './runner.service';
import { RunResponse } from './types';
import { RunDto } from './run.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@Controller('api/run')
export class RunController {
  constructor(private readonly runner: RunnerService) {}

  @Post()
  @HttpCode(200)
  @UseGuards(JwtAuthGuard)
  @UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
  async run(@Body() dto: RunDto): Promise<RunResponse> {
    try {
      return await this.runner.run({
        exerciseId: dto.exerciseId,
        exerciseVersion: dto.exerciseVersion,
        code: dto.code,
      });
    } catch (err) {
      if (err instanceof Error && err.message === 'queue_saturated') {
        throw new HttpException('Server busy, try again later', HttpStatus.SERVICE_UNAVAILABLE);
      }
      throw err;
    }
  }
}
