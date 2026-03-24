import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy, ExtractJwt } from 'passport-jwt';
import { passportJwtSecret } from 'jwks-rsa';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  private readonly logger = new Logger(JwtStrategy.name);

  constructor(configService: ConfigService) {
    const issuer = configService.get<string>('JWT_ISSUER')!;
    const jwksUri = configService.get<string>('JWKS_URI')!;

    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKeyProvider: passportJwtSecret({
        cache: true,
        rateLimit: true,
        jwksRequestsPerMinute: 10,
        jwksUri,
      }),
      issuer,
      audience: configService.get<string>('JWT_AUDIENCE', 'authenticated'),
      algorithms: ['ES256'],
    });
  }

  validate(payload: any) {
    if (!payload?.sub) {
      throw new UnauthorizedException('Invalid token payload');
    }
    return { sub: payload.sub, email: payload.email, ...payload };
  }
}
