import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import type { JwtPayload } from './auth.service';
import { AuthService } from './auth.service';
import type { RequestActor } from '../../common/types';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(private readonly authService: AuthService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: process.env.JWT_SECRET ?? 'dev-secret',
    });
  }

  /**
   * Runs on every request carrying a Bearer token. The token only proves
   * "this subject was valid when it was issued" -- we re-look-up the user
   * here so a role change or account removal takes effect immediately
   * instead of waiting for the token to expire.
   */
  async validate(payload: JwtPayload): Promise<RequestActor> {
    const user = await this.authService.findById(payload.sub);
    if (!user) {
      throw new UnauthorizedException('User no longer exists.');
    }
    return { name: user.name, role: user.role, userId: user.id };
  }
}
