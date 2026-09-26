import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Game } from './entities/game.entity';
import { GameQuestion } from './entities/game-question.entity';
import { GameStats } from './entities/game-stats.entity';
import { QuestionPoolAnswer } from '../questions/entities/question-pool-answer.entity';
import { Player } from '../players/entities/player.entity';
import { GamesService } from './games.service';
import { GamesController } from './games.controller';
import { Enemy } from 'src/enemies/entities/enemy.entity';
import { GamesGateway } from './games.gateway';
import { HeroSkill } from '../heroes/entities/hero-skill.entity';
import { AuthModule } from '../auth/auth.module';
import { PlayersModule } from '../players/players.module';
import { QuestionsModule } from '../questions/questions.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Game,
      GameQuestion,
      GameStats,
      QuestionPoolAnswer,
      Player,
      Enemy,
      HeroSkill,
    ]),
    AuthModule,
    PlayersModule,
    QuestionsModule,
  ],
  controllers: [GamesController],
  providers: [GamesService, GamesGateway],
  exports: [GamesService],
})
export class GamesModule {}
