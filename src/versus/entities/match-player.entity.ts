import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Player } from '../../players/entities/player.entity';
import { Hero } from '../../heroes/entities/hero.entity';
import { Match } from './match.entity';

/** One player's side of a finished versus match. */
@Entity('MatchPlayer')
export class MatchPlayer {
  @PrimaryGeneratedColumn('uuid', { name: 'id' })
  id: string;

  @Column({ name: 'match_id', type: 'uuid' })
  matchId: string;

  @ManyToOne(() => Match, (m) => m.players, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'match_id' })
  match: Match;

  @Index()
  @Column({ name: 'player_id', type: 'text' })
  playerId: string;

  @ManyToOne(() => Player)
  @JoinColumn({ name: 'player_id' })
  player: Player;

  @Column({ name: 'hero_id', type: 'uuid', nullable: true })
  heroId: string | null;

  @ManyToOne(() => Hero, { nullable: true })
  @JoinColumn({ name: 'hero_id' })
  hero: Hero | null;

  @Column({ name: 'lives_left', type: 'int' })
  livesLeft: number;

  @Column({ name: 'correct_answers', type: 'int', default: 0 })
  correctAnswers: number;

  @Column({ name: 'wrong_answers', type: 'int', default: 0 })
  wrongAnswers: number;

  @Column({ name: 'xp_gained', type: 'int', default: 0 })
  xpGained: number;

  /** `win`, `loss` or `draw`. */
  @Column({ name: 'result', type: 'text' })
  result: string;
}
