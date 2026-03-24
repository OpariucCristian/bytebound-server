import {
  Controller,
  Get,
  Param,
  ParseIntPipe,
  UseGuards,
  NotFoundException,
  InternalServerErrorException,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { LevelsService } from './levels.service';
import { LevelDto } from './dto/level.dto';

@UseGuards(AuthGuard('jwt'))
@Controller('api/levels')
export class LevelsController {
  constructor(private readonly levelsService: LevelsService) {}

  @Get()
  async getLevels(): Promise<LevelDto[]> {
    try {
      return await this.levelsService.getAllLevels();
    } catch {
      throw new InternalServerErrorException(
        'An error occurred while retrieving levels',
      );
    }
  }

  @Get(':lvl')
  async getLevel(@Param('lvl', ParseIntPipe) lvl: number): Promise<LevelDto> {
    try {
      const level = await this.levelsService.getLevelByLvl(lvl);
      if (!level) {
        throw new NotFoundException(`Level ${lvl} not found`);
      }
      return level;
    } catch (err) {
      if (err instanceof NotFoundException) throw err;
      throw new InternalServerErrorException(
        'An error occurred while retrieving the level',
      );
    }
  }
}
