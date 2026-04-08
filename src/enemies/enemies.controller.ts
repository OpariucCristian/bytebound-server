import { Controller, UseGuards } from '@nestjs/common';
import { EnemiesService } from './enemies.service';
import { AuthGuard } from '@nestjs/passport';

@UseGuards(AuthGuard('jwt'))
@Controller('api/heroes')
export class EnemiesController {
  constructor(private readonly enemiesService: EnemiesService) {}

  // @Get()
  // findAll(): Promise<Hero[]> {
  //   return this.heroesService.findAll();
  // }

  // @Get(':id')
  // findOne(@Param('id') id: string): Promise<Hero> {
  //   return this.heroesService.findOne(id);
  // }
}
