import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  OneToOne,
  JoinColumn,
  ManyToOne,
} from 'typeorm';
import { Game } from './game.entity';
import { Player } from 'src/players/entities/player.entity';

@Entity('GameStats')
export class GameStats {
  @PrimaryGeneratedColumn('uuid', { name: 'id' })
  id: string;

  @Column({ name: 'player_id', type: 'text' })
  playerId: string;

  @Column({ name: 'correct_answers', type: 'int', default: 0 })
  correctAnswers: number;

  @Column({ name: 'correct_answers_streak', type: 'int', default: 0 })
  correctAnswersStreak: number;

  @Column({ name: 'correct_answers_streak_max', type: 'int', default: 0 })
  correctAnswersStreakMax: number;

  @Column({ name: 'wrong_answers', type: 'int', default: 0 })
  wrongAnswers: number;

  @Column({ name: 'xp_gained', type: 'int', default: 0 })
  xpGained: number;

  @Column({
    name: 'created_at',
    type: 'timestamptz',
    default: () => 'now()',
  })
  createdAt: Date;

  @Column({ name: 'game_id', type: 'uuid' })
  gameId: string;

  @OneToOne(() => Game, (g) => g.gameStats, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'game_id' })
  game: Game;

  @ManyToOne(() => Player)
  @JoinColumn({ name: 'player_id' })
  player: Player;
}
