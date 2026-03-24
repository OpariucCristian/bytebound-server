import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Game } from './game.entity';
import { QuestionPool } from '../../questions/entities/question-pool.entity';

@Entity('GameQuestions')
export class GameQuestion {
  @PrimaryGeneratedColumn('uuid', { name: 'id' })
  id: string;

  @Column({ name: 'game_id', type: 'uuid' })
  gameId: string;

  @Column({ name: 'question_id', type: 'uuid' })
  questionId: string;

  @Column({
    name: 'created_at',
    type: 'timestamptz',
    default: () => 'now()',
  })
  createdAt: Date;

  @ManyToOne(() => Game, (g) => g.gameQuestions)
  @JoinColumn({ name: 'game_id' })
  game: Game;

  @ManyToOne(() => QuestionPool, (q) => q.gameQuestions)
  @JoinColumn({ name: 'question_id' })
  question: QuestionPool;
}
