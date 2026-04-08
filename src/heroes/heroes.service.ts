import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Hero } from './entities/hero.entity';

@Injectable()
export class HeroesService {
  constructor(
    @InjectRepository(Hero)
    private readonly heroRepo: Repository<Hero>,
  ) {}

  findAll(): Promise<Hero[]> {
    return this.heroRepo.find();
  }

  async findOne(id: string): Promise<Hero> {
    const hero = await this.heroRepo.findOne({ where: { id } });
    if (!hero) throw new NotFoundException(`Hero ${id} not found`);
    return hero;
  }
}
