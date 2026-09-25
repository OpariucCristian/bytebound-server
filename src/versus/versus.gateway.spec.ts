import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { Server } from 'http';
import { AddressInfo } from 'net';
import { io, Socket } from 'socket.io-client';
import { Socket as ServerSocket } from 'socket.io';
import { SocketAuthService } from '../auth/socket-auth.service';
import { Ack, SocketError } from '../common/socket-utils';
import { MatchmakingService } from './matchmaking.service';
import { VersusGateway } from './versus.gateway';
import { VersusService } from './versus.service';
import { VersusEvents } from './versus.constants';
import {
  Fighter,
  MatchedPayload,
  MatchSummary,
  RoundPayload,
  RoundResultPayload,
} from './versus.types';

// These pull in ESM-only packages Jest can't load. Auth and the service are
// replaced below anyway.
jest.mock('jwks-rsa', () => ({ JwksClient: jest.fn() }));
jest.mock('./versus.service', () => ({ VersusService: class {} }));

const RIGHT = '0b7c6a52-1d2e-4f3a-8b9c-0d1e2f3a4b5c';
const WRONG = '1c8d7b63-2e3f-4a4b-9cad-1e2f3a4b5c6d';

const fighter = (uid: string): Fighter => ({
  uid,
  userName: uid,
  lvl: 1,
  hero: {
    id: `hero-${uid}`,
    name: 'Knight',
    spriteKey: 'hero_knight',
    baseHealth: 2,
    baseAttack: 1,
  },
});

const emit = <T = unknown>(
  socket: Socket,
  event: string,
  payload?: unknown,
): Promise<Ack<T>> => socket.emitWithAck(event, payload);

const next = <T>(socket: Socket, event: string): Promise<T> =>
  new Promise((resolve) => socket.once(event, resolve));

describe('VersusGateway', () => {
  let app: INestApplication;
  let url: string;
  let versusService: Record<string, jest.Mock>;
  const sockets: Socket[] = [];

  /** Connects as `uid` (the fake auth uses the token as the user id). */
  const connect = (uid: string): Promise<Socket> =>
    new Promise((resolve, reject) => {
      const socket = io(`${url}/versus`, {
        auth: { token: uid },
        transports: ['websocket'],
        reconnection: false,
      });
      sockets.push(socket);
      socket.on('connect', () => resolve(socket));
      socket.on('connect_error', reject);
    });

  /** Pairs alice and bob through the queue and waits for round 1. */
  const startMatch = async () => {
    const alice = await connect('alice');
    const bob = await connect('bob');
    const aliceRound = next<RoundPayload>(alice, VersusEvents.Round);
    const bobRound = next<RoundPayload>(bob, VersusEvents.Round);

    await emit(alice, VersusEvents.Queue, { category: 'dsa' });
    await emit(bob, VersusEvents.Queue, { category: 'dsa' });
    await Promise.all([aliceRound, bobRound]);
    return { alice, bob };
  };

  const readyUp = async (alice: Socket, bob: Socket) => {
    const started = next(alice, VersusEvents.RoundStart);
    await emit(alice, VersusEvents.Ready);
    await emit(bob, VersusEvents.Ready);
    await started;
  };

  beforeEach(async () => {
    versusService = {
      getFighter: jest.fn((uid: string) => Promise.resolve(fighter(uid))),
      assertCategoryPlayable: jest.fn().mockResolvedValue(undefined),
      pickQuestion: jest.fn().mockResolvedValue({
        id: 'q1',
        text: 'Which is right?',
        answers: [
          { id: RIGHT, text: 'right', isCorrect: true },
          { id: WRONG, text: 'wrong', isCorrect: false },
        ],
      }),
      saveMatch: jest.fn().mockResolvedValue(undefined),
    };

    const moduleRef = await Test.createTestingModule({
      providers: [
        VersusGateway,
        MatchmakingService,
        { provide: VersusService, useValue: versusService },
        {
          provide: SocketAuthService,
          useValue: {
            authenticate: (socket: ServerSocket) =>
              Promise.resolve(
                (socket.handshake.auth as { token: string }).token,
              ),
          },
        },
      ],
    }).compile();

    moduleRef.get(VersusGateway).timing = {
      questionSeconds: 5,
      answerGraceMs: 0,
      maxReadyDelayMs: 2000,
      roundResultMs: 50,
    };

    app = moduleRef.createNestApplication();
    await app.listen(0);
    const { port } = (app.getHttpServer() as Server).address() as AddressInfo;
    url = `http://localhost:${port}`;
  });

  afterEach(async () => {
    sockets.splice(0).forEach((s) => s.disconnect());
    await app.close();
  });

  it('pairs two queued players and sends both the same question', async () => {
    const alice = await connect('alice');
    const bob = await connect('bob');
    const aliceMatched = next<MatchedPayload>(alice, VersusEvents.Matched);
    const bobMatched = next<MatchedPayload>(bob, VersusEvents.Matched);
    const aliceRound = next<RoundPayload>(alice, VersusEvents.Round);
    const bobRound = next<RoundPayload>(bob, VersusEvents.Round);

    await expect(
      emit(alice, VersusEvents.Queue, { category: 'dsa' }),
    ).resolves.toEqual({ ok: true, data: { status: 'searching' } });
    await expect(
      emit(bob, VersusEvents.Queue, { category: 'dsa' }),
    ).resolves.toEqual({ ok: true, data: { status: 'matched' } });

    const [a, b] = await Promise.all([aliceMatched, bobMatched]);
    expect(a.matchId).toBe(b.matchId);
    expect(a.you.uid).toBe('alice');
    expect(a.opponent.uid).toBe('bob');
    expect(b.you.uid).toBe('bob');

    const [roundA, roundB] = await Promise.all([aliceRound, bobRound]);
    expect(roundA).toEqual(roundB);
    expect(roundA.question.answers).toHaveLength(2);
    expect(roundA.question.answers).toEqual(
      expect.arrayContaining([
        { id: RIGHT, text: 'right' },
        { id: WRONG, text: 'wrong' },
      ]),
    );
  });

  it('does not match a player with themselves', async () => {
    const tab1 = await connect('alice');
    const tab2 = await connect('alice');
    const closed = next<{ reason: string }>(tab1, VersusEvents.LobbyClosed);

    await emit(tab1, VersusEvents.Queue, { category: 'dsa' });
    await expect(
      emit(tab2, VersusEvents.Queue, { category: 'dsa' }),
    ).resolves.toEqual({ ok: true, data: { status: 'searching' } });
    // The newer tab replaces the older one.
    await expect(closed).resolves.toEqual({
      reason: expect.any(String) as unknown,
    });
  });

  it('matches players through a private room', async () => {
    const alice = await connect('alice');
    const bob = await connect('bob');

    const created = await emit<{ code: string }>(
      alice,
      VersusEvents.CreateRoom,
      { category: 'dsa' },
    );
    if (!created.ok) throw new Error(created.error);
    expect(created.data.code).toMatch(/^[A-Z2-9]{6}$/);

    await expect(
      emit(alice, VersusEvents.JoinRoom, { code: created.data.code }),
    ).resolves.toEqual({ ok: false, error: "You can't join your own room" });

    const matched = next<MatchedPayload>(alice, VersusEvents.Matched);
    await expect(
      emit(bob, VersusEvents.JoinRoom, {
        code: created.data.code.toLowerCase(),
      }),
    ).resolves.toEqual({ ok: true, data: null });
    await expect(matched).resolves.toMatchObject({ category: 'dsa' });

    // The room is single-use.
    const carol = await connect('carol');
    await expect(
      emit(carol, VersusEvents.JoinRoom, { code: created.data.code }),
    ).resolves.toEqual({
      ok: false,
      error: 'No room with that code. It may have expired.',
    });
  });

  it('plays a match to a knockout', async () => {
    const { alice, bob } = await startMatch();
    await readyUp(alice, bob);

    const bobLockedOut = next(alice, VersusEvents.LockedOut);
    await expect(
      emit(bob, VersusEvents.Answer, { answerId: WRONG }),
    ).resolves.toEqual({ ok: true, data: { correct: false } });
    await expect(bobLockedOut).resolves.toMatchObject({
      uid: 'bob',
      lives: { alice: 2, bob: 1 },
    });

    const result = next<RoundResultPayload>(bob, VersusEvents.RoundResult);
    const over = next<MatchSummary>(bob, VersusEvents.MatchOver);
    await expect(
      emit(alice, VersusEvents.Answer, { answerId: RIGHT }),
    ).resolves.toEqual({ ok: true, data: { correct: true } });

    await expect(result).resolves.toMatchObject({
      attackerUid: 'alice',
      damage: 1,
      correctAnswerId: RIGHT,
      lives: { alice: 2, bob: 0 },
    });
    await expect(over).resolves.toMatchObject({
      reason: 'ko',
      winnerUid: 'alice',
      source: 'queue',
    });
    expect(versusService.saveMatch).toHaveBeenCalledTimes(1);

    // Both players can queue again once the match is over.
    await expect(
      emit(alice, VersusEvents.Queue, { category: 'dsa' }),
    ).resolves.toEqual({ ok: true, data: { status: 'searching' } });
  });

  it('gives the win to the remaining player when the other disconnects', async () => {
    const { alice, bob } = await startMatch();
    const over = next<MatchSummary>(alice, VersusEvents.MatchOver);

    bob.disconnect();

    await expect(over).resolves.toMatchObject({
      reason: 'forfeit',
      winnerUid: 'alice',
    });
  });

  it('forfeits when a player leaves', async () => {
    const { alice, bob } = await startMatch();
    const over = next<MatchSummary>(bob, VersusEvents.MatchOver);

    await emit(alice, VersusEvents.Leave);

    await expect(over).resolves.toMatchObject({
      reason: 'forfeit',
      winnerUid: 'bob',
    });
  });

  it('rejects queueing while already in a match', async () => {
    const { alice } = await startMatch();

    await expect(
      emit(alice, VersusEvents.Queue, { category: 'dsa' }),
    ).resolves.toEqual({ ok: false, error: 'You are already in a match' });
  });

  it('rejects answers outside a match and invalid payloads', async () => {
    const alice = await connect('alice');

    await expect(
      emit(alice, VersusEvents.Answer, { answerId: RIGHT }),
    ).resolves.toEqual({
      ok: false,
      error: 'No match is running on this connection',
    });
    await expect(
      emit(alice, VersusEvents.Queue, { category: '' }),
    ).resolves.toEqual({
      ok: false,
      error: expect.stringMatching(/^Invalid payload/) as unknown,
    });
    await expect(
      emit(alice, VersusEvents.JoinRoom, { code: 'nope' }),
    ).resolves.toEqual({
      ok: false,
      error: expect.stringMatching(/^Invalid payload/) as unknown,
    });
  });

  it('forwards lobby errors such as a missing hero', async () => {
    versusService.getFighter.mockRejectedValue(
      new SocketError('Pick a hero before playing 1v1'),
    );
    const alice = await connect('alice');

    await expect(
      emit(alice, VersusEvents.Queue, { category: 'dsa' }),
    ).resolves.toEqual({ ok: false, error: 'Pick a hero before playing 1v1' });
  });
});
