import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { HeroesService } from './heroes.service';
import { Hero } from './entities/hero.entity';
import { AuthGuard } from '@nestjs/passport';
import { PLAYER_AUTH } from '../auth/guest';

@UseGuards(AuthGuard(PLAYER_AUTH))
@Controller('api/heroes')
export class HeroesController {
  constructor(private readonly heroesService: HeroesService) {}

  @Get()
  findAll(): Promise<Hero[]> {
    return this.heroesService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string): Promise<Hero> {
    return this.heroesService.findOne(id);
  }
}
