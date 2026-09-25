import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Player } from './entities/player.entity';
import { Hero } from '../heroes/entities/hero.entity';
import { PlayersService } from './players.service';
import { PlayersController } from './players.controller';
import { GuestController } from './guest.controller';

@Module({
  imports: [TypeOrmModule.forFeature([Player, Hero])],
  controllers: [PlayersController, GuestController],
  providers: [PlayersService],
  exports: [PlayersService],
})
export class PlayersModule {}
