import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Param,
  Body,
  UseGuards,
  ParseUUIDPipe,
  ParseIntPipe,
  HttpCode,
  HttpStatus,
  NotFoundException,
  InternalServerErrorException,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { QuestionsService } from './questions.service';
import {
  QuestionPoolDto,
  CreateQuestionPoolDto,
  UpdateQuestionPoolDto,
  CheckAnswerDto,
  CheckAnswerResultDto,
} from './dto/question-pool.dto';

@UseGuards(AuthGuard('jwt'))
@Controller('api/questions')
export class QuestionsController {
  constructor(private readonly questionsService: QuestionsService) {}

  @Get()
  async getAllQuestions(): Promise<QuestionPoolDto[]> {
    try {
      return await this.questionsService.getAllQuestions();
    } catch {
      throw new InternalServerErrorException(
        'An error occurred while retrieving questions',
      );
    }
  }

  @Get('category/:category')
  async getQuestionsByCategory(
    @Param('category') category: string,
  ): Promise<QuestionPoolDto[]> {
    try {
      return await this.questionsService.getQuestionsByCategory(category);
    } catch {
      throw new InternalServerErrorException(
        'An error occurred while retrieving questions',
      );
    }
  }

  @Get('difficulty/:difficulty')
  async getQuestionsByDifficulty(
    @Param('difficulty', ParseIntPipe) difficulty: number,
  ): Promise<QuestionPoolDto[]> {
    try {
      return await this.questionsService.getQuestionsByDifficulty(difficulty);
    } catch {
      throw new InternalServerErrorException(
        'An error occurred while retrieving questions',
      );
    }
  }

  @Get(':id')
  async getQuestion(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<QuestionPoolDto> {
    try {
      const question = await this.questionsService.getQuestionById(id);
      if (!question) {
        throw new NotFoundException(`Question with ID ${id} not found`);
      }
      return question;
    } catch (err) {
      if (err instanceof NotFoundException) throw err;
      throw new InternalServerErrorException(
        'An error occurred while retrieving the question',
      );
    }
  }

  @Post()
  @UseGuards(AuthGuard('jwt'))
  async createQuestion(
    @Body() dto: CreateQuestionPoolDto,
  ): Promise<QuestionPoolDto> {
    try {
      return await this.questionsService.createQuestion(dto);
    } catch {
      throw new InternalServerErrorException(
        'An error occurred while creating the question',
      );
    }
  }

  @Put(':id')
  @UseGuards(AuthGuard('jwt'))
  @HttpCode(HttpStatus.NO_CONTENT)
  async updateQuestion(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateQuestionPoolDto,
  ): Promise<void> {
    try {
      const result = await this.questionsService.updateQuestion(id, dto);
      if (!result) {
        throw new NotFoundException(`Question with ID ${id} not found`);
      }
    } catch (err) {
      if (err instanceof NotFoundException) throw err;
      throw new InternalServerErrorException(
        'An error occurred while updating the question',
      );
    }
  }

  @Delete(':id')
  @UseGuards(AuthGuard('jwt'))
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteQuestion(@Param('id', ParseUUIDPipe) id: string): Promise<void> {
    try {
      const result = await this.questionsService.deleteQuestion(id);
      if (!result) {
        throw new NotFoundException(`Question with ID ${id} not found`);
      }
    } catch (err) {
      if (err instanceof NotFoundException) throw err;
      throw new InternalServerErrorException(
        'An error occurred while deleting the question',
      );
    }
  }

  @Post(':questionId/check-answer')
  async checkAnswer(
    @Param('questionId', ParseUUIDPipe) questionId: string,
    @Body() dto: CheckAnswerDto,
  ): Promise<CheckAnswerResultDto> {
    try {
      const result = await this.questionsService.checkAnswer(
        questionId,
        dto.answerId,
      );
      if (!result) {
        throw new NotFoundException(
          `Answer with ID ${dto.answerId} not found for question ${questionId}`,
        );
      }
      return result;
    } catch (err) {
      if (err instanceof NotFoundException) throw err;
      throw new InternalServerErrorException(
        'An error occurred while checking the answer',
      );
    }
  }
}
