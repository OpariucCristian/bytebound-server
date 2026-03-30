import { Game } from 'src/games/entities/game.entity';
import { Entity, PrimaryGeneratedColumn, Column, OneToMany } from 'typeorm';

@Entity('Enemy')
export class Enemy {
  @PrimaryGeneratedColumn('uuid', { name: 'id' })
  id: string;

  @Column({
    name: 'created_at',
    type: 'timestamptz',
    default: () => 'now()',
  })
  createdAt: Date;

  @Column({ name: 'name', type: 'text' })
  name: string | null;

  @Column({ name: 'base_health', type: 'int' })
  baseHealth: number | null;

  @Column({ name: 'base_attack', type: 'int' })
  baseAttack: number | null;

  @Column({ name: 'difficulty', type: 'int' })
  difficulty: number | null;

  @Column({ name: 'sprite_key', type: 'uuid' })
  spriteKey: string | null;

  @OneToMany(() => Game, (g) => g.enemyNavigation)
  games: Game[];
}
