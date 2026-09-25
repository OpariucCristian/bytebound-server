import { ConfigService } from '@nestjs/config';
import * as jwt from 'jsonwebtoken';
import { Socket } from 'socket.io';
import { SocketAuthService } from './socket-auth.service';
import { GUEST_ISSUER } from './guest';

// ESM-only; Clerk tokens aren't exercised here.
jest.mock('jwks-rsa', () => ({ JwksClient: jest.fn() }));

const SECRET = 'test-guest-secret';

const config = {
  get: (key: string, fallback?: unknown) =>
    key === 'GUEST_JWT_SECRET' ? SECRET : fallback,
  getOrThrow: () => 'https://clerk.example.com',
} as unknown as ConfigService;

const socketWith = (token: string) =>
  ({ handshake: { auth: { token }, headers: {} } }) as unknown as Socket;

const guestToken = (sub: string, secret = SECRET) =>
  jwt.sign({ username: 'Guest-ABCD' }, secret, {
    subject: sub,
    issuer: GUEST_ISSUER,
    algorithm: 'HS256',
    expiresIn: 60,
  });

describe('SocketAuthService', () => {
  const service = new SocketAuthService(config);

  it('accepts a guest token signed by this server', async () => {
    await expect(
      service.authenticate(socketWith(guestToken('guest_123'))),
    ).resolves.toBe('guest_123');
  });

  it('rejects a guest token signed with another secret', async () => {
    await expect(
      service.authenticate(socketWith(guestToken('guest_123', 'other'))),
    ).rejects.toThrow();
  });

  it('rejects a guest-issued token for a non-guest id', async () => {
    await expect(
      service.authenticate(socketWith(guestToken('user_123'))),
    ).rejects.toThrow('Invalid guest token');
  });

  it('rejects a handshake without a token', async () => {
    await expect(service.authenticate(socketWith(''))).rejects.toThrow(
      'Missing token',
    );
  });
});
