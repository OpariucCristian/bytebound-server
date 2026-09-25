import { difficultyForRound, VersusMatch } from './versus-match';
import { VersusEvents } from './versus.constants';
import {
  Fighter,
  MatchSummary,
  RoundPayload,
  RoundResultPayload,
  VersusQuestion,
} from './versus.types';

const fighter = (uid: string, baseHealth: number, baseAttack: number) =>
  ({
    uid,
    userName: uid,
    lvl: 1,
    hero: {
      id: `hero-${uid}`,
      name: 'Hero',
      spriteKey: 'hero_knight',
      baseHealth,
      baseAttack,
    },
  }) satisfies Fighter;

let questionCount = 0;
const makeQuestion = (): VersusQuestion => {
  questionCount += 1;
  return {
    id: `q${questionCount}`,
    text: `Question ${questionCount}`,
    answers: [
      { id: `q${questionCount}-right`, text: 'right', isCorrect: true },
      { id: `q${questionCount}-wrong`, text: 'wrong', isCorrect: false },
    ],
  };
};

const tick = (ms = 0) => new Promise((r) => setTimeout(r, ms));

describe('VersusMatch', () => {
  let events: { event: string; payload: unknown; to?: string }[];
  let persisted: MatchSummary[];
  let ended: jest.Mock;
  let pickQuestion: jest.Mock;
  let match: VersusMatch;

  const create = (
    a = fighter('alice', 3, 2),
    b = fighter('bob', 5, 1),
    questionSeconds = 5,
  ) => {
    match = new VersusMatch({
      id: 'match-1',
      category: 'dsa',
      source: 'queue',
      fighters: [a, b],
      timing: {
        questionSeconds,
        answerGraceMs: 0,
        maxReadyDelayMs: 1000,
        roundResultMs: 10,
      },
      deps: {
        pickQuestion,
        emit: (event, payload, to) => events.push({ event, payload, to }),
        persist: (summary) => {
          persisted.push(summary);
          return Promise.resolve();
        },
        onEnded: ended,
        onError: jest.fn(),
      },
    });
    return match;
  };

  const lastOf = <T>(event: string) =>
    [...events].reverse().find((e) => e.event === event)?.payload as T;

  const currentRound = () => lastOf<RoundPayload>(VersusEvents.Round);
  const right = () => `${currentRound().question.id}-right`;
  const wrong = () => `${currentRound().question.id}-wrong`;

  /** Starts the next round's clock by having both players report ready. */
  const readyUp = async () => {
    await match.ready('alice');
    await match.ready('bob');
  };

  beforeEach(() => {
    events = [];
    persisted = [];
    ended = jest.fn();
    pickQuestion = jest
      .fn()
      .mockImplementation(() => Promise.resolve(makeQuestion()));
  });

  afterEach(() => match?.dispose());

  it('raises the difficulty every four rounds, up to 5', () => {
    expect([1, 4, 5, 8, 9, 17, 40].map(difficultyForRound)).toEqual([
      1, 1, 2, 2, 3, 5, 5,
    ]);
  });

  it('sends the question without the correct answer', async () => {
    await create().start();

    const round = currentRound();
    expect(round).toMatchObject({ round: 1, difficulty: 1, seconds: 5 });
    expect(round.question.answers).toEqual([
      { id: expect.any(String) as unknown, text: 'right' },
      { id: expect.any(String) as unknown, text: 'wrong' },
    ]);
    expect(pickQuestion).toHaveBeenCalledWith('dsa', 1, []);
  });

  it('starts the clock only once both players are ready', async () => {
    await create().start();

    await match.ready('alice');
    expect(lastOf(VersusEvents.RoundStart)).toBeUndefined();
    await expect(match.answer('alice', right())).rejects.toThrow(
      'The round has not started yet',
    );

    await match.ready('bob');
    expect(lastOf(VersusEvents.RoundStart)).toEqual({
      round: 1,
      endsAt: expect.any(Number) as unknown,
    });
  });

  it('lets the first correct answer attack the opponent', async () => {
    await create().start();
    await readyUp();

    await expect(match.answer('alice', right())).resolves.toEqual({
      correct: true,
    });

    expect(lastOf<RoundResultPayload>(VersusEvents.RoundResult)).toEqual({
      round: 1,
      attackerUid: 'alice',
      damage: 2,
      reason: 'correct',
      correctAnswerId: right(),
      lives: { alice: 3, bob: 3 },
    });
    // The round is over for the slower player.
    await expect(match.answer('bob', right())).rejects.toThrow(
      'The round is over',
    );
  });

  it('locks out and hurts a player who answers wrong', async () => {
    await create().start();
    await readyUp();

    await expect(match.answer('bob', wrong())).resolves.toEqual({
      correct: false,
    });
    expect(lastOf(VersusEvents.LockedOut)).toEqual({
      round: 1,
      uid: 'bob',
      lives: { alice: 3, bob: 4 },
    });
    await expect(match.answer('bob', right())).rejects.toThrow(
      'You already answered this round',
    );

    // The other player can still take the round.
    await match.answer('alice', right());
    expect(lastOf<RoundResultPayload>(VersusEvents.RoundResult)).toMatchObject({
      attackerUid: 'alice',
      lives: { alice: 3, bob: 2 },
    });
  });

  it('ends the round when both players answer wrong', async () => {
    await create().start();
    await readyUp();

    await match.answer('alice', wrong());
    await match.answer('bob', wrong());

    expect(lastOf<RoundResultPayload>(VersusEvents.RoundResult)).toMatchObject({
      attackerUid: null,
      reason: 'all_wrong',
      lives: { alice: 2, bob: 4 },
    });
  });

  it('rejects answers from another question', async () => {
    await create().start();
    await readyUp();

    await expect(match.answer('alice', 'other-answer')).rejects.toThrow(
      'The answer does not belong to the current question',
    );
  });

  it('times out a round nobody answers and moves on', async () => {
    await create(undefined, undefined, 0.05).start();
    await readyUp();
    await tick(120);

    expect(lastOf<RoundResultPayload>(VersusEvents.RoundResult)).toMatchObject({
      round: 1,
      attackerUid: null,
      reason: 'timeout',
      lives: { alice: 3, bob: 5 },
    });
    expect(currentRound().round).toBe(2);
    expect(pickQuestion).toHaveBeenLastCalledWith('dsa', 1, [
      'q' + (questionCount - 1),
    ]);
  });

  it('knocks out a player and awards XP', async () => {
    await create(fighter('alice', 3, 2), fighter('bob', 2, 1)).start();
    await readyUp();

    await match.answer('bob', wrong());
    await match.answer('alice', right());

    const summary = lastOf<MatchSummary>(VersusEvents.MatchOver);
    expect(summary).toMatchObject({
      matchId: 'match-1',
      reason: 'ko',
      winnerUid: 'alice',
      rounds: 1,
    });
    expect(summary.players).toEqual([
      expect.objectContaining({
        uid: 'alice',
        result: 'win',
        correctAnswers: 1,
        xpGained: 75 + 150,
      }),
      expect.objectContaining({
        uid: 'bob',
        result: 'loss',
        livesLeft: 0,
        wrongAnswers: 1,
        xpGained: 0,
      }),
    ]);
    expect(persisted).toEqual([summary]);
    expect(ended).toHaveBeenCalledWith(summary);
    expect(match.isFinished).toBe(true);
  });

  it('loses the match when a wrong answer costs the last life', async () => {
    await create(fighter('alice', 1, 1), fighter('bob', 5, 1)).start();
    await readyUp();

    await match.answer('alice', wrong());

    expect(lastOf<MatchSummary>(VersusEvents.MatchOver)).toMatchObject({
      reason: 'ko',
      winnerUid: 'bob',
    });
  });

  it('gives the win to the opponent of a player who forfeits', async () => {
    await create().start();
    await readyUp();
    await match.answer('alice', right());

    await match.forfeit('alice');

    const summary = lastOf<MatchSummary>(VersusEvents.MatchOver);
    expect(summary).toMatchObject({ reason: 'forfeit', winnerUid: 'bob' });
    // Quitting forfeits the XP of the correct answers too.
    expect(summary.players.find((p) => p.uid === 'alice')?.xpGained).toBe(0);
    expect(summary.players.find((p) => p.uid === 'bob')?.xpGained).toBe(150);

    // Forfeiting twice (leave, then disconnect) changes nothing.
    await match.forfeit('alice');
    expect(ended).toHaveBeenCalledTimes(1);
  });

  it('ends as a draw after three rounds nobody answers', async () => {
    await create(undefined, undefined, 0.02).start();
    for (let i = 0; i < 3; i++) {
      await readyUp();
      await tick(60);
    }

    const summary = lastOf<MatchSummary>(VersusEvents.MatchOver);
    expect(summary).toMatchObject({ reason: 'idle', winnerUid: null });
    expect(summary.players.map((p) => [p.result, p.xpGained])).toEqual([
      ['draw', 0],
      ['draw', 0],
    ]);
  });

  it('ends the match without saving it if no question can be found', async () => {
    pickQuestion.mockRejectedValue(new Error('db down'));
    await create().start();

    expect(lastOf<MatchSummary>(VersusEvents.MatchOver)).toMatchObject({
      reason: 'error',
      winnerUid: null,
    });
    expect(persisted).toEqual([]);
  });
});
