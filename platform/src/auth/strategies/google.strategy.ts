import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy, Profile } from 'passport-google-oauth20';
import { AuthService } from '../auth.service';

@Injectable()
export class GoogleStrategy extends PassportStrategy(Strategy, 'google') {
  constructor(
    private readonly authService: AuthService,
    clientID: string,
    clientSecret: string,
    callbackURL: string,
  ) {
    super({
      clientID,
      clientSecret,
      callbackURL,
      scope: ['profile', 'email'],
    });
  }

  async validate(
    _accessToken: string,
    _refreshToken: string,
    profile: Profile,
    done: (err: any, user: any) => void,
  ) {
    try {
      const result = await this.authService.findOrCreateGoogleUser(
        profile.id,
        profile.emails![0].value,
        profile.displayName,
      );
      done(null, result);
    } catch (err) {
      done(err, null);
    }
  }
}
