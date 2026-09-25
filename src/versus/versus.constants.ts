/**
 * Socket.IO protocol for 1v1 matches (namespace `/versus`). Versus is a
 * "speed buzzer" variant of Endless: both players get the same question and
 * the first correct answer attacks the opponent.
 *
 * Client -> server (every event is acknowledged with an `Ack`):
 *   `versus:queue`        {category}   -> {status: 'searching' | 'matched'}
 *   `versus:cancel_queue` (none)       -> null
 *   `versus:create_room`  {category}   -> {code}
 *   `versus:join_room`    {code}       -> null
 *   `versus:ready`        (none)       -> null   round received, ready to play
 *   `versus:answer`       {answerId}   -> {correct}
 *   `versus:leave`        (none)       -> null   forfeits a running match
 *
 * Server -> client:
 *   `versus:matched`      MatchedPayload     an opponent was found
 *   `versus:round`        RoundPayload       the next question (not shown yet)
 *   `versus:round_start`  RoundStartPayload  both players are ready, show it
 *   `versus:locked_out`   LockedOutPayload   a player answered wrong
 *   `versus:round_result` RoundResultPayload
 *   `versus:match_over`   MatchSummary
 *   `versus:lobby_closed` {reason}           the queue entry or room is gone
 */
export const VersusEvents = {
  Queue: 'versus:queue',
  CancelQueue: 'versus:cancel_queue',
  CreateRoom: 'versus:create_room',
  JoinRoom: 'versus:join_room',
  Ready: 'versus:ready',
  Answer: 'versus:answer',
  Leave: 'versus:leave',

  Matched: 'versus:matched',
  Round: 'versus:round',
  RoundStart: 'versus:round_start',
  LockedOut: 'versus:locked_out',
  RoundResult: 'versus:round_result',
  MatchOver: 'versus:match_over',
  LobbyClosed: 'versus:lobby_closed',
} as const;

export interface VersusTiming {
  questionSeconds: number;
  /** Extra time allowed past the countdown, to absorb latency. */
  answerGraceMs: number;
  /** How long to wait for both players to be ready before starting anyway. */
  maxReadyDelayMs: number;
  /** Pause after a round so both clients can play the attack animation. */
  roundResultMs: number;
}

export const DEFAULT_TIMING: VersusTiming = {
  questionSeconds: 15,
  answerGraceMs: 1000,
  maxReadyDelayMs: 8000,
  roundResultMs: 2500,
};

export const VersusRules = {
  /** Difficulty goes up by one every this many rounds. */
  roundsPerDifficulty: 4,
  maxDifficulty: 5,
  /** Lives a wrong answer costs the player who gave it. */
  wrongAnswerDamage: 1,
  /** Rounds in a row nobody answers before the match ends as a draw. */
  idleRoundsLimit: 3,
  xpPerCorrect: 75,
  winXpBonus: 150,
  drawXpBonus: 50,
} as const;

/** Private rooms expire if nobody joins within this time. */
export const ROOM_TTL_MS = 10 * 60 * 1000;
export const ROOM_CODE_LENGTH = 6;
/** No 0/O or 1/I, so codes are easy to read out loud. */
export const ROOM_CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
