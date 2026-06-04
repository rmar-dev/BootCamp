import { Module } from '@nestjs/common';
import { PassportModule } from '@nestjs/passport';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { UserRepository } from './user.repository';
import { JwtStrategy } from './strategies/jwt.strategy';
import { LocalStrategy } from './strategies/local.strategy';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { RolesGuard } from './guards/roles.guard';
import { InvitationRepository } from '../invitations/invitation.repository';

@Module({
  imports: [PassportModule],
  controllers: [AuthController],
  providers: [
    UserRepository,
    InvitationRepository,
    {
      provide: AuthService,
      useFactory: (userRepo: UserRepository, invitationRepo: InvitationRepository) =>
        new AuthService(
          userRepo,
          invitationRepo,
          process.env.JWT_SECRET ?? 'dev-secret-change-me-in-production',
          process.env.JWT_REFRESH_SECRET ?? 'dev-refresh-secret-change-me-in-production',
        ),
      inject: [UserRepository, InvitationRepository],
    },
    {
      provide: JwtStrategy,
      useFactory: () =>
        new JwtStrategy(process.env.JWT_SECRET ?? 'dev-secret-change-me-in-production'),
    },
    LocalStrategy,
    JwtAuthGuard,
    RolesGuard,
  ],
  exports: [AuthService, UserRepository, InvitationRepository, JwtAuthGuard, RolesGuard],
})
export class AuthModule {}
