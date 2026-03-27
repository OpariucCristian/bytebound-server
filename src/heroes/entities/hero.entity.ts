import { Player } from 'src/players/entities/player.entity';
import { Entity, PrimaryGeneratedColumn, Column, OneToMany } from 'typeorm';
import { HeroSkill } from './hero-skill.entity';

@Entity('Hero')
export class Hero {
  @PrimaryGeneratedColumn('uuid', { name: 'id' })
  id: string;

  @Column({
    name: 'created_at',
    type: 'timestamptz',
    default: () => 'now()',
  })
  createdAt: Date;

  @Column({ name: 'name', type: 'text', nullable: true })
  name: string | null;

  @Column({ name: 'base_health', type: 'int', nullable: true })
  baseHealth: number | null;

  @Column({ name: 'base_attack', type: 'int', nullable: true })
  baseAttack: number | null;

  @Column({ name: 'description', type: 'text', nullable: true })
  description: string | null;

  @Column({ name: 'sprite_key', type: 'uuid', nullable: true })
  spriteKey: string | null;

  @OneToMany(() => Player, (p) => p.heroNavigation)
  players: Player[];

  @OneToMany(() => HeroSkill, (s) => s.hero)
  skills: HeroSkill[];
}
