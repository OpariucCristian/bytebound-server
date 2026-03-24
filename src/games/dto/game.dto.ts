/* eslint-disable @typescript-eslint/no-unsafe-call */
import { IsOptional, IsString, IsNumber } from 'class-validator';

export class CreateNewGameDto {
  @IsOptional()
  @IsString()
  type?: string;

  @IsOptional()
  @IsString()
  category?: string;

  @IsOptional()
  @IsNumber()
  difficulty?: number;
}

export class ReadNewGameDto {
  id: string;
  type: string;
  category: string;
  currentQuestionId: string | null;
  difficulty: number;
  gameState: number;
  playerId: string;
  firstQuestion: QuestionPoolDto;
  playerLives: number;
}

export class QuestionPoolDto {
  id: string;
  createdAt: Date;
  text: string | null;
  category: string | null;
  difficulty: number | null;
  questionSeconds?: number;
  isDifficultyChange?: boolean;
  answers: QuestionPoolAnswerDto[];
}

export class QuestionPoolAnswerDto {
  id: string;
  text: string | null;
  // IsCorrect is intentionally excluded
}
