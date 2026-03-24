import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { QuestionPool } from './question-pool.entity';

@Entity('QuestionPoolAnswer')
export class QuestionPoolAnswer {
  @Column({
    name: 'created_at',
    type: 'timestamptz',
    default: () => 'now()',
  })
  createdAt: Date;

  @Column({ name: 'questionId', type: 'uuid', nullable: true })
  questionId: string | null;

  @Column({ name: 'text', type: 'text', nullable: true })
  text: string | null;

  @Column({
    name: 'isCorrect',
    type: 'boolean',
    nullable: true,
    default: false,
  })
  isCorrect: boolean | null;

  @PrimaryGeneratedColumn('uuid', { name: 'id' })
  id: string;

  @ManyToOne(() => QuestionPool, (q) => q.questionPoolAnswers, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'questionId' })
  question: QuestionPool;
}
