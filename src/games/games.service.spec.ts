import { BadRequestException } from '@nestjs/common';
import { GamesService } from './games.service';
import { GameState } from './enums/game-state.enum';
import { SkillEffect } from '../heroes/enums/skill-effect.enum';

// ESM-only / heavy dependencies; the service gets fakes below anyway.
jest.mock('uuid', () => ({ v4: () => 'new-game-id' }));
jest.mock('../players/players.service', () => ({ PlayersService: class {} }));
jest.mock('../questions/questions.service', () => ({
  QuestionsService: class {},
}));

const USER = 'user-1';
const GAME_ID = 'game-1';
const HERO_ID = 'hero-knight';
const ANSWER_ID = 'answer-1';

const SHIELDS_UP = {
  id: 'skill-shields',
  key: 'shields_up',
  name: 'Shields Up',
  description: null,
  heroId: HERO_ID,
  effectType: SkillEffect.BlockWrongAnswerDamage,
  unlockAtLvl: 1,
};
const LATE_SKILL = { ...SHIELDS_UP, id: 'skill-late', unlockAtLvl: 5 };
const SKILLS = [SHIELDS_UP, LATE_SKILL];

type Where = { where: { id?: string; heroId?: string } };

const makeGame = () => ({
  id: GAME_ID,
  playerId: USER,
  gameState: GameState.Active,
  isCurrentQuestionAnswered: false,
  currentQuestionId: 'q1',
  currentQuestionTimestamp: new Date(),
  questionSeconds: 15,
  playerLives: 3,
  enemyLives: 3,
  usedSkillIds: [] as string[],
  activeSkillId: null as string | null,
  enemyNavigation: { baseAttack: 1 },
  gameStats: {
    xpGained: 0,
    correctAnswers: 0,
    correctAnswersStreak: 2,
    correctAnswersStreakMax: 0,
    wrongAnswers: 0,
  },
});

describe('GamesService skills', () => {
  let service: GamesService;
  let game: ReturnType<typeof makeGame>;
  let awardXp: jest.Mock;

  beforeEach(() => {
    game = makeGame();
    awardXp = jest.fn();

    const gameRepo = {
      findOne: jest.fn(() => Promise.resolve(game)),
      save: jest.fn((g: unknown) => Promise.resolve(g)),
      update: jest.fn(() => Promise.resolve()),
    };
    const playerRepo = {
      findOne: jest.fn(() =>
        Promise.resolve({ uid: USER, lvl: 1, heroNavigation: { id: HERO_ID } }),
      ),
    };
    const answerRepo = {
      findOne: jest.fn(() =>
        Promise.resolve({ id: ANSWER_ID, questionId: 'q1', isCorrect: false }),
      ),
    };
    const heroSkillRepo = {
      findOne: jest.fn(({ where }: Where) =>
        Promise.resolve(SKILLS.find((s) => s.id === where.id) ?? null),
      ),
      find: jest.fn(({ where }: Where) =>
        Promise.resolve(SKILLS.filter((s) => s.heroId === where.heroId)),
      ),
    };
    const statsRepo = { save: jest.fn() };

    const deps = [
      gameRepo,
      {},
      statsRepo,
      answerRepo,
      playerRepo,
      {},
      heroSkillRepo,
      {},
      { awardXp },
    ] as unknown as ConstructorParameters<typeof GamesService>;
    service = new GamesService(...deps);
  });

  it('blocks the damage of a wrong answer while a skill is active', async () => {
    await service.useSkill(GAME_ID, SHIELDS_UP.id, USER);
    const result = await service.checkAnswer(GAME_ID, ANSWER_ID, USER);

    expect(result).toMatchObject({ correct: false, blocked: true });
    expect(result.playerLives).toBe(3);
    expect(game.gameStats.wrongAnswers).toBe(1);
    expect(game.gameStats.correctAnswersStreak).toBe(0);
    expect(game.activeSkillId).toBeNull();
  });

  it('blocks the damage of a timeout while a skill is active', async () => {
    await service.useSkill(GAME_ID, SHIELDS_UP.id, USER);
    const result = await service.timeoutQuestion(GAME_ID, USER);

    expect(result).toMatchObject({ playerLives: 3, blocked: true });
  });

  it('takes damage on a wrong answer without a skill', async () => {
    const result = await service.checkAnswer(GAME_ID, ANSWER_ID, USER);

    expect(result).toMatchObject({ playerLives: 2, blocked: false });
  });

  it('reports the run state of the skills', async () => {
    const skills = await service.useSkill(GAME_ID, SHIELDS_UP.id, USER);

    expect(skills).toEqual([
      expect.objectContaining({
        id: SHIELDS_UP.id,
        unlocked: true,
        used: true,
        active: true,
      }),
      expect.objectContaining({
        id: LATE_SKILL.id,
        unlocked: false,
        used: false,
        active: false,
      }),
    ]);
  });

  it('allows each skill only once per run', async () => {
    await service.useSkill(GAME_ID, SHIELDS_UP.id, USER);
    await service.checkAnswer(GAME_ID, ANSWER_ID, USER);
    game.isCurrentQuestionAnswered = false;

    await expect(
      service.useSkill(GAME_ID, SHIELDS_UP.id, USER),
    ).rejects.toThrow('This skill was already used this run');
  });

  it('rejects skills above the player level', async () => {
    await expect(
      service.useSkill(GAME_ID, LATE_SKILL.id, USER),
    ).rejects.toThrow('This skill unlocks at level 5');
  });

  it('rejects skills after the question was answered', async () => {
    game.isCurrentQuestionAnswered = true;

    await expect(
      service.useSkill(GAME_ID, SHIELDS_UP.id, USER),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});
