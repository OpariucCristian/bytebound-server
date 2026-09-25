import { DataSource, EntityTarget, ObjectLiteral } from 'typeorm';
import { Enemy } from '../enemies/entities/enemy.entity';
import { Hero } from '../heroes/entities/hero.entity';
import { Level } from '../levels/entities/level.entity';
import { QuestionPool } from '../questions/entities/question-pool.entity';
import { QuestionPoolAnswer } from '../questions/entities/question-pool-answer.entity';
import { DSA_QUESTIONS } from './dsa-questions';

const HEROES: Partial<Hero>[] = [
  {
    name: 'Knight',
    description: 'Sturdy and reliable.',
    baseHealth: 5,
    baseAttack: 1,
    spriteKey: 'hero_knight',
  },
  {
    name: 'Wizard',
    description: 'Fragile, but their spells hit twice as hard.',
    baseHealth: 3,
    baseAttack: 2,
    spriteKey: 'hero_wizard',
  },
];

// One enemy per difficulty; games move up a difficulty per defeated enemy.
const ENEMIES: Partial<Enemy>[] = [
  {
    name: 'Demon',
    difficulty: 1,
    baseHealth: 3,
    baseAttack: 1,
    spriteKey: 'enemy_demon',
  },
  {
    name: 'Skeleton',
    difficulty: 2,
    baseHealth: 4,
    baseAttack: 1,
    spriteKey: 'enemy_skeleton',
  },
  {
    name: 'Demon Brute',
    difficulty: 3,
    baseHealth: 5,
    baseAttack: 1,
    spriteKey: 'enemy_imp',
  },
  {
    name: 'Skeleton Knight',
    difficulty: 4,
    baseHealth: 6,
    baseAttack: 2,
    spriteKey: 'enemy_skeleton',
  },
  {
    name: 'Archdemon',
    difficulty: 5,
    baseHealth: 8,
    baseAttack: 2,
    spriteKey: 'enemy_demon',
  },
];

const MAX_LEVEL = 30;
const LEVELS: Partial<Level>[] = Array.from({ length: MAX_LEVEL }, (_, i) => ({
  lvl: i + 1,
  neededXp: 300 + i * 150,
}));

const isEmpty = async (
  dataSource: DataSource,
  entity: EntityTarget<ObjectLiteral>,
): Promise<boolean> => (await dataSource.getRepository(entity).count()) === 0;

/**
 * Brings the question bank in line with DSA_QUESTIONS, keyed by question text:
 * new questions are inserted and existing ones moved to their listed
 * difficulty. Questions missing from the bank are left alone, since past games
 * reference them.
 */
const syncQuestions = async (dataSource: DataSource): Promise<string[]> => {
  const repo = dataSource.getRepository(QuestionPool);
  const existing = await repo.find({
    where: { category: 'dsa' },
    select: { id: true, text: true, difficulty: true },
  });
  const byText = new Map(existing.map((q) => [q.text, q]));

  const toInsert: QuestionPool[] = [];
  let moved = 0;
  for (const [key, rows] of Object.entries(DSA_QUESTIONS)) {
    const difficulty = Number(key);
    for (const [text, correct, ...wrong] of rows) {
      const current = byText.get(text);
      if (!current) {
        toInsert.push(
          repo.create({
            text,
            category: 'dsa',
            difficulty,
            questionPoolAnswers: [
              { text: correct, isCorrect: true },
              ...wrong.map((w) => ({ text: w, isCorrect: false })),
            ] as QuestionPoolAnswer[],
          }),
        );
      } else if (Number(current.difficulty) !== difficulty) {
        await repo.update(current.id, { difficulty });
        moved++;
      }
    }
  }

  // Answers are saved through the cascade on questionPoolAnswers.
  if (toInsert.length > 0) await repo.save(toInsert);

  return [
    ...(toInsert.length > 0 ? [`${toInsert.length} questions`] : []),
    ...(moved > 0 ? [`difficulty of ${moved} questions`] : []),
  ];
};

/**
 * Inserts the game content (heroes, enemies, levels, questions). Heroes,
 * enemies and levels are only seeded while empty; questions are synced with
 * the bank, so this is safe to run on every deploy.
 */
export const seed = async (dataSource: DataSource): Promise<string[]> => {
  const seeded: string[] = [];

  if (await isEmpty(dataSource, Hero)) {
    await dataSource.getRepository(Hero).save(HEROES);
    seeded.push(`${HEROES.length} heroes`);
  }

  if (await isEmpty(dataSource, Enemy)) {
    await dataSource.getRepository(Enemy).save(ENEMIES);
    seeded.push(`${ENEMIES.length} enemies`);
  }

  if (await isEmpty(dataSource, Level)) {
    await dataSource.getRepository(Level).save(LEVELS);
    seeded.push(`${LEVELS.length} levels`);
  }

  seeded.push(...(await syncQuestions(dataSource)));

  return seeded;
};
