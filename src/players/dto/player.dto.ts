/* eslint-disable @typescript-eslint/no-unsafe-call */
import { IsOptional, IsNumber } from 'class-validator';
import { Hero } from 'src/heroes/entities/hero.entity';

export class CreatePlayerDto {
  uid: string;
}

export class UpdatePlayerDto {
  @IsOptional()
  @IsNumber()
  lvl?: number;
}

export class PlayerDto {
  uid: string;
  createdAt: Date;
  lvl: number | null;
  neededXp: number | null;
  xp: number | null;
  hero: Hero | null;
}

export class LevelDto {
  lvl: number;
  createdAt: Date;
  neededXp: number | null;
}
