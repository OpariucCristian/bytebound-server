/* eslint-disable @typescript-eslint/no-unused-vars */
import {
  Controller,
  Get,
  Put,
  Delete,
  Param,
  Body,
  UseGuards,
  Req,
  HttpCode,
  HttpStatus,
  NotFoundException,
  UnauthorizedException,
  InternalServerErrorException,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { PlayersService } from './players.service';
import { PlayerDto, UpdatePlayerDto } from './dto/player.dto';
import type { Request } from 'express';
import { getUserIdFromToken, getUserNameFromToken } from 'src/utils/utils';

@UseGuards(AuthGuard('jwt'))
@Controller('api/players')
export class PlayersController {
  constructor(private readonly playersService: PlayersService) {}

  // @Get()
  // async getPlayers(): Promise<PlayerDto[]> {
  //   try {
  //     return await this.playersService.getAllPlayers();
  //   } catch {
  //     throw new InternalServerErrorException(
  //       'An error occurred while retrieving players',
  //     );
  //   }
  // }

  @Get('me')
  async getCurrentPlayer(@Req() req: Request): Promise<PlayerDto> {
    const userId = getUserIdFromToken(req);
    if (!userId) {
      throw new UnauthorizedException('User ID not found in token');
    }

    const player = await this.playersService.getPlayerByUid(userId);
    if (!player) {
      throw new NotFoundException(
        `Player profile not found for user ${userId}`,
      );
    }
    return player;
  }

  @Get()
  async getPlayer(@Req() req: Request): Promise<PlayerDto> {
    try {
      const userId = getUserIdFromToken(req);
      if (!userId) {
        throw new UnauthorizedException('Player not found');
      }
      let player = await this.playersService.getPlayerByUid(userId);
      if (!player) {
        const userName = getUserNameFromToken(req);

        if (!userName) {
          throw new InternalServerErrorException(
            'An error occurred while retrieving the player',
          );
        }

        player = await this.playersService.createPlayer(userId, userName);
      }
      return player;
    } catch {
      throw new InternalServerErrorException(
        'An error occurred while retrieving the player',
      );
    }
  }

  // @Put(':uid')
  // @HttpCode(HttpStatus.NO_CONTENT)
  // async updatePlayer(
  //   @Param('uid') uid: string,
  //   @Body() dto: UpdatePlayerDto,
  // ): Promise<void> {
  //   const success = await this.playersService.updatePlayer(uid, dto);
  //   if (!success) {
  //     throw new NotFoundException(`Player with UID ${uid} not found`);
  //   }
  // }

  // @Delete(':uid')
  // @HttpCode(HttpStatus.NO_CONTENT)
  // async deletePlayer(@Param('uid') uid: string): Promise<void> {
  //   const success = await this.playersService.deletePlayer(uid);
  //   if (!success) {
  //     throw new NotFoundException(`Player with UID ${uid} not found`);
  //   }
  // }
}
