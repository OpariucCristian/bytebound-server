import { Logger, OnModuleDestroy } from '@nestjs/common';
import {
  ConnectedSocket,
  MessageBody,
  OnGatewayDisconnect,
  OnGatewayInit,
  SubscribeMessage,
  WebSocketGateway,
} from '@nestjs/websockets';
import { Namespace, Socket } from 'socket.io';
import { randomUUID } from 'crypto';
import { SocketAuthService } from '../auth/socket-auth.service';
import {
  Ack,
  parsePayload,
  SocketError,
  toSocketErrorMessage,
} from '../common/socket-utils';
import { SubmitAnswerDto } from '../games/dto/game.dto';
import { JoinRoomDto, VersusCategoryDto } from './dto/versus.dto';
import { LobbyEntry, MatchmakingService } from './matchmaking.service';
import { VersusMatch } from './versus-match';
import { VersusService } from './versus.service';
import { VersusEvents, VersusTiming } from './versus.constants';
import { AnswerAck, MatchSource } from './versus.types';

interface ActiveMatch {
  match: VersusMatch;
  sockets: Map<string, Socket>;
}

const roomOf = (matchId: string) => `match:${matchId}`;

/** 1v1 matches. The protocol is described in `versus.constants.ts`. */
@WebSocketGateway({ namespace: '/versus' })
export class VersusGateway
  implements OnGatewayInit, OnGatewayDisconnect, OnModuleDestroy
{
  private readonly logger = new Logger(VersusGateway.name);
  private namespace?: Namespace;
  /** Running matches by the uid of each of their players. */
  private readonly matchesByUid = new Map<string, ActiveMatch>();
  /** Overrides the match clock (tests use a short one). */
  timing?: Partial<VersusTiming>;

  constructor(
    private readonly socketAuth: SocketAuthService,
    private readonly versusService: VersusService,
    private readonly matchmaking: MatchmakingService,
  ) {}

  afterInit(namespace: Namespace) {
    this.namespace = namespace;
    namespace.use((socket, next) => {
      this.socketAuth
        .authenticate(socket)
        .then((uid) => {
          socket.data = { uid };
          next();
        })
        .catch((err: Error) => {
          this.logger.warn(`WS auth failed: ${err.message}`);
          next(new Error('Unauthorized'));
        });
    });
  }

  handleDisconnect(client: Socket) {
    this.matchmaking.removeSocket(client.id);

    const active = this.activeMatchOfSocket(client);
    if (active) {
      void active.match.forfeit(this.uidOf(client));
    }
  }

  onModuleDestroy() {
    new Set(this.matchesByUid.values()).forEach((a) => a.match.dispose());
    this.matchesByUid.clear();
  }

  @SubscribeMessage(VersusEvents.Queue)
  handleQueue(
    @ConnectedSocket() client: Socket,
    @MessageBody() body: unknown,
  ): Promise<Ack<{ status: 'searching' | 'matched' }>> {
    return this.ack(async () => {
      const { category } = await parsePayload(VersusCategoryDto, body);
      const entry = await this.lobbyEntry(client, category);

      const opponent = this.matchmaking.enqueue(entry);
      if (!opponent) return { status: 'searching' as const };

      await this.startMatch(opponent, entry, 'queue');
      return { status: 'matched' as const };
    });
  }

  @SubscribeMessage(VersusEvents.CancelQueue)
  handleCancelQueue(@ConnectedSocket() client: Socket): Promise<Ack<null>> {
    return this.ack(() => {
      this.matchmaking.removeSocket(client.id);
      return Promise.resolve(null);
    });
  }

  @SubscribeMessage(VersusEvents.CreateRoom)
  handleCreateRoom(
    @ConnectedSocket() client: Socket,
    @MessageBody() body: unknown,
  ): Promise<Ack<{ code: string }>> {
    return this.ack(async () => {
      const { category } = await parsePayload(VersusCategoryDto, body);
      const entry = await this.lobbyEntry(client, category);
      return { code: this.matchmaking.createRoom(entry) };
    });
  }

  @SubscribeMessage(VersusEvents.JoinRoom)
  handleJoinRoom(
    @ConnectedSocket() client: Socket,
    @MessageBody() body: unknown,
  ): Promise<Ack<null>> {
    return this.ack(async () => {
      const { code } = await parsePayload(JoinRoomDto, body);
      // The room decides the category.
      const entry = await this.lobbyEntry(client, null);
      const host = this.matchmaking.joinRoom(code, entry);
      await this.startMatch(
        host,
        { ...entry, category: host.category },
        'room',
      );
      return null;
    });
  }

  @SubscribeMessage(VersusEvents.Ready)
  handleReady(@ConnectedSocket() client: Socket): Promise<Ack<null>> {
    return this.ack(async () => {
      await this.requireMatch(client).ready(this.uidOf(client));
      return null;
    });
  }

  @SubscribeMessage(VersusEvents.Answer)
  handleAnswer(
    @ConnectedSocket() client: Socket,
    @MessageBody() body: unknown,
  ): Promise<Ack<AnswerAck>> {
    return this.ack(async () => {
      const match = this.requireMatch(client);
      const { answerId } = await parsePayload(SubmitAnswerDto, body);
      return match.answer(this.uidOf(client), answerId);
    });
  }

  @SubscribeMessage(VersusEvents.Leave)
  handleLeave(@ConnectedSocket() client: Socket): Promise<Ack<null>> {
    return this.ack(async () => {
      this.matchmaking.removeSocket(client.id);
      const active = this.activeMatchOfSocket(client);
      if (active) await active.match.forfeit(this.uidOf(client));
      return null;
    });
  }

  private async lobbyEntry(
    client: Socket,
    category: string | null,
  ): Promise<LobbyEntry> {
    const uid = this.uidOf(client);
    if (this.matchesByUid.has(uid)) {
      throw new SocketError('You are already in a match');
    }
    if (category) {
      await this.versusService.assertCategoryPlayable(category);
    }
    const fighter = await this.versusService.getFighter(uid);
    return { uid, socket: client, category: category ?? '', fighter };
  }

  private async startMatch(a: LobbyEntry, b: LobbyEntry, source: MatchSource) {
    const id = randomUUID();
    const room = roomOf(id);
    const sockets = new Map([
      [a.uid, a.socket],
      [b.uid, b.socket],
    ]);

    const match = new VersusMatch({
      id,
      category: a.category,
      source,
      fighters: [a.fighter, b.fighter],
      timing: this.timing,
      deps: {
        pickQuestion: (category, difficulty, excludeIds) =>
          this.versusService.pickQuestion(category, difficulty, excludeIds),
        emit: (event, payload, toUid) => {
          if (toUid) sockets.get(toUid)?.emit(event, payload);
          else this.namespace?.to(room).emit(event, payload);
        },
        persist: (summary) => this.versusService.saveMatch(summary),
        onEnded: () => {
          sockets.forEach((socket, uid) => {
            void socket.leave(room);
            if (this.matchesByUid.get(uid)?.match === match) {
              this.matchesByUid.delete(uid);
            }
          });
        },
        onError: (message, err) => this.logger.error(message, err),
      },
    });

    const active: ActiveMatch = { match, sockets };
    for (const [uid, socket] of sockets) {
      this.matchesByUid.set(uid, active);
      await socket.join(room);
      socket.emit(VersusEvents.Matched, match.matchedPayloadFor(uid));
    }

    // A player may have disconnected while the match was being set up.
    const gone = [...sockets.entries()].find(([, s]) => s.disconnected);
    if (gone) {
      await match.forfeit(gone[0]);
      return;
    }

    this.logger.log(`Versus match ${id} started (${source})`);
    void match.start();
  }

  /** The match this socket plays in (not another tab of the same user). */
  private activeMatchOfSocket(client: Socket): ActiveMatch | undefined {
    const active = this.matchesByUid.get(this.uidOf(client));
    return active?.sockets.get(this.uidOf(client)) === client
      ? active
      : undefined;
  }

  private requireMatch(client: Socket): VersusMatch {
    const active = this.activeMatchOfSocket(client);
    if (!active) {
      throw new SocketError('No match is running on this connection');
    }
    return active.match;
  }

  private uidOf(client: Socket): string {
    return (client.data as { uid: string }).uid;
  }

  private ack<T>(action: () => Promise<T>): Promise<Ack<T>> {
    return action().then(
      (data): Ack<T> => ({ ok: true, data }),
      (err: unknown): Ack<T> => ({
        ok: false,
        error: toSocketErrorMessage(err, this.logger),
      }),
    );
  }
}
