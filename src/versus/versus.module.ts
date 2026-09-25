import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from '../auth/auth.module';
import { Player } from '../players/entities/player.entity';
import { PlayersModule } from '../players/players.module';
import { QuestionPool } from '../questions/entities/question-pool.entity';
import { QuestionsModule } from '../questions/questions.module';
import { Match } from './entities/match.entity';
import { MatchPlayer } from './entities/match-player.entity';
import { MatchmakingService } from './matchmaking.service';
import { VersusController } from './versus.controller';
import { VersusGateway } from './versus.gateway';
import { VersusService } from './versus.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([Match, MatchPlayer, Player, QuestionPool]),
    AuthModule,
    PlayersModule,
    QuestionsModule,
  ],
  controllers: [VersusController],
  providers: [VersusService, VersusGateway, MatchmakingService],
})
export class VersusModule {}
