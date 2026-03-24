import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Level } from './entities/level.entity';
import { LevelDto } from './dto/level.dto';

@Injectable()
export class LevelsService {
  private readonly logger = new Logger(LevelsService.name);

  constructor(
    @InjectRepository(Level)
    private readonly levelRepo: Repository<Level>,
  ) {}

  async getAllLevels(): Promise<LevelDto[]> {
    const levels = await this.levelRepo.find({ order: { lvl: 'ASC' } });
    return levels.map((l) => ({
      lvl: Number(l.lvl),
      createdAt: l.createdAt,
      neededXp: l.neededXp !== null ? Number(l.neededXp) : null,
    }));
  }

  async getLevelByLvl(lvl: number): Promise<LevelDto | null> {
    const level = await this.levelRepo.findOneBy({ lvl });
    if (!level) return null;

    return {
      lvl: Number(level.lvl),
      createdAt: level.createdAt,
      neededXp: level.neededXp !== null ? Number(level.neededXp) : null,
    };
  }
}
