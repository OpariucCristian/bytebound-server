import { SocketError } from '../common/socket-utils';
import { shuffle } from '../utils/utils';
import {
  DEFAULT_TIMING,
  VersusEvents,
  VersusRules,
  VersusTiming,
} from './versus.constants';
import {
  AnswerAck,
  Fighter,
  LivesByUid,
  LockedOutPayload,
  MatchEndReason,
  MatchedPayload,
  MatchSource,
  MatchSummary,
  RoundPayload,
  RoundResultPayload,
  RoundStartPayload,
  VersusQuestion,
} from './versus.types';

export interface VersusMatchDeps {
  pickQuestion(
    category: string,
    difficulty: number,
    excludeIds: string[],
  ): Promise<VersusQuestion>;
  /** Sends an event to one player, or to both when `toUid` is omitted. */
  emit(event: string, payload: unknown, toUid?: string): void;
  /** Stores the result and awards XP. Not called for matches that errored. */
  persist(summary: MatchSummary): Promise<void>;
  /** Called once, after `match_over` was sent. */
  onEnded(summary: MatchSummary): void;
  onError(message: string, err: unknown): void;
}

export interface VersusMatchOptions {
  id: string;
  category: string;
  source: MatchSource;
  fighters: [Fighter, Fighter];
  deps: VersusMatchDeps;
  timing?: Partial<VersusTiming>;
}

interface Side {
  fighter: Fighter;
  lives: number;
  correct: number;
  wrong: number;
}

interface Round {
  number: number;
  difficulty: number;
  question: VersusQuestion;
  ready: Set<string>;
  lockedOut: Set<string>;
  startedAt?: number;
  resolved: boolean;
}

export const difficultyForRound = (round: number): number =>
  Math.min(
    VersusRules.maxDifficulty,
    1 + Math.floor((round - 1) / VersusRules.roundsPerDifficulty),
  );

/**
 * The server-side state of one running 1v1 match. It lives only in memory;
 * the result is persisted once the match ends.
 *
 * Every action goes through a queue, so two answers, or an answer and a
 * timeout, never apply at the same time.
 */
export class VersusMatch {
  readonly id: string;
  readonly category: string;
  readonly source: MatchSource;

  private readonly deps: VersusMatchDeps;
  private readonly timing: VersusTiming;
  private readonly sides = new Map<string, Side>();
  private readonly askedIds: string[] = [];
  private round?: Round;
  private roundNumber = 0;
  private idleRounds = 0;
  private finished = false;
  private timer?: NodeJS.Timeout;
  private queue: Promise<unknown> = Promise.resolve();

  constructor(options: VersusMatchOptions) {
    this.id = options.id;
    this.category = options.category;
    this.source = options.source;
    this.deps = options.deps;
    this.timing = { ...DEFAULT_TIMING, ...options.timing };

    for (const fighter of options.fighters) {
      this.sides.set(fighter.uid, {
        fighter,
        lives: fighter.hero.baseHealth,
        correct: 0,
        wrong: 0,
      });
    }
  }

  get isFinished(): boolean {
    return this.finished;
  }

  get playerUids(): string[] {
    return [...this.sides.keys()];
  }

  /** The `matched` payload as one of the players sees it. */
  matchedPayloadFor(uid: string): MatchedPayload {
    return {
      matchId: this.id,
      category: this.category,
      you: this.side(uid).fighter,
      opponent: this.side(this.opponentOf(uid)).fighter,
    };
  }

  start(): Promise<void> {
    return this.run(() => this.nextRound()).catch((err: unknown) =>
      this.fail(err),
    );
  }

  ready(uid: string): Promise<void> {
    return this.run(() => {
      this.side(uid);
      const round = this.round;
      if (!round || round.resolved || round.startedAt) return;

      round.ready.add(uid);
      if (round.ready.size === this.sides.size) this.startClock();
    });
  }

  answer(uid: string, answerId: string): Promise<AnswerAck> {
    return this.run(() => this.applyAnswer(uid, answerId));
  }

  /** The player gives up (left the match or disconnected). */
  forfeit(uid: string): Promise<void> {
    return this.run(async () => {
      if (this.finished) return;
      await this.finish(this.opponentOf(uid), 'forfeit', uid);
    });
  }

  /** Stops timers without ending the match (e.g. on shutdown). */
  dispose() {
    this.clearTimer();
    this.finished = true;
  }

  private async nextRound() {
    if (this.finished) return;

    this.roundNumber += 1;
    const difficulty = difficultyForRound(this.roundNumber);
    const question = await this.deps.pickQuestion(this.category, difficulty, [
      ...this.askedIds,
    ]);
    if (this.finished) return;
    this.askedIds.push(question.id);

    this.round = {
      number: this.roundNumber,
      difficulty,
      question,
      ready: new Set(),
      lockedOut: new Set(),
      resolved: false,
    };

    const payload: RoundPayload = {
      round: this.roundNumber,
      difficulty,
      seconds: this.timing.questionSeconds,
      question: {
        id: question.id,
        text: question.text,
        // Answers are stored correct-first, so shuffle them per round.
        answers: shuffle(question.answers).map((a) => ({
          id: a.id,
          text: a.text,
        })),
      },
    };
    this.deps.emit(VersusEvents.Round, payload);

    // A client can't hold the match back by never reporting ready.
    this.schedule(this.timing.maxReadyDelayMs, () => this.startClock());
  }

  private startClock() {
    const round = this.round;
    if (!round || round.resolved || round.startedAt) return;

    round.startedAt = Date.now();
    const payload: RoundStartPayload = {
      round: round.number,
      endsAt: round.startedAt + this.timing.questionSeconds * 1000,
    };
    this.deps.emit(VersusEvents.RoundStart, payload);

    this.schedule(
      this.timing.questionSeconds * 1000 + this.timing.answerGraceMs,
      () => this.resolveRound(null, 'timeout'),
    );
  }

  private async applyAnswer(uid: string, answerId: string): Promise<AnswerAck> {
    const side = this.side(uid);
    const round = this.round;

    if (this.finished) throw new SocketError('The match is over');
    if (!round || round.resolved) throw new SocketError('The round is over');
    if (!round.startedAt) {
      throw new SocketError('The round has not started yet');
    }
    if (round.lockedOut.has(uid)) {
      throw new SocketError('You already answered this round');
    }

    const answer = round.question.answers.find((a) => a.id === answerId);
    if (!answer) {
      throw new SocketError(
        'The answer does not belong to the current question',
      );
    }

    if (answer.isCorrect) {
      side.correct += 1;
      await this.resolveRound(uid, 'correct');
      return { correct: true };
    }

    side.wrong += 1;
    side.lives = Math.max(0, side.lives - VersusRules.wrongAnswerDamage);
    round.lockedOut.add(uid);

    const payload: LockedOutPayload = {
      round: round.number,
      uid,
      lives: this.lives(),
    };
    this.deps.emit(VersusEvents.LockedOut, payload);

    if (side.lives === 0 || round.lockedOut.size === this.sides.size) {
      await this.resolveRound(null, 'all_wrong');
    }
    return { correct: false };
  }

  private async resolveRound(
    attackerUid: string | null,
    reason: RoundResultPayload['reason'],
  ) {
    const round = this.round;
    if (!round || round.resolved || this.finished) return;

    round.resolved = true;
    this.clearTimer();

    let damage = 0;
    if (attackerUid) {
      const defender = this.side(this.opponentOf(attackerUid));
      damage = this.side(attackerUid).fighter.hero.baseAttack;
      defender.lives = Math.max(0, defender.lives - damage);
    }

    const idle = reason === 'timeout' && round.lockedOut.size === 0;
    this.idleRounds = idle ? this.idleRounds + 1 : 0;

    const payload: RoundResultPayload = {
      round: round.number,
      attackerUid,
      damage,
      reason,
      correctAnswerId:
        round.question.answers.find((a) => a.isCorrect)?.id ?? null,
      lives: this.lives(),
    };
    this.deps.emit(VersusEvents.RoundResult, payload);

    const knockedOut = [...this.sides.values()].filter((s) => s.lives === 0);
    if (knockedOut.length === 1) {
      await this.finish(this.opponentOf(knockedOut[0].fighter.uid), 'ko');
    } else if (knockedOut.length > 1) {
      await this.finish(this.tiebreakWinner(), 'ko');
    } else if (this.idleRounds >= VersusRules.idleRoundsLimit) {
      await this.finish(null, 'idle');
    } else {
      this.schedule(this.timing.roundResultMs, () => this.nextRound());
    }
  }

  /** Both players are down in the same round: most correct answers wins. */
  private tiebreakWinner(): string | null {
    const [a, b] = [...this.sides.values()];
    if (a.correct === b.correct) return null;
    return a.correct > b.correct ? a.fighter.uid : b.fighter.uid;
  }

  private async finish(
    winnerUid: string | null,
    reason: MatchEndReason,
    forfeitedUid?: string,
  ) {
    if (this.finished) return;
    this.finished = true;
    this.clearTimer();

    const endReason: MatchEndReason =
      winnerUid === null && reason === 'ko' ? 'draw' : reason;

    const summary: MatchSummary = {
      matchId: this.id,
      category: this.category,
      source: this.source,
      reason: endReason,
      winnerUid,
      rounds: this.roundNumber,
      players: [...this.sides.values()].map((side) => {
        const uid = side.fighter.uid;
        const result = winnerUid
          ? uid === winnerUid
            ? 'win'
            : 'loss'
          : 'draw';

        let xpGained = side.correct * VersusRules.xpPerCorrect;
        if (result === 'win') xpGained += VersusRules.winXpBonus;
        if (endReason === 'draw') xpGained += VersusRules.drawXpBonus;
        // Quitting a match earns nothing.
        if (uid === forfeitedUid || endReason === 'error') xpGained = 0;

        return {
          uid,
          userName: side.fighter.userName,
          heroId: side.fighter.hero.id,
          livesLeft: side.lives,
          correctAnswers: side.correct,
          wrongAnswers: side.wrong,
          xpGained,
          result,
        };
      }),
    };

    if (endReason !== 'error') {
      try {
        await this.deps.persist(summary);
      } catch (err) {
        this.deps.onError(`Failed to save match ${this.id}`, err);
      }
    }

    this.deps.emit(VersusEvents.MatchOver, summary);
    this.deps.onEnded(summary);
  }

  private schedule(ms: number, action: () => void | Promise<void>) {
    this.clearTimer();
    this.timer = setTimeout(
      () => {
        this.timer = undefined;
        this.run(action).catch((err: unknown) => this.fail(err));
      },
      Math.max(ms, 0),
    );
  }

  /** Ends the match without a winner after an unexpected error. */
  private fail(err: unknown): Promise<void> {
    this.deps.onError(`Match ${this.id} failed`, err);
    return this.run(() => this.finish(null, 'error'));
  }

  private clearTimer() {
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = undefined;
    }
  }

  private run<T>(action: () => T | Promise<T>): Promise<T> {
    const result = this.queue.then(action);
    this.queue = result.catch(() => undefined);
    return result;
  }

  private lives(): LivesByUid {
    const lives: LivesByUid = {};
    for (const [uid, side] of this.sides) lives[uid] = side.lives;
    return lives;
  }

  private side(uid: string): Side {
    const side = this.sides.get(uid);
    if (!side) throw new SocketError('You are not in this match');
    return side;
  }

  private opponentOf(uid: string): string {
    const opponent = this.playerUids.find((u) => u !== uid);
    if (!opponent) throw new SocketError('You are not in this match');
    return opponent;
  }
}
