import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwksClient } from 'jwks-rsa';
import * as jwt from 'jsonwebtoken';
import { Socket } from 'socket.io';
import { getJwtSettings, getTokenSubject, JwtSettings } from './jwt-config';
import { getGuestSecret, GUEST_ISSUER, isGuestId } from './guest';

/**
 * Verifies the token a socket sends in its handshake: a Clerk session token or
 * a guest token signed by this server. Shared by every Socket.IO gateway.
 */
@Injectable()
export class SocketAuthService {
  private readonly jwksClient: JwksClient;
  private readonly jwtSettings: JwtSettings;
  private readonly guestSecret: string;

  constructor(configService: ConfigService) {
    this.jwtSettings = getJwtSettings(configService);
    this.guestSecret = getGuestSecret(configService);
    this.jwksClient = new JwksClient({
      jwksUri: this.jwtSettings.jwksUri,
      cache: true,
      rateLimit: true,
    });
  }

  /** Returns the user id of the socket's token, or throws. */
  async authenticate(socket: Socket): Promise<string> {
    const auth = socket.handshake.auth as { token?: unknown } | undefined;
    const token =
      typeof auth?.token === 'string'
        ? auth.token
        : socket.handshake.headers.authorization?.split(' ')[1];

    if (!token) {
      throw new Error('Missing token');
    }

    const decoded = jwt.decode(token, { complete: true });

    if (
      typeof decoded?.payload === 'object' &&
      decoded.payload.iss === GUEST_ISSUER
    ) {
      const payload = jwt.verify(token, this.guestSecret, {
        issuer: GUEST_ISSUER,
        algorithms: ['HS256'],
      });
      if (
        typeof payload === 'string' ||
        typeof payload.sub !== 'string' ||
        !isGuestId(payload.sub)
      ) {
        throw new Error('Invalid guest token');
      }
      return payload.sub;
    }

    if (!decoded?.header?.kid) {
      throw new Error('Token has no key id');
    }

    const signingKey = await this.jwksClient.getSigningKey(decoded.header.kid);
    const payload = jwt.verify(token, signingKey.getPublicKey(), {
      issuer: this.jwtSettings.issuer,
      audience: this.jwtSettings.audience,
      algorithms: this.jwtSettings.algorithms,
    });

    if (typeof payload === 'string') {
      throw new Error('Unexpected token payload');
    }
    return getTokenSubject(payload, this.jwtSettings);
  }
}
