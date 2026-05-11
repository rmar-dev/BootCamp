import { Module } from '@nestjs/common';
import { ContentModule } from '../content/content.module';
import { AuthModule } from '../auth/auth.module';
import { PrismaModule } from '../prisma/prisma.module';
import { InstructorContentController } from './instructor-content.controller';
import { InstructorContentService } from './instructor-content.service';

@Module({
  imports: [ContentModule, AuthModule, PrismaModule],
  controllers: [InstructorContentController],
  providers: [InstructorContentService],
  exports: [InstructorContentService],
})
export class InstructorContentModule {}
