import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryColumn,
} from 'typeorm';
import { Player } from '../../players/entities/player.entity';
import { MatchPlayer } from './match-player.entity';

/** A finished 1v1 (versus) match. Only finished matches are stored. */
@Entity('Match')
export class Match {
  @PrimaryColumn('uuid', { name: 'id' })
  id: string;

  @Column({
    name: 'created_at',
    type: 'timestamptz',
    default: () => 'now()',
  })
  createdAt: Date;

  @Column({ name: 'finished_at', type: 'timestamptz' })
  finishedAt: Date;

  /** The game mode the match is a variant of (always `endless` for now). */
  @Column({ name: 'mode', type: 'text', default: 'endless' })
  mode: string;

  @Column({ name: 'category', type: 'text' })
  category: string;

  /** How the players met: `queue` or `room`. */
  @Column({ name: 'source', type: 'text' })
  source: string;

  /** `ko`, `forfeit`, `draw` or `idle`. */
  @Column({ name: 'end_reason', type: 'text' })
  endReason: string;

  @Column({ name: 'rounds', type: 'int', default: 0 })
  rounds: number;

  @Column({ name: 'winner_id', type: 'text', nullable: true })
  winnerId: string | null;

  @ManyToOne(() => Player, { nullable: true })
  @JoinColumn({ name: 'winner_id' })
  winner: Player | null;

  @OneToMany(() => MatchPlayer, (p) => p.match, { cascade: true })
  players: MatchPlayer[];
}
