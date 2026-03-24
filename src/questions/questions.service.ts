import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { QuestionPool } from './entities/question-pool.entity';
import { QuestionPoolAnswer } from './entities/question-pool-answer.entity';
import {
  QuestionPoolDto,
  QuestionPoolAnswerDto,
  CreateQuestionPoolDto,
  UpdateQuestionPoolDto,
  CheckAnswerResultDto,
} from './dto/question-pool.dto';

@Injectable()
export class QuestionsService {
  private readonly logger = new Logger(QuestionsService.name);

  constructor(
    @InjectRepository(QuestionPool)
    private readonly questionRepo: Repository<QuestionPool>,
    @InjectRepository(QuestionPoolAnswer)
    private readonly answerRepo: Repository<QuestionPoolAnswer>,
  ) {}

  private toDto(question: QuestionPool): QuestionPoolDto {
    return {
      id: question.id,
      createdAt: question.createdAt,
      text: question.text,
      category: question.category,
      difficulty:
        question.difficulty !== null ? Number(question.difficulty) : null,
      answers: (question.questionPoolAnswers ?? []).map(
        (a): QuestionPoolAnswerDto => ({
          id: a.id,
          text: a.text,
        }),
      ),
    };
  }

  async getAllQuestions(): Promise<QuestionPoolDto[]> {
    const questions = await this.questionRepo.find({
      relations: ['questionPoolAnswers'],
    });
    return questions.map((q) => this.toDto(q));
  }

  async getQuestionsByCategory(category: string): Promise<QuestionPoolDto[]> {
    const questions = await this.questionRepo.find({
      where: { category },
      relations: ['questionPoolAnswers'],
    });
    return questions.map((q) => this.toDto(q));
  }

  async getQuestionsByDifficulty(
    difficulty: number,
  ): Promise<QuestionPoolDto[]> {
    const questions = await this.questionRepo.find({
      where: { difficulty },
      relations: ['questionPoolAnswers'],
    });
    return questions.map((q) => this.toDto(q));
  }

  async getQuestionById(id: string): Promise<QuestionPoolDto | null> {
    const question = await this.questionRepo.findOne({
      where: { id },
      relations: ['questionPoolAnswers'],
    });
    if (!question) return null;
    return this.toDto(question);
  }

  async createQuestion(dto: CreateQuestionPoolDto): Promise<QuestionPoolDto> {
    const question = this.questionRepo.create({
      text: dto.text,
      category: dto.category,
      difficulty: dto.difficulty,
      createdAt: new Date(),
      questionPoolAnswers: dto.answers.map((a) =>
        this.answerRepo.create({
          text: a.text,
          isCorrect: a.isCorrect,
          createdAt: new Date(),
        }),
      ),
    });

    const saved = await this.questionRepo.save(question);
    return this.toDto(saved);
  }

  async updateQuestion(
    id: string,
    dto: UpdateQuestionPoolDto,
  ): Promise<boolean> {
    const question = await this.questionRepo.findOneBy({ id });
    if (!question) return false;

    if (dto.text !== undefined) question.text = dto.text;
    if (dto.category !== undefined) question.category = dto.category;
    if (dto.difficulty !== undefined) question.difficulty = dto.difficulty;

    await this.questionRepo.save(question);
    return true;
  }

  async deleteQuestion(id: string): Promise<boolean> {
    const question = await this.questionRepo.findOne({
      where: { id },
      relations: ['questionPoolAnswers'],
    });
    if (!question) return false;

    await this.questionRepo.remove(question);
    return true;
  }

  async checkAnswer(
    questionId: string,
    answerId: string,
  ): Promise<CheckAnswerResultDto | null> {
    const answer = await this.answerRepo.findOne({
      where: { id: answerId, questionId },
    });
    if (!answer) return null;

    return { isCorrect: answer.isCorrect ?? false };
  }
}
