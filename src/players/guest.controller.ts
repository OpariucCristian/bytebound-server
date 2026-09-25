import {
  Controller,
  HttpException,
  HttpStatus,
  Post,
  Req,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Request } from 'express';
import * as jwt from 'jsonwebtoken';
import { randomUUID } from 'crypto';
import { PlayersService } from './players.service';
import {
  getGuestSecret,
  GUEST_ID_PREFIX,
  GUEST_ISSUER,
  GUEST_TOKEN_TTL_SECONDS,
} from '../auth/guest';

export interface GuestSessionDto {
  token: string;
  /** Unix time in milliseconds. */
  expiresAt: number;
  playerId: string;
  username: string;
}

/** Guest sessions a single address may start per window. */
const MAX_SESSIONS_PER_WINDOW = 20;
const WINDOW_MS = 60 * 60 * 1000;

/**
 * Lets people play without an account. A guest gets a server-signed token and
 * a player with a default hero, so the first run starts in one click.
 */
@Controller('api/guest')
export class GuestController {
  private readonly recentSessions = new Map<string, number[]>();

  constructor(
    private readonly playersService: PlayersService,
    private readonly configService: ConfigService,
  ) {}

  @Post('session')
  async createSession(@Req() req: Request): Promise<GuestSessionDto> {
    this.throttle(this.clientAddress(req));

    const playerId = `${GUEST_ID_PREFIX}${randomUUID()}`;
    const username = `Guest-${playerId.slice(-4).toUpperCase()}`;
    await this.playersService.createGuestPlayer(playerId, username);

    const token = jwt.sign({ username }, getGuestSecret(this.configService), {
      subject: playerId,
      issuer: GUEST_ISSUER,
      algorithm: 'HS256',
      expiresIn: GUEST_TOKEN_TTL_SECONDS,
    });

    return {
      token,
      expiresAt: Date.now() + GUEST_TOKEN_TTL_SECONDS * 1000,
      playerId,
      username,
    };
  }

  private clientAddress(req: Request): string {
    // Render sits behind a proxy, so the caller is the first forwarded address.
    const forwarded = req.headers['x-forwarded-for'];
    const first = (Array.isArray(forwarded) ? forwarded[0] : forwarded)
      ?.split(',')[0]
      ?.trim();
    return first || req.ip || 'unknown';
  }

  private throttle(address: string) {
    const now = Date.now();
    const recent = (this.recentSessions.get(address) ?? []).filter(
      (t) => now - t < WINDOW_MS,
    );
    if (recent.length >= MAX_SESSIONS_PER_WINDOW) {
      throw new HttpException(
        'Too many guest sessions from this address. Try again later.',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
    recent.push(now);
    this.recentSessions.set(address, recent);
  }
}
