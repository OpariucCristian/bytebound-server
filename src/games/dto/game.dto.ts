import {
  IsOptional,
  IsString,
  IsNumber,
  IsUUID,
  IsDate,
  IsArray,
  ValidateNested,
  IsBoolean,
  IsInt,
  IsIn,
} from 'class-validator';
import { Type } from 'class-transformer';
import { Enemy } from 'src/enemies/entities/enemy.entity';
import { GameMode } from '../enums/game-mode.enum';

export class CreateNewGameDto {
  @IsOptional()
  @IsIn(Object.values(GameMode))
  type?: GameMode;

  @IsOptional()
  @IsString()
  category?: string;

  @IsOptional()
  @IsNumber()
  difficulty?: number;
}

export class QuestionPoolAnswerDto {
  @IsUUID()
  id!: string;

  @IsOptional()
  @IsString()
  text!: string | null;
  // IsCorrect is intentionally excluded
}

export class QuestionPoolDto {
  @IsUUID()
  id!: string;

  @IsDate()
  @Type(() => Date)
  createdAt!: Date;

  @IsOptional()
  @IsString()
  text!: string | null;

  @IsOptional()
  @IsString()
  category!: string | null;

  @IsOptional()
  @IsNumber()
  difficulty!: number | null;

  @IsOptional()
  @IsInt()
  questionSeconds?: number;

  @IsOptional()
  @IsBoolean()
  isDifficultyChange?: boolean;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => QuestionPoolAnswerDto)
  answers!: QuestionPoolAnswerDto[];

  @IsOptional()
  @ValidateNested()
  @Type(() => Enemy)
  enemy!: Enemy | null;

  @IsOptional()
  @IsNumber()
  enemyLives?: number;

  @IsOptional()
  @IsNumber()
  playerLives?: number;
}

export class ReadNewGameDto {
  @IsUUID()
  id!: string;

  @IsString()
  type!: string;

  @IsString()
  category!: string;

  @IsOptional()
  @IsUUID()
  currentQuestionId!: string | null;

  @IsNumber()
  difficulty!: number;

  @IsNumber()
  gameState!: number;

  @IsUUID()
  playerId!: string;

  @ValidateNested()
  @Type(() => QuestionPoolDto)
  firstQuestion!: QuestionPoolDto;

  @IsNumber()
  playerLives!: number;

  @IsNumber()
  enemyLives!: number;

  @ValidateNested()
  @Type(() => Enemy)
  enemy!: Enemy;
}

export class SubmitAnswerDto {
  @IsUUID()
  answerId!: string;
}

export class AnswerResultDto {
  correct!: boolean;
  playerLives!: number;
  enemyLives!: number;
  gameOver!: boolean;
}
