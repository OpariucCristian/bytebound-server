import { Entity, PrimaryGeneratedColumn, Column, OneToMany } from 'typeorm';
import { QuestionPoolAnswer } from './question-pool-answer.entity';
import { GameQuestion } from '../../games/entities/game-question.entity';
import { Game } from '../../games/entities/game.entity';

@Entity('QuestionPool')
export class QuestionPool {
  @PrimaryGeneratedColumn('uuid', { name: 'id' })
  id: string;

  @Column({
    name: 'created_at',
    type: 'timestamptz',
    default: () => 'now()',
  })
  createdAt: Date;

  @Column({ name: 'text', type: 'text', nullable: true })
  text: string | null;

  @Column({ name: 'category', type: 'text', nullable: true, default: 'dsa' })
  category: string | null;

  @Column({ name: 'difficulty', type: 'int', nullable: true, default: 1 })
  difficulty: number | null;

  @OneToMany(() => QuestionPoolAnswer, (a) => a.question, { cascade: true })
  questionPoolAnswers: QuestionPoolAnswer[];

  @OneToMany(() => GameQuestion, (gq) => gq.question)
  gameQuestions: GameQuestion[];

  @OneToMany(() => Game, (g) => g.currentQuestion)
  games: Game[];
}
