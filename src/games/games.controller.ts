import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Param,
  Body,
  Req,
  UseGuards,
  ParseUUIDPipe,
  HttpCode,
  HttpStatus,
  NotFoundException,
  BadRequestException,
  UnauthorizedException,
  InternalServerErrorException,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { GamesService } from './games.service';
import { CreateNewGameDto, ReadNewGameDto } from './dto/game.dto';
import { ReadGameStatsDto } from './dto/game-stats.dto';
import type { Request } from 'express';
import { Game } from './entities/game.entity';
import { GameStats } from './entities/game-stats.entity';

@Controller('api/games')
export class GamesController {
  constructor(private readonly gamesService: GamesService) {}

  private getUserId(req: Request): string | undefined {
    const user = req.user as Record<string, unknown> | undefined;
    return typeof user?.sub === 'string' ? user.sub : undefined;
  }

  // POST: api/games/gameInstance/new
  @Post('gameInstance/new')
  @UseGuards(AuthGuard('jwt'))
  async startNewGame(
    @Body() dto: CreateNewGameDto,
    @Req() req: Request,
  ): Promise<ReadNewGameDto> {
    try {
      const userId = this.getUserId(req);
      if (!userId) {
        throw new UnauthorizedException('User ID not found in claims');
      }

      return await this.gamesService.startNewGame(dto, userId);
    } catch (err) {
      if (
        err instanceof UnauthorizedException ||
        err instanceof NotFoundException
      )
        throw err;
      if (err instanceof BadRequestException) throw err;
      throw new InternalServerErrorException(
        'An error occurred while starting a new game',
      );
    }
  }

  // GET: api/games/gameInstance/nextQuestion/:gameId
  @Get('gameInstance/nextQuestion/:gameId')
  async getNextQuestion(@Param('gameId', ParseUUIDPipe) gameId: string) {
    try {
      return await this.gamesService.getNextQuestion(gameId);
    } catch (err) {
      if (
        err instanceof NotFoundException ||
        err instanceof BadRequestException
      )
        throw err;
      throw new InternalServerErrorException(
        'An error occurred while fetching the next question',
      );
    }
  }

  // POST: api/games/gameInstance/checkAnswer/:gameId
  @Post('gameInstance/checkAnswer/:gameId')
  async checkAnswer(
    @Param('gameId', ParseUUIDPipe) gameId: string,
    @Body() body: { answerId: string },
  ): Promise<boolean> {
    try {
      return await this.gamesService.checkAnswer(gameId, body.answerId);
    } catch (err) {
      if (
        err instanceof NotFoundException ||
        err instanceof BadRequestException
      )
        throw err;
      throw new InternalServerErrorException(
        'An error occurred while checking the answer',
      );
    }
  }

  // POST: api/games/gameInstance/timeoutQuestion/:gameId
  @Post('gameInstance/timeoutQuestion/:gameId')
  async timeoutQuestion(
    @Param('gameId', ParseUUIDPipe) gameId: string,
  ): Promise<boolean> {
    try {
      return await this.gamesService.timeoutQuestion(gameId);
    } catch (err) {
      if (
        err instanceof NotFoundException ||
        err instanceof BadRequestException
      )
        throw err;
      throw new InternalServerErrorException(
        'An error occurred while timing out the question',
      );
    }
  }

  // GET: api/games/gameInstance/stats/:gameId
  @Get('gameInstance/stats/:gameId')
  @UseGuards(AuthGuard('jwt'))
  async getGameStats(
    @Param('gameId', ParseUUIDPipe) gameId: string,
    @Req() req: Request,
  ): Promise<ReadGameStatsDto> {
    try {
      const userId = this.getUserId(req);
      if (!userId) {
        throw new UnauthorizedException('User ID not found in claims');
      }

      return await this.gamesService.getGameStats(gameId, userId);
    } catch (err) {
      if (
        err instanceof UnauthorizedException ||
        err instanceof NotFoundException ||
        err instanceof BadRequestException
      )
        throw err;
      throw new InternalServerErrorException(
        'An error occurred while fetching game stats',
      );
    }
  }

  // GET: api/games/scoreboard
  @Get('/scoreboard')
  async getScoreboard(@Param('page') page: number): Promise<GameStats[]> {
    return this.gamesService.getScoreboard(page);
  }

  // GET: api/games
  @Get()
  async getGames(): Promise<Game[]> {
    return this.gamesService.getAllGames();
  }

  // GET: api/games/:id
  @Get(':id')
  async getGame(@Param('id', ParseUUIDPipe) id: string): Promise<Game> {
    const game = await this.gamesService.getGameById(id);
    if (!game) {
      throw new NotFoundException();
    }
    return game;
  }

  // PUT: api/games/:id
  @Put(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async putGame(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() game: Game,
  ): Promise<void> {
    const success = await this.gamesService.updateGame(id, game);
    if (!success) {
      throw new BadRequestException();
    }
  }

  // DELETE: api/games/:id
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteGame(@Param('id', ParseUUIDPipe) id: string): Promise<void> {
    const success = await this.gamesService.deleteGame(id);
    if (!success) {
      throw new NotFoundException();
    }
  }
}
