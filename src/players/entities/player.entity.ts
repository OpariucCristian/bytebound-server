import {
  Entity,
  Column,
  PrimaryColumn,
  ManyToOne,
  OneToMany,
  JoinColumn,
} from 'typeorm';
import { Level } from '../../levels/entities/level.entity';
import { Game } from '../../games/entities/game.entity';
import { Hero } from 'src/heroes/entities/hero.entity';

@Entity('Player')
export class Player {
  @Column({
    name: 'created_at',
    type: 'timestamptz',
    default: () => 'now()',
  })
  createdAt: Date;

  @PrimaryColumn({ name: 'uid', type: 'text' })
  uid: string;

  @Column({ name: 'lvl', type: 'bigint', default: 1 })
  lvl: number;

  @Column({ name: 'xp', type: 'bigint', default: 0 })
  xp: number;

  @Column({ name: 'user_name', type: 'text' })
  userName: string;

  @ManyToOne(() => Hero, (h) => h.players)
  @JoinColumn({ name: 'hero_id' })
  heroNavigation: Hero;

  @OneToMany(() => Game, (g) => g.player)
  games: Game[];

  @ManyToOne(() => Level, (l) => l.players, { onDelete: 'SET NULL' })
  @JoinColumn({ name: 'lvl' })
  lvlNavigation: Level;
}
