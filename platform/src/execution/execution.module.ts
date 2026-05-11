import { Module } from '@nestjs/common';
import { ContentModule } from '../content/content.module';
import { RunController } from './run.controller';
import { RunnerService } from './runner.service';
import { DockerRunner } from './docker-runner';

@Module({
  imports: [ContentModule],
  controllers: [RunController],
  providers: [
    RunnerService,
    {
      provide: DockerRunner,
      useFactory: () => {
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        const Docker = require('dockerode');
        return new DockerRunner(new Docker());
      },
    },
  ],
  exports: [RunnerService, DockerRunner],
})
export class ExecutionModule {}
