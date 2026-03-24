/* eslint-disable @typescript-eslint/no-unsafe-call */
import {
  IsOptional,
  IsString,
  IsNumber,
  IsBoolean,
  IsArray,
  ValidateNested,
  IsUUID,
} from 'class-validator';
import { Type } from 'class-transformer';

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

export class CreateQuestionPoolAnswerDto {
  @IsOptional()
  @IsString()
  text?: string;

  @IsOptional()
  @IsBoolean()
  isCorrect?: boolean;
}

export class CreateQuestionPoolDto {
  @IsOptional()
  @IsString()
  text?: string;

  @IsOptional()
  @IsString()
  category?: string;

  @IsOptional()
  @IsNumber()
  difficulty?: number;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateQuestionPoolAnswerDto)
  answers: CreateQuestionPoolAnswerDto[];
}

export class UpdateQuestionPoolDto {
  @IsOptional()
  @IsString()
  text?: string;

  @IsOptional()
  @IsString()
  category?: string;

  @IsOptional()
  @IsNumber()
  difficulty?: number;
}

export class CheckAnswerDto {
  @IsUUID()
  answerId: string;
}

export class CheckAnswerResultDto {
  isCorrect: boolean;
}
