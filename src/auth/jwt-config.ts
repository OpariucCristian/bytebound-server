import { ConfigService } from '@nestjs/config';
import type { Algorithm } from 'jsonwebtoken';

export interface AuthTokenPayload {
  sub?: string;
  /** Clerk: the origin the token was issued to. */
  azp?: string;
  [claim: string]: unknown;
}

export interface JwtSettings {
  issuer: string;
  jwksUri: string;
  audience?: string;
  algorithms: Algorithm[];
  /** Origins allowed to use tokens (checked against the `azp` claim). */
  authorizedParties: string[];
}

/**
 * Token settings shared by the HTTP guard and the game socket.
 *
 * Defaults target Clerk session tokens: RS256, keys at
 * `<issuer>/.well-known/jwks.json`, no audience.
 */
export const getJwtSettings = (config: ConfigService): JwtSettings => {
  const issuer = config.getOrThrow<string>('JWT_ISSUER').replace(/\/+$/, '');

  return {
    issuer,
    jwksUri:
      config.get<string>('JWKS_URI') ?? `${issuer}/.well-known/jwks.json`,
    audience: config.get<string>('JWT_AUDIENCE') || undefined,
    algorithms: (config.get<string>('JWT_ALGORITHMS') ?? 'RS256')
      .split(',')
      .map((a) => a.trim() as Algorithm),
    authorizedParties: config
      .get<string>('CORS_ORIGINS', '')
      .split(',')
      .map((o) => o.trim())
      .filter(Boolean),
  };
};

/**
 * Returns the user id of a verified token, or throws if the token is missing a
 * subject or was issued to a site we don't serve.
 */
export const getTokenSubject = (
  payload: AuthTokenPayload,
  settings: JwtSettings,
): string => {
  if (typeof payload.sub !== 'string' || !payload.sub) {
    throw new Error('Token has no subject');
  }
  if (
    payload.azp &&
    settings.authorizedParties.length > 0 &&
    !settings.authorizedParties.includes(payload.azp)
  ) {
    throw new Error(`Token was issued to an unknown origin: ${payload.azp}`);
  }
  return payload.sub;
};
