import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Level } from './entities/level.entity';
import { LevelsService } from './levels.service';
import { LevelsController } from './levels.controller';

@Module({
  imports: [TypeOrmModule.forFeature([Level])],
  controllers: [LevelsController],
  providers: [LevelsService],
  exports: [LevelsService],
})
export class LevelsModule {}
