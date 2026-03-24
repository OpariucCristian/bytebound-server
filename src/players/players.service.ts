import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Player } from './entities/player.entity';
import { PlayerDto, UpdatePlayerDto } from './dto/player.dto';

@Injectable()
export class PlayersService {
  private readonly logger = new Logger(PlayersService.name);

  constructor(
    @InjectRepository(Player)
    private readonly playerRepo: Repository<Player>,
  ) {}

  async getAllPlayers(): Promise<PlayerDto[]> {
    const players = await this.playerRepo.find();
    return players.map((p) => ({
      uid: p.uid,
      createdAt: p.createdAt,
      lvl: Number(p.lvl),
      xp: Number(p.xp),
      neededXp: 0,
    }));
  }

  async getPlayerByUid(uid: string): Promise<PlayerDto | null> {
    const player = await this.playerRepo.findOne({
      where: { uid },
      relations: ['lvlNavigation'],
    });

    if (!player) return null;

    return {
      uid: player.uid,
      createdAt: player.createdAt,
      lvl: Number(player.lvl),
      xp: Number(player.xp),
      neededXp: player.lvlNavigation
        ? Number(player.lvlNavigation.neededXp)
        : null,
    };
  }

  async createPlayer(uid: string, userName: string): Promise<PlayerDto> {
    const player = this.playerRepo.create({
      uid,
      lvl: 1,
      xp: 0,
      userName,
      createdAt: new Date(),
    });

    await this.playerRepo.save(player);

    return {
      uid: player.uid,
      createdAt: player.createdAt,
      lvl: Number(player.lvl),
      xp: Number(player.xp),
      neededXp: null,
    };
  }

  async updatePlayer(uid: string, dto: UpdatePlayerDto): Promise<boolean> {
    const player = await this.playerRepo.findOneBy({ uid });
    if (!player) return false;

    if (dto.lvl !== undefined) {
      player.lvl = dto.lvl;
    }

    await this.playerRepo.save(player);
    return true;
  }

  async deletePlayer(uid: string): Promise<boolean> {
    const player = await this.playerRepo.findOneBy({ uid });
    if (!player) return false;

    await this.playerRepo.remove(player);
    return true;
  }
}
