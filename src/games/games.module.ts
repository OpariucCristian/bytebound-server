import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Game } from './entities/game.entity';
import { GameQuestion } from './entities/game-question.entity';
import { GameStats } from './entities/game-stats.entity';
import { QuestionPool } from '../questions/entities/question-pool.entity';
import { QuestionPoolAnswer } from '../questions/entities/question-pool-answer.entity';
import { Player } from '../players/entities/player.entity';
import { Level } from '../levels/entities/level.entity';
import { GamesService } from './games.service';
import { GamesController } from './games.controller';
import { Enemy } from 'src/enemies/entities/enemy.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Game,
      GameQuestion,
      GameStats,
      QuestionPool,
      QuestionPoolAnswer,
      Player,
      Level,
      Enemy,
    ]),
  ],
  controllers: [GamesController],
  providers: [GamesService],
  exports: [GamesService],
})
export class GamesModule {}
