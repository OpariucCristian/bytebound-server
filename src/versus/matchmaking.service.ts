import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { randomInt } from 'crypto';
import { Socket } from 'socket.io';
import { SocketError } from '../common/socket-utils';
import {
  ROOM_CODE_ALPHABET,
  ROOM_CODE_LENGTH,
  ROOM_TTL_MS,
  VersusEvents,
} from './versus.constants';
import { Fighter } from './versus.types';

/** A player waiting for an opponent, in the queue or in a room. */
export interface LobbyEntry {
  uid: string;
  socket: Socket;
  category: string;
  fighter: Fighter;
}

interface Room {
  code: string;
  host: LobbyEntry;
  timer: NodeJS.Timeout;
}

/**
 * Pairs players, in memory (the server runs as a single instance): a FIFO
 * queue per category, and private rooms joined with a short code.
 *
 * A user can only wait in one place at a time. Waiting again, e.g. from a
 * second tab, replaces the earlier entry.
 */
@Injectable()
export class MatchmakingService implements OnModuleDestroy {
  private readonly queues = new Map<string, LobbyEntry[]>();
  private readonly rooms = new Map<string, Room>();

  /** Queues a player. Returns the opponent if one was already waiting. */
  enqueue(entry: LobbyEntry): LobbyEntry | undefined {
    this.replaceEntriesOf(entry);

    const queue = this.queues.get(entry.category) ?? [];
    const opponent = queue.shift();
    if (opponent) {
      this.setQueue(entry.category, queue);
      return opponent;
    }

    this.queues.set(entry.category, [...queue, entry]);
    return undefined;
  }

  /** Opens a private room and returns its code. */
  createRoom(entry: LobbyEntry, ttlMs = ROOM_TTL_MS): string {
    this.replaceEntriesOf(entry);

    let code: string;
    do {
      code = Array.from(
        { length: ROOM_CODE_LENGTH },
        () => ROOM_CODE_ALPHABET[randomInt(ROOM_CODE_ALPHABET.length)],
      ).join('');
    } while (this.rooms.has(code));

    const timer = setTimeout(() => {
      if (this.rooms.get(code)?.host === entry) {
        this.rooms.delete(code);
        entry.socket.emit(VersusEvents.LobbyClosed, {
          reason: 'The room expired. Create a new one to keep waiting.',
        });
      }
    }, ttlMs);

    this.rooms.set(code, { code, host: entry, timer });
    return code;
  }

  /** Joins a room and returns its host. The room is closed afterwards. */
  joinRoom(rawCode: string, entry: LobbyEntry): LobbyEntry {
    const code = rawCode.trim().toUpperCase();
    const room = this.rooms.get(code);

    if (!room) {
      throw new SocketError('No room with that code. It may have expired.');
    }
    if (room.host.uid === entry.uid) {
      throw new SocketError("You can't join your own room");
    }

    this.replaceEntriesOf(entry);
    this.closeRoom(room);
    return room.host;
  }

  /** Removes whatever this socket was waiting in. */
  removeSocket(socketId: string) {
    this.removeWhere((e) => e.socket.id === socketId);
  }

  /** Removes whatever this user was waiting in. */
  removeUser(uid: string) {
    this.removeWhere((e) => e.uid === uid);
  }

  isWaiting(socketId: string): boolean {
    const inQueue = [...this.queues.values()].some((q) =>
      q.some((e) => e.socket.id === socketId),
    );
    const inRoom = [...this.rooms.values()].some(
      (r) => r.host.socket.id === socketId,
    );
    return inQueue || inRoom;
  }

  onModuleDestroy() {
    this.rooms.forEach((room) => clearTimeout(room.timer));
    this.rooms.clear();
    this.queues.clear();
  }

  /** Drops the user's earlier entries and tells their other tabs. */
  private replaceEntriesOf(entry: LobbyEntry) {
    const removed = this.removeWhere((e) => e.uid === entry.uid);
    removed
      .filter((e) => e.socket.id !== entry.socket.id)
      .forEach((e) =>
        e.socket.emit(VersusEvents.LobbyClosed, {
          reason: 'You started looking for a match somewhere else.',
        }),
      );
  }

  private removeWhere(predicate: (e: LobbyEntry) => boolean): LobbyEntry[] {
    const removed: LobbyEntry[] = [];

    for (const [category, queue] of this.queues) {
      const kept = queue.filter((e) => {
        if (!predicate(e)) return true;
        removed.push(e);
        return false;
      });
      this.setQueue(category, kept);
    }

    for (const room of [...this.rooms.values()]) {
      if (predicate(room.host)) {
        removed.push(room.host);
        this.closeRoom(room);
      }
    }
    return removed;
  }

  private closeRoom(room: Room) {
    clearTimeout(room.timer);
    this.rooms.delete(room.code);
  }

  private setQueue(category: string, queue: LobbyEntry[]) {
    if (queue.length > 0) this.queues.set(category, queue);
    else this.queues.delete(category);
  }
}
