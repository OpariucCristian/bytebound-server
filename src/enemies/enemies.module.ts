import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Enemy } from './entities/enemy.entity';

import { EnemiesController } from './enemies.controller';
import { EnemiesService } from './enemies.service';

@Module({
  imports: [TypeOrmModule.forFeature([Enemy])],
  controllers: [EnemiesController],
  providers: [EnemiesService],
  exports: [EnemiesService],
})
export class EnemiesModule {}
