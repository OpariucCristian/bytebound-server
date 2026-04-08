import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Hero } from './hero.entity';

@Entity('HeroSkill')
export class HeroSkill {
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

  @ManyToOne(() => Hero, (h) => h.skills)
  @JoinColumn({ name: 'hero_id' })
  hero: Hero | null;

  @Column({ name: 'effect_type', type: 'int', nullable: true })
  effectType: number | null;

  @Column({ name: 'unlock_at_lvl', type: 'int', nullable: true })
  unlockAtLvl: number | null;
}
