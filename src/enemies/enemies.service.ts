import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Enemy } from './entities/enemy.entity';

@Injectable()
export class EnemiesService {
  constructor(
    @InjectRepository(Enemy)
    private readonly enemyRepo: Repository<Enemy>,
  ) {}

  findAll(): Promise<Enemy[]> {
    return this.enemyRepo.find();
  }

  async findOne(id: string): Promise<Enemy> {
    const enemy = await this.enemyRepo.findOne({ where: { id } });
    if (!enemy) throw new NotFoundException(`Enemy ${id} not found`);
    return enemy;
  }
}
