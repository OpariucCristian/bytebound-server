import { HttpException, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  ConnectedSocket,
  MessageBody,
  OnGatewayDisconnect,
  OnGatewayInit,
  SubscribeMessage,
  WebSocketGateway,
} from '@nestjs/websockets';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { JwksClient } from 'jwks-rsa';
import * as jwt from 'jsonwebtoken';
import { Namespace, Socket } from 'socket.io';
import {
  AnswerResultDto,
  CreateNewGameDto,
  QuestionPoolDto,
  ReadNewGameDto,
  SubmitAnswerDto,
} from './dto/game.dto';
import { GamesService } from './games.service';
import {
  getJwtSettings,
  getTokenSubject,
  JwtSettings,
} from '../auth/jwt-config';
import { getGuestSecret, GUEST_ISSUER, isGuestId } from '../auth/guest';

/**
 * Socket.IO protocol for a game session (namespace `/games`).
 *
 * Client -> server (every event is acknowledged with an `Ack`):
 *   `game:start`          CreateNewGameDto -> ReadNewGameDto
 *   `game:question_ready` (none)           -> null   question is visible, start the clock
 *   `game:answer`         SubmitAnswerDto  -> AnswerResultDto
 *   `game:next_question`  (none)           -> QuestionPoolDto
 *
 * Server -> client:
 *   `game:question_timeout` AnswerResultDto   the answer window ran out
 */
export const GameEvents = {
  Start: 'game:start',
  QuestionReady: 'game:question_ready',
  Answer: 'game:answer',
  NextQuestion: 'game:next_question',
  QuestionTimeout: 'game:question_timeout',
} as const;

export type Ack<T> = { ok: true; data: T } | { ok: false; error: string };

/** An error whose message is safe to send to the client. */
class GameSocketError extends Error {}

/** Extra time the server allows past the countdown, to absorb latency. */
const ANSWER_GRACE_MS = 1000;
/** How long the client may take to show a question (intro/enemy animations). */
const MAX_READY_DELAY_MS = 10000;

interface GameSession {
  userId: string;
  gameId?: string;
  questionSeconds: number;
  questionSentAt: number;
  questionStarted: boolean;
  timer?: NodeJS.Timeout;
  /** Serializes game actions so an answer and a timeout can't both apply. */
  queue: Promise<unknown>;
}

@WebSocketGateway({ namespace: '/games' })
export class GamesGateway implements OnGatewayInit, OnGatewayDisconnect {
  private readonly logger = new Logger(GamesGateway.name);
  private readonly jwksClient: JwksClient;
  private readonly jwtSettings: JwtSettings;
  private readonly guestSecret: string;

  constructor(
    configService: ConfigService,
    private readonly gamesService: GamesService,
  ) {
    this.jwtSettings = getJwtSettings(configService);
    this.guestSecret = getGuestSecret(configService);
    this.jwksClient = new JwksClient({
      jwksUri: this.jwtSettings.jwksUri,
      cache: true,
      rateLimit: true,
    });
  }

  afterInit(namespace: Namespace) {
    // Authenticate during the handshake so the client gets a `connect_error`
    // instead of a silent disconnect.
    namespace.use((socket, next) => {
      this.authenticate(socket)
        .then((userId) => {
          const session: GameSession = {
            userId,
            questionSeconds: 0,
            questionSentAt: 0,
            questionStarted: false,
            queue: Promise.resolve(),
          };
          socket.data = { session };
          next();
        })
        .catch((err: Error) => {
          this.logger.warn(`WS auth failed: ${err.message}`);
          next(new Error('Unauthorized'));
        });
    });
  }

  handleDisconnect(client: Socket) {
    this.clearTimer(this.getSession(client));
  }

  @SubscribeMessage(GameEvents.Start)
  handleStart(
    @ConnectedSocket() client: Socket,
    @MessageBody() body: unknown,
  ): Promise<Ack<ReadNewGameDto>> {
    return this.run(client, async (session) => {
      const dto = await this.parse(CreateNewGameDto, body);
      this.clearTimer(session);

      const game = await this.gamesService.startNewGame(dto, session.userId);
      session.gameId = game.id;
      this.beginQuestion(client, session, game.firstQuestion);
      return game;
    });
  }

  @SubscribeMessage(GameEvents.QuestionReady)
  handleQuestionReady(@ConnectedSocket() client: Socket): Promise<Ack<null>> {
    return this.run(client, async (session) => {
      const gameId = this.requireGame(session);
      if (session.questionStarted || !session.timer) return null;

      // The clock starts when the player can see the question, but a client
      // can't hold a question back indefinitely to get more time.
      const startedAt = Math.min(
        Date.now(),
        session.questionSentAt + MAX_READY_DELAY_MS,
      );
      session.questionStarted = true;

      await this.gamesService.markQuestionStarted(
        gameId,
        session.userId,
        new Date(startedAt),
      );
      this.scheduleTimeout(
        client,
        session,
        startedAt +
          session.questionSeconds * 1000 +
          ANSWER_GRACE_MS -
          Date.now(),
      );
      return null;
    });
  }

  @SubscribeMessage(GameEvents.Answer)
  handleAnswer(
    @ConnectedSocket() client: Socket,
    @MessageBody() body: unknown,
  ): Promise<Ack<AnswerResultDto>> {
    return this.run(client, async (session) => {
      const gameId = this.requireGame(session);
      const dto = await this.parse(SubmitAnswerDto, body);

      const result = await this.gamesService.checkAnswer(
        gameId,
        dto.answerId,
        session.userId,
      );
      this.clearTimer(session);
      return result;
    });
  }

  @SubscribeMessage(GameEvents.NextQuestion)
  handleNextQuestion(
    @ConnectedSocket() client: Socket,
  ): Promise<Ack<QuestionPoolDto>> {
    return this.run(client, async (session) => {
      const gameId = this.requireGame(session);
      const question = await this.gamesService.getNextQuestion(
        gameId,
        session.userId,
      );
      this.beginQuestion(client, session, question);
      return question;
    });
  }

  private beginQuestion(
    client: Socket,
    session: GameSession,
    question: QuestionPoolDto,
  ) {
    session.questionSeconds = question.questionSeconds ?? 15;
    session.questionSentAt = Date.now();
    session.questionStarted = false;

    // Fallback in case the client never reports the question as ready.
    this.scheduleTimeout(
      client,
      session,
      MAX_READY_DELAY_MS + session.questionSeconds * 1000 + ANSWER_GRACE_MS,
    );
  }

  private scheduleTimeout(client: Socket, session: GameSession, ms: number) {
    this.clearTimer(session);
    session.timer = setTimeout(
      () => {
        session.timer = undefined;
        void this.run(client, (s) => this.expireQuestion(client, s));
      },
      Math.max(ms, 0),
    );
  }

  private async expireQuestion(client: Socket, session: GameSession) {
    if (!session.gameId) return null;

    const result = await this.gamesService.timeoutQuestion(
      session.gameId,
      session.userId,
    );
    if (result) {
      this.logger.debug(`Question timed out for game ${session.gameId}`);
      client.emit(GameEvents.QuestionTimeout, result);
    }
    return null;
  }

  private clearTimer(session: GameSession | undefined) {
    if (session?.timer) {
      clearTimeout(session.timer);
      session.timer = undefined;
    }
  }

  /** Runs a game action for this socket's session, one at a time. */
  private run<T>(
    client: Socket,
    action: (session: GameSession) => Promise<T>,
  ): Promise<Ack<T>> {
    const session = this.getSession(client);
    if (!session) {
      return Promise.resolve({ ok: false, error: 'Not authenticated' });
    }

    const result = session.queue.then(() => action(session));
    session.queue = result.catch(() => undefined);

    return result.then(
      (data): Ack<T> => ({ ok: true, data }),
      (err: unknown): Ack<T> => ({ ok: false, error: this.toMessage(err) }),
    );
  }

  private getSession(client: Socket): GameSession | undefined {
    return (client.data as { session?: GameSession } | undefined)?.session;
  }

  private requireGame(session: GameSession): string {
    if (!session.gameId) {
      throw new GameSocketError('No game is running on this connection');
    }
    return session.gameId;
  }

  private async parse<T extends object>(
    cls: new () => T,
    body: unknown,
  ): Promise<T> {
    const dto = plainToInstance(cls, body ?? {});
    const errors = await validate(dto);
    if (errors.length > 0) {
      const messages = errors.flatMap((e) =>
        Object.values(e.constraints ?? {}),
      );
      throw new GameSocketError(`Invalid payload: ${messages.join(', ')}`);
    }
    return dto;
  }

  private toMessage(err: unknown): string {
    if (err instanceof HttpException || err instanceof GameSocketError) {
      return err.message;
    }
    this.logger.error('Unhandled game socket error', err);
    return 'An unexpected error occurred';
  }

  private async authenticate(socket: Socket): Promise<string> {
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
