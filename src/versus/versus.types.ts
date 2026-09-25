/** Everything a match needs to know about one player. */
export interface Fighter {
  uid: string;
  userName: string;
  lvl: number;
  hero: {
    id: string;
    name: string | null;
    spriteKey: string | null;
    baseHealth: number;
    baseAttack: number;
  };
}

export interface VersusQuestion {
  id: string;
  text: string | null;
  answers: { id: string; text: string | null; isCorrect: boolean }[];
}

export type MatchSource = 'queue' | 'room';
export type MatchEndReason = 'ko' | 'forfeit' | 'draw' | 'idle' | 'error';
export type MatchResult = 'win' | 'loss' | 'draw';

export interface MatchedPayload {
  matchId: string;
  category: string;
  you: Fighter;
  opponent: Fighter;
}

export interface RoundPayload {
  round: number;
  difficulty: number;
  seconds: number;
  question: {
    id: string;
    text: string | null;
    answers: { id: string; text: string | null }[];
  };
}

export interface RoundStartPayload {
  round: number;
  /** Epoch ms when answers stop being accepted (without the grace period). */
  endsAt: number;
}

export type LivesByUid = Record<string, number>;

export interface LockedOutPayload {
  round: number;
  uid: string;
  lives: LivesByUid;
}

export interface RoundResultPayload {
  round: number;
  /** Who answered correctly first, if anyone. */
  attackerUid: string | null;
  damage: number;
  reason: 'correct' | 'timeout' | 'all_wrong';
  correctAnswerId: string | null;
  lives: LivesByUid;
}

export interface MatchPlayerSummary {
  uid: string;
  userName: string;
  heroId: string;
  livesLeft: number;
  correctAnswers: number;
  wrongAnswers: number;
  xpGained: number;
  result: MatchResult;
}

export interface MatchSummary {
  matchId: string;
  category: string;
  source: MatchSource;
  reason: MatchEndReason;
  winnerUid: string | null;
  rounds: number;
  players: MatchPlayerSummary[];
}

export interface AnswerAck {
  correct: boolean;
}
