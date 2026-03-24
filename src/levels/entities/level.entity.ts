import { Entity, Column, PrimaryColumn, OneToMany } from 'typeorm';
import { Player } from '../../players/entities/player.entity';

@Entity('Level')
export class Level {
  @PrimaryColumn({ name: 'lvl', type: 'bigint' })
  lvl: number;

  @Column({
    name: 'created_at',
    type: 'timestamptz',
    default: () => 'now()',
  })
  createdAt: Date;

  @Column({ name: 'neededXp', type: 'bigint', nullable: true, default: 0 })
  neededXp: number | null;

  @OneToMany(() => Player, (p) => p.lvlNavigation)
  players: Player[];
}
