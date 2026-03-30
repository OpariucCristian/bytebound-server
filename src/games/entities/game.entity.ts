import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  OneToMany,
  OneToOne,
  JoinColumn,
} from 'typeorm';
import { Player } from '../../players/entities/player.entity';
import { QuestionPool } from '../../questions/entities/question-pool.entity';
import { GameQuestion } from './game-question.entity';
import { GameStats } from './game-stats.entity';
import { GameState } from '../enums/game-state.enum';
import { Enemy } from 'src/enemies/entities/enemy.entity';

@Entity('Game')
export class Game {
  @PrimaryGeneratedColumn('uuid', { name: 'id' })
  id: string;

  @Column({
    name: 'created_at',
    type: 'timestamptz',
    default: () => 'now()',
  })
  createdAt: Date;

  @Column({ name: 'type', type: 'text', default: 'endless' })
  type: string;

  @Column({ name: 'category', type: 'text', default: 'dsa' })
  category: string;

  @Column({ name: 'currentQuestionId', type: 'uuid', nullable: true })
  currentQuestionId: string | null;

  @Column({ name: 'difficulty', type: 'int', default: 1 })
  difficulty: number;

  @Column({ name: 'playerId', type: 'text' })
  playerId: string;

  @Column({
    name: 'isCurrentQuestionAnswered',
    type: 'boolean',
    default: false,
  })
  isCurrentQuestionAnswered: boolean;

  @Column({ name: 'playerLives', type: 'int' })
  playerLives: number;

  @Column({ name: 'enemy_lives', type: 'int' })
  enemyLives: number;

  @Column({ name: 'gameState', type: 'int', default: GameState.Active })
  gameState: number;

  @Column({ name: 'xpGained', type: 'int', default: 0 })
  xpGained: number;

  @Column({
    name: 'currentQuestionTimestamp',
    type: 'timestamptz',
    default: () => "(now() AT TIME ZONE 'utc')",
  })
  currentQuestionTimestamp: Date;

  @Column({ name: 'questionSeconds', type: 'int', default: 10 })
  questionSeconds: number;

  @ManyToOne(() => QuestionPool, (q) => q.games, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'currentQuestionId' })
  currentQuestion: QuestionPool;

  @ManyToOne(() => Player, (p) => p.games)
  @JoinColumn({ name: 'playerId' })
  player: Player;

  @ManyToOne(() => Enemy, (e) => e.games)
  @JoinColumn({ name: 'enemy_id' })
  enemyNavigation: Enemy;

  @OneToMany(() => GameQuestion, (gq) => gq.game)
  gameQuestions: GameQuestion[];

  @OneToOne(() => GameStats, (gs) => gs.game)
  gameStats: GameStats;
}
