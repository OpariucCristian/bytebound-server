import { INestApplication, NotFoundException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { Server } from 'http';
import { AddressInfo } from 'net';
import { io, Socket } from 'socket.io-client';
import { Ack, GameEvents, GamesGateway } from './games.gateway';
import { GamesService } from './games.service';
import { SocketAuthService } from '../auth/socket-auth.service';

// These pull in ESM-only packages Jest can't load. Auth and the service are
// replaced below anyway.
jest.mock('jwks-rsa', () => ({ JwksClient: jest.fn() }));
jest.mock('./games.service', () => ({ GamesService: class {} }));

const GAME_ID = '6f1c1c52-8d7e-4f0e-9d7a-1b2c3d4e5f60';
const ANSWER_ID = '0b7c6a52-1d2e-4f3a-8b9c-0d1e2f3a4b5c';

const emit = (
  socket: Socket,
  event: string,
  payload?: unknown,
): Promise<Ack<unknown>> => socket.emitWithAck(event, payload);

const question = (questionSeconds = 15) => ({
  id: 'q1',
  text: 'What is 1 + 1?',
  questionSeconds,
  answers: [{ id: ANSWER_ID, text: '2' }],
});

describe('GamesGateway', () => {
  let app: INestApplication;
  let url: string;
  let gamesService: Record<string, jest.Mock>;
  let authenticate: jest.Mock;
  const sockets: Socket[] = [];

  const connect = (token = 'token'): Promise<Socket> =>
    new Promise((resolve, reject) => {
      const socket = io(`${url}/games`, {
        auth: { token },
        transports: ['websocket'],
        reconnection: false,
      });
      sockets.push(socket);
      socket.on('connect', () => resolve(socket));
      socket.on('connect_error', reject);
    });

  beforeEach(async () => {
    gamesService = {
      startNewGame: jest.fn().mockResolvedValue({
        id: GAME_ID,
        firstQuestion: question(),
      }),
      markQuestionStarted: jest.fn().mockResolvedValue(undefined),
      checkAnswer: jest.fn().mockResolvedValue({
        correct: true,
        playerLives: 3,
        enemyLives: 1,
        gameOver: false,
      }),
      timeoutQuestion: jest.fn().mockResolvedValue({
        correct: false,
        playerLives: 2,
        enemyLives: 2,
        gameOver: false,
      }),
      getNextQuestion: jest.fn().mockResolvedValue(question()),
    };

    authenticate = jest.fn().mockResolvedValue('user-1');

    const moduleRef = await Test.createTestingModule({
      providers: [
        GamesGateway,
        { provide: GamesService, useValue: gamesService },
        { provide: SocketAuthService, useValue: { authenticate } },
      ],
    }).compile();

    app = moduleRef.createNestApplication();
    await app.listen(0);
    const { port } = (app.getHttpServer() as Server).address() as AddressInfo;
    url = `http://localhost:${port}`;
  });

  afterEach(async () => {
    sockets.splice(0).forEach((s) => s.disconnect());
    await app.close();
  });

  it('rejects connections that fail authentication', async () => {
    authenticate.mockRejectedValue(new Error('bad token'));
    await expect(connect()).rejects.toThrow('Unauthorized');
  });

  it('plays a game over the socket', async () => {
    const socket = await connect();

    const started = await emit(socket, GameEvents.Start, {
      category: 'dsa',
      difficulty: 1,
    });
    expect(started).toEqual({
      ok: true,
      data: { id: GAME_ID, firstQuestion: question() },
    });
    expect(gamesService.startNewGame).toHaveBeenCalledWith(
      { category: 'dsa', difficulty: 1 },
      'user-1',
    );

    await expect(emit(socket, GameEvents.QuestionReady)).resolves.toEqual({
      ok: true,
      data: null,
    });
    expect(gamesService.markQuestionStarted).toHaveBeenCalledWith(
      GAME_ID,
      'user-1',
      expect.any(Date),
    );

    const answered = await emit(socket, GameEvents.Answer, {
      answerId: ANSWER_ID,
    });
    expect(answered).toEqual({
      ok: true,
      data: { correct: true, playerLives: 3, enemyLives: 1, gameOver: false },
    });
    expect(gamesService.checkAnswer).toHaveBeenCalledWith(
      GAME_ID,
      ANSWER_ID,
      'user-1',
    );

    const next = await emit(socket, GameEvents.NextQuestion);
    expect(next).toEqual({ ok: true, data: question() });
  });

  it('times out an unanswered question on the server', async () => {
    gamesService.startNewGame.mockResolvedValue({
      id: GAME_ID,
      firstQuestion: question(0),
    });
    const socket = await connect();
    const timedOut = new Promise((resolve) =>
      socket.once(GameEvents.QuestionTimeout, resolve),
    );

    await emit(socket, GameEvents.Start, {});
    await emit(socket, GameEvents.QuestionReady);

    await expect(timedOut).resolves.toEqual({
      correct: false,
      playerLives: 2,
      enemyLives: 2,
      gameOver: false,
    });
    expect(gamesService.timeoutQuestion).toHaveBeenCalledWith(
      GAME_ID,
      'user-1',
    );
  });

  it('does not time out a question that was answered', async () => {
    gamesService.startNewGame.mockResolvedValue({
      id: GAME_ID,
      firstQuestion: question(0),
    });
    const socket = await connect();

    await emit(socket, GameEvents.Start, {});
    await emit(socket, GameEvents.QuestionReady);
    await emit(socket, GameEvents.Answer, { answerId: ANSWER_ID });
    await new Promise((resolve) => setTimeout(resolve, 1500));

    expect(gamesService.timeoutQuestion).not.toHaveBeenCalled();
  });

  it('rejects answers when no game is running', async () => {
    const socket = await connect();

    await expect(
      emit(socket, GameEvents.Answer, { answerId: ANSWER_ID }),
    ).resolves.toEqual({
      ok: false,
      error: 'No game is running on this connection',
    });
  });

  it('validates payloads', async () => {
    const socket = await connect();
    await emit(socket, GameEvents.Start, {});

    const result = await emit(socket, GameEvents.Answer, {
      answerId: 'not-a-uuid',
    });
    expect(result).toEqual({
      ok: false,
      error: expect.stringMatching(/^Invalid payload/) as unknown,
    });
    expect(gamesService.checkAnswer).not.toHaveBeenCalled();
  });

  it('forwards game errors to the client', async () => {
    gamesService.startNewGame.mockRejectedValue(
      new NotFoundException('Could not find player'),
    );
    const socket = await connect();

    await expect(emit(socket, GameEvents.Start, {})).resolves.toEqual({
      ok: false,
      error: 'Could not find player',
    });
  });
});
