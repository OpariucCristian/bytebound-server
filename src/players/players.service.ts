import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, Repository } from 'typeorm';
import { Player } from './entities/player.entity';
import { Hero } from '../heroes/entities/hero.entity';
import { Level } from '../levels/entities/level.entity';
import { PlayerDto, UpdatePlayerDto } from './dto/player.dto';

@Injectable()
export class PlayersService {
  private readonly logger = new Logger(PlayersService.name);

  constructor(
    @InjectRepository(Player)
    private readonly playerRepo: Repository<Player>,
    @InjectRepository(Hero)
    private readonly heroRepo: Repository<Hero>,
  ) {}

  /**
   * Creates a player for a guest session. Guests skip the hero pick and start
   * as the sturdiest hero, so a first run forgives a few wrong answers.
   */
  async createGuestPlayer(uid: string, userName: string): Promise<void> {
    const hero = await this.heroRepo.findOne({
      where: {},
      order: { baseHealth: 'DESC', name: 'ASC' },
    });

    await this.playerRepo.save(
      this.playerRepo.create({
        uid,
        lvl: 1,
        xp: 0,
        userName,
        createdAt: new Date(),
        heroNavigation: hero ?? undefined,
      }),
    );
  }

  async getAllPlayers(): Promise<PlayerDto[]> {
    const players = await this.playerRepo.find({
      relations: ['heroNavigation'],
    });
    return players.map((p) => ({
      uid: p.uid,
      createdAt: p.createdAt,
      lvl: Number(p.lvl),
      xp: Number(p.xp),
      neededXp: 0,
      hero: p?.heroNavigation,
    }));
  }

  async getPlayerByUid(uid: string): Promise<PlayerDto | null> {
    const player = await this.playerRepo.findOne({
      where: { uid },
      relations: ['lvlNavigation', 'heroNavigation'],
    });

    if (!player) return null;
    console.log(player);
    return {
      uid: player.uid,
      createdAt: player.createdAt,
      lvl: Number(player.lvl),
      xp: Number(player.xp),
      neededXp: player.lvlNavigation
        ? Number(player.lvlNavigation.neededXp)
        : null,
      hero: player?.heroNavigation,
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
      hero: player?.heroNavigation,
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

  async assignHero(heroId: string, playerId: string): Promise<void> {
    const player = await this.playerRepo.findOne({ where: { uid: playerId } });

    if (!player) throw new NotFoundException(`Player not found`);
    player.heroNavigation = { id: heroId } as Hero;

    await this.playerRepo.save(player);
  }

  async deletePlayer(uid: string): Promise<boolean> {
    const player = await this.playerRepo.findOneBy({ uid });
    if (!player) return false;

    await this.playerRepo.remove(player);
    return true;
  }

  /**
   * Adds XP to a player, levelling them up as many times as it covers. Pass an
   * entity manager to run inside a caller's transaction.
   */
  async awardXp(
    uid: string,
    xp: number,
    manager: EntityManager = this.playerRepo.manager,
  ): Promise<Player> {
    const playerRepo = manager.getRepository(Player);
    const levelRepo = manager.getRepository(Level);

    const player = await playerRepo.findOneOrFail({ where: { uid } });

    let currentPlayerXp = Number(player.xp);
    let xpGained = xp;

    let playerCurrentLevel = await levelRepo.findOneOrFail({
      where: { lvl: player.lvl },
    });

    while (xpGained > 0) {
      const neededXp = playerCurrentLevel.neededXp ?? 0;
      const nextLevel =
        xpGained >= neededXp - currentPlayerXp
          ? await levelRepo.findOne({ where: { lvl: player.lvl + 1 } })
          : null;

      if (nextLevel) {
        xpGained -= neededXp - currentPlayerXp;
        player.lvl = nextLevel.lvl;
        player.xp = 0;
        currentPlayerXp = 0;
        playerCurrentLevel = nextLevel;
      } else {
        player.xp = currentPlayerXp + xpGained;
        xpGained = 0;
      }
    }

    return playerRepo.save(player);
  }
}
