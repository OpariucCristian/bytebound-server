import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomBytes } from 'crypto';

/** `iss` of the tokens this server signs for guest players. */
export const GUEST_ISSUER = 'bytebound-guest';
/** Guest player ids start with this, which keeps them off the scoreboard. */
export const GUEST_ID_PREFIX = 'guest_';
export const GUEST_TOKEN_TTL_SECONDS = 24 * 60 * 60;

/** Strategies that identify a player: Clerk sign-in or a guest token. */
export const PLAYER_AUTH = ['jwt', 'guest-jwt'];

let fallbackSecret: string | undefined;

/**
 * Secret used to sign guest tokens. Without `GUEST_JWT_SECRET` a random one is
 * made per process, so guest tokens stop working when the server restarts.
 */
export const getGuestSecret = (config: ConfigService): string => {
  const secret = config.get<string>('GUEST_JWT_SECRET');
  if (secret) return secret;

  if (!fallbackSecret) {
    new Logger('GuestAuth').warn(
      'GUEST_JWT_SECRET is not set; guest sessions will end when the server restarts',
    );
    fallbackSecret = randomBytes(32).toString('hex');
  }
  return fallbackSecret;
};

export const isGuestId = (uid: string) => uid.startsWith(GUEST_ID_PREFIX);
