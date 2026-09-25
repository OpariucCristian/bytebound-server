/* eslint-disable @typescript-eslint/no-unused-vars */
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
import { ReadGameStatsDto } from './dto/game-stats.dto';
import type { Request } from 'express';
import { Game } from './entities/game.entity';
import { GameStats } from './entities/game-stats.entity';
import { getUserIdFromToken } from 'src/utils/utils';

@UseGuards(AuthGuard('jwt'))
@Controller('api/games')
export class GamesController {
  constructor(private readonly gamesService: GamesService) {}

  // GET: api/games/gameInstance/stats/:gameId
  @Get('gameInstance/stats/:gameId')
  @UseGuards(AuthGuard('jwt'))
  async getGameStats(
    @Param('gameId', ParseUUIDPipe) gameId: string,
    @Req() req: Request,
  ): Promise<ReadGameStatsDto> {
    try {
      const userId = getUserIdFromToken(req);
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

  // // GET: api/games
  // @Get()
  // async getGames(): Promise<Game[]> {
  //   return this.gamesService.getAllGames();
  // }

  // // GET: api/games/:id
  // @Get(':id')
  // async getGame(@Param('id', ParseUUIDPipe) id: string): Promise<Game> {
  //   const game = await this.gamesService.getGameById(id);
  //   if (!game) {
  //     throw new NotFoundException();
  //   }
  //   return game;
  // }

  // // PUT: api/games/:id
  // @Put(':id')
  // @HttpCode(HttpStatus.NO_CONTENT)
  // async putGame(
  //   @Param('id', ParseUUIDPipe) id: string,
  //   @Body() game: Game,
  // ): Promise<void> {
  //   const success = await this.gamesService.updateGame(id, game);
  //   if (!success) {
  //     throw new BadRequestException();
  //   }
  // }

  // // DELETE: api/games/:id
  // @Delete(':id')
  // @HttpCode(HttpStatus.NO_CONTENT)
  // async deleteGame(@Param('id', ParseUUIDPipe) id: string): Promise<void> {
  //   const success = await this.gamesService.deleteGame(id);
  //   if (!success) {
  //     throw new NotFoundException();
  //   }
  // }
}
