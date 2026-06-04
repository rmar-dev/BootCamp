import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { StateModule } from '../state/state.module';
import { InvitationsService } from './invitations.service';
import { InvitationsController } from './invitations.controller';
import { InvitationRepository } from './invitation.repository';

@Module({
  imports: [AuthModule, StateModule],
  controllers: [InvitationsController],
  providers: [InvitationsService, InvitationRepository],
  exports: [InvitationsService],
})
export class InvitationsModule {}
