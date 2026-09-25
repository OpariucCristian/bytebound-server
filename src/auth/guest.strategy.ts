import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy, ExtractJwt } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { AuthTokenPayload } from './jwt-config';
import { getGuestSecret, GUEST_ISSUER, isGuestId } from './guest';

/** Accepts the guest tokens issued by `POST api/guest/session`. */
@Injectable()
export class GuestJwtStrategy extends PassportStrategy(Strategy, 'guest-jwt') {
  constructor(configService: ConfigService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: getGuestSecret(configService),
      issuer: GUEST_ISSUER,
      algorithms: ['HS256'],
    });
  }

  validate(payload: AuthTokenPayload) {
    if (typeof payload.sub !== 'string' || !isGuestId(payload.sub)) {
      throw new UnauthorizedException('Not a guest token');
    }
    return payload;
  }
}
