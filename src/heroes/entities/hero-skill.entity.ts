import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { Hero } from './hero.entity';
import { SkillEffect } from '../enums/skill-effect.enum';

@Entity('HeroSkill')
@Index('IDX_HeroSkill_key', ['key'], { unique: true })
export class HeroSkill {
  @PrimaryGeneratedColumn('uuid', { name: 'id' })
  id: string;

  @Column({
    name: 'created_at',
    type: 'timestamptz',
    default: () => 'now()',
  })
  createdAt: Date;

  /** Stable identifier the client uses to pick the skill's icon and effects. */
  @Column({ name: 'key', type: 'text' })
  key: string;

  @Column({ name: 'name', type: 'text', nullable: true })
  name: string | null;

  @Column({ name: 'description', type: 'text', nullable: true })
  description: string | null;

  @Column({ name: 'hero_id', type: 'uuid', nullable: true })
  heroId: string | null;

  @ManyToOne(() => Hero, (h) => h.skills)
  @JoinColumn({ name: 'hero_id' })
  hero: Hero | null;

  @Column({ name: 'effect_type', type: 'int', nullable: true })
  effectType: SkillEffect | null;

  @Column({ name: 'unlock_at_lvl', type: 'int', nullable: true })
  unlockAtLvl: number | null;
}
