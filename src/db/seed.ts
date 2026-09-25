import { DataSource, EntityTarget, ObjectLiteral } from 'typeorm';
import { Enemy } from '../enemies/entities/enemy.entity';
import { Hero } from '../heroes/entities/hero.entity';
import { Level } from '../levels/entities/level.entity';
import { QuestionPool } from '../questions/entities/question-pool.entity';
import { QuestionPoolAnswer } from '../questions/entities/question-pool-answer.entity';

const HEROES: Partial<Hero>[] = [
  {
    name: 'Knight',
    description: 'Sturdy and reliable. Takes a beating and keeps swinging.',
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
    spriteKey: 'enemy_demon',
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

/** [question, correct answer, ...wrong answers], grouped by difficulty. */
const DSA_QUESTIONS: Record<number, string[][]> = {
  1: [
    [
      'Which data structure is Last-In-First-Out (LIFO)?',
      'Stack',
      'Queue',
      'Linked list',
      'Heap',
    ],
    [
      'Which data structure is First-In-First-Out (FIFO)?',
      'Queue',
      'Stack',
      'Binary tree',
      'Hash set',
    ],
    [
      'Time complexity of reading an array element by index?',
      'O(1)',
      'O(n)',
      'O(log n)',
      'O(n log n)',
    ],
    [
      'What is the index of the first element in a zero-indexed array?',
      '0',
      '1',
      '-1',
      'It depends on the length',
    ],
    [
      'Which operation adds an element to the top of a stack?',
      'Push',
      'Pop',
      'Peek',
      'Enqueue',
    ],
    [
      'In a singly linked list, each node points to...',
      'The next node',
      'The previous node',
      'The head node',
      'Both neighbours',
    ],
    [
      'What does a hash map store?',
      'Key-value pairs',
      'Only sorted values',
      'Keys without values',
      'A FIFO sequence',
    ],
    [
      'At most, how many children does a node in a binary tree have?',
      '2',
      '1',
      '3',
      'Unlimited',
    ],
  ],
  2: [
    [
      'Worst-case time complexity of linear search?',
      'O(n)',
      'O(1)',
      'O(log n)',
      'O(n²)',
    ],
    [
      'Binary search requires the input to be...',
      'Sorted',
      'Unique',
      'A linked list',
      'Of even length',
    ],
    [
      'Time complexity of binary search on a sorted array?',
      'O(log n)',
      'O(n)',
      'O(1)',
      'O(n log n)',
    ],
    [
      'Average time complexity of a hash table lookup?',
      'O(1)',
      'O(log n)',
      'O(n)',
      'O(n log n)',
    ],
    [
      'Which traversal visits a binary search tree in sorted order?',
      'In-order',
      'Pre-order',
      'Post-order',
      'Level-order',
    ],
    [
      'Time to insert at the head of a singly linked list?',
      'O(1)',
      'O(n)',
      'O(log n)',
      'O(n²)',
    ],
    [
      'Which data structure drives a breadth-first search?',
      'Queue',
      'Stack',
      'Heap',
      'Trie',
    ],
    [
      'Which data structure drives an iterative depth-first search?',
      'Stack',
      'Queue',
      'Hash map',
      'Priority queue',
    ],
  ],
  3: [
    [
      'Worst-case time complexity of quicksort?',
      'O(n²)',
      'O(n log n)',
      'O(n)',
      'O(log n)',
    ],
    [
      'Time complexity of merge sort in every case?',
      'O(n log n)',
      'O(n²)',
      'O(n)',
      'O(log n)',
    ],
    [
      'In a min-heap, the root holds...',
      'The smallest element',
      'The largest element',
      'The median',
      'The newest element',
    ],
    [
      'Time to insert into a binary heap of n elements?',
      'O(log n)',
      'O(1)',
      'O(n)',
      'O(n log n)',
    ],
    [
      'What is a hash collision?',
      'Two keys map to the same bucket',
      'A key inserted twice',
      'An empty table lookup',
      'A deleted key',
    ],
    [
      'Worst-case search time in an unbalanced binary search tree?',
      'O(n)',
      'O(log n)',
      'O(1)',
      'O(n log n)',
    ],
    [
      'Which of these sorting algorithms is stable?',
      'Merge sort',
      'Quicksort',
      'Heapsort',
      'Selection sort',
    ],
    [
      'Extra space used by merge sort on an array?',
      'O(n)',
      'O(1)',
      'O(log n)',
      'O(n²)',
    ],
  ],
  4: [
    [
      'Which algorithm finds single-source shortest paths with non-negative weights?',
      "Dijkstra's",
      "Kruskal's",
      "Prim's",
      'Topological sort',
    ],
    [
      'Which shortest-path algorithm handles negative edge weights?',
      'Bellman-Ford',
      "Dijkstra's",
      "Prim's",
      "Kruskal's",
    ],
    [
      'A topological sort is only possible on a...',
      'Directed acyclic graph',
      'Undirected graph',
      'Complete graph',
      'Graph with a cycle',
    ],
    [
      "Which structure does Kruskal's algorithm use to detect cycles?",
      'Union-find',
      'Stack',
      'Trie',
      'Queue',
    ],
    [
      'Height of a balanced binary search tree with n nodes?',
      'O(log n)',
      'O(n)',
      'O(1)',
      'O(√n)',
    ],
    [
      'Which data structure is best for string prefix lookups?',
      'Trie',
      'Hash map',
      'Min-heap',
      'Queue',
    ],
    [
      'Time complexity of BFS with an adjacency list (V vertices, E edges)?',
      'O(V + E)',
      'O(V × E)',
      'O(V²)',
      'O(E log V)',
    ],
    [
      'Building a heap from n unsorted elements takes...',
      'O(n)',
      'O(n log n)',
      'O(log n)',
      'O(n²)',
    ],
  ],
  5: [
    [
      'Amortized cost of appending to a doubling dynamic array?',
      'O(1)',
      'O(n)',
      'O(log n)',
      'O(n log n)',
    ],
    [
      'Amortized cost of union-find with path compression and union by rank?',
      'O(α(n)), nearly constant',
      'O(log n)',
      'O(n)',
      'O(√n)',
    ],
    [
      'Which technique stores results of overlapping subproblems?',
      'Dynamic programming',
      'Greedy',
      'Divide and conquer',
      'Backtracking',
    ],
    [
      'Time complexity of Floyd-Warshall all-pairs shortest paths?',
      'O(V³)',
      'O(V²)',
      'O(E log V)',
      'O(V + E)',
    ],
    [
      'Lower bound for comparison-based sorting?',
      'Ω(n log n)',
      'Ω(n)',
      'Ω(n²)',
      'Ω(log n)',
    ],
    [
      'What height does a red-black tree guarantee?',
      'O(log n)',
      'O(n)',
      'O(√n)',
      'O(1)',
    ],
    [
      'Which algorithm finds a cycle in a linked list with O(1) extra space?',
      "Floyd's tortoise and hare",
      "Dijkstra's",
      "Kadane's",
      "Kruskal's",
    ],
    [
      'Time complexity of longest common subsequence DP on strings of length n and m?',
      'O(n × m)',
      'O(n + m)',
      'O(2ⁿ)',
      'O(n log m)',
    ],
  ],
};

const isEmpty = async (
  dataSource: DataSource,
  entity: EntityTarget<ObjectLiteral>,
): Promise<boolean> => (await dataSource.getRepository(entity).count()) === 0;

/**
 * Inserts the game content (heroes, enemies, levels, questions). Each table is
 * only seeded while empty, so this is safe to run on every deploy.
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

  if (await isEmpty(dataSource, QuestionPool)) {
    const questions = Object.entries(DSA_QUESTIONS).flatMap(
      ([difficulty, rows]) =>
        rows.map(([text, correct, ...wrong]) =>
          dataSource.getRepository(QuestionPool).create({
            text,
            category: 'dsa',
            difficulty: Number(difficulty),
            questionPoolAnswers: [
              { text: correct, isCorrect: true },
              ...wrong.map((w) => ({ text: w, isCorrect: false })),
            ] as QuestionPoolAnswer[],
          }),
        ),
    );
    // Answers are saved through the cascade on questionPoolAnswers.
    await dataSource.getRepository(QuestionPool).save(questions);
    seeded.push(`${questions.length} questions`);
  }

  return seeded;
};
