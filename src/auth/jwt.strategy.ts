import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy, ExtractJwt } from 'passport-jwt';
import { passportJwtSecret } from 'jwks-rsa';
import { ConfigService } from '@nestjs/config';
import {
  AuthTokenPayload,
  getJwtSettings,
  getTokenSubject,
  JwtSettings,
} from './jwt-config';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  private readonly settings: JwtSettings;

  constructor(configService: ConfigService) {
    const settings = getJwtSettings(configService);

    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKeyProvider: passportJwtSecret({
        cache: true,
        rateLimit: true,
        jwksRequestsPerMinute: 10,
        jwksUri: settings.jwksUri,
      }),
      issuer: settings.issuer,
      audience: settings.audience,
      algorithms: settings.algorithms,
    });
    this.settings = settings;
  }

  validate(payload: AuthTokenPayload) {
    try {
      return { ...payload, sub: getTokenSubject(payload, this.settings) };
    } catch (err) {
      throw new UnauthorizedException((err as Error).message);
    }
  }
}
