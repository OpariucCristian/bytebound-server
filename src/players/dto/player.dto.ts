/* eslint-disable @typescript-eslint/no-unsafe-call */
import { IsOptional, IsNumber } from 'class-validator';

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
}

export class LevelDto {
  lvl: number;
  createdAt: Date;
  neededXp: number | null;
}
