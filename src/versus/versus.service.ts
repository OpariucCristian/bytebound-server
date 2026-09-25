import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { Player } from '../players/entities/player.entity';
import { PlayersService } from '../players/players.service';
import { QuestionPool } from '../questions/entities/question-pool.entity';
import { QuestionsService } from '../questions/questions.service';
import { GameMode } from '../games/enums/game-mode.enum';
import { SocketError } from '../common/socket-utils';
import { Match } from './entities/match.entity';
import { MatchPlayer } from './entities/match-player.entity';
import { VersusStatsDto } from './dto/versus.dto';
import {
  Fighter,
  MatchResult,
  MatchSummary,
  VersusQuestion,
} from './versus.types';

@Injectable()
export class VersusService {
  constructor(
    private readonly dataSource: DataSource,
    @InjectRepository(Player)
    private readonly playerRepo: Repository<Player>,
    @InjectRepository(QuestionPool)
    private readonly questionRepo: Repository<QuestionPool>,
    @InjectRepository(Match)
    private readonly matchRepo: Repository<Match>,
    @InjectRepository(MatchPlayer)
    private readonly matchPlayerRepo: Repository<MatchPlayer>,
    private readonly questionsService: QuestionsService,
    private readonly playersService: PlayersService,
  ) {}

  /** Loads a player and their hero, ready to fight. */
  async getFighter(uid: string): Promise<Fighter> {
    const player = await this.playerRepo.findOne({
      where: { uid },
      relations: ['heroNavigation'],
    });
    if (!player) {
      throw new SocketError('Could not find your player');
    }
    const hero = player.heroNavigation;
    if (!hero) {
      throw new SocketError('Pick a hero before playing 1v1');
    }

    return {
      uid: player.uid,
      userName: player.userName,
      lvl: Number(player.lvl),
      hero: {
        id: hero.id,
        name: hero.name,
        spriteKey: hero.spriteKey,
        baseHealth: Number(hero.baseHealth),
        baseAttack: Number(hero.baseAttack ?? 1),
      },
    };
  }

  async assertCategoryPlayable(category: string): Promise<void> {
    const count = await this.questionRepo.count({ where: { category } });
    if (count === 0) {
      throw new SocketError(`There are no questions in "${category}" yet`);
    }
  }

  /**
   * A question for the round. If the category has nothing at this
   * difficulty, it falls back to easier ones.
   */
  async pickQuestion(
    category: string,
    difficulty: number,
    excludeIds: string[],
  ): Promise<VersusQuestion> {
    for (let d = difficulty; d >= 1; d--) {
      const question = await this.questionsService.pickRandom(
        category,
        d,
        excludeIds,
      );
      if (question) {
        return {
          id: question.id,
          text: question.text,
          answers: (question.questionPoolAnswers ?? []).map((a) => ({
            id: a.id,
            text: a.text,
            isCorrect: a.isCorrect ?? false,
          })),
        };
      }
    }
    throw new Error(`No questions for category ${category}`);
  }

  /** Stores a finished match and awards both players their XP. */
  async saveMatch(summary: MatchSummary): Promise<void> {
    await this.dataSource.transaction(async (manager) => {
      await manager.getRepository(Match).save({
        id: summary.matchId,
        finishedAt: new Date(),
        mode: GameMode.Endless,
        category: summary.category,
        source: summary.source,
        endReason: summary.reason,
        rounds: summary.rounds,
        winnerId: summary.winnerUid,
      });

      await manager.getRepository(MatchPlayer).save(
        summary.players.map((p) => ({
          matchId: summary.matchId,
          playerId: p.uid,
          heroId: p.heroId,
          livesLeft: p.livesLeft,
          correctAnswers: p.correctAnswers,
          wrongAnswers: p.wrongAnswers,
          xpGained: p.xpGained,
          result: p.result,
        })),
      );

      for (const p of summary.players) {
        if (p.xpGained > 0) {
          await this.playersService.awardXp(p.uid, p.xpGained, manager);
        }
      }
    });
  }

  async getStats(uid: string): Promise<VersusStatsDto> {
    const rows = await this.matchPlayerRepo
      .createQueryBuilder('mp')
      .select('mp.result', 'result')
      .addSelect('COUNT(*)', 'count')
      .where('mp.player_id = :uid', { uid })
      .groupBy('mp.result')
      .getRawMany<{ result: string; count: string }>();

    const count = (result: string) =>
      Number(rows.find((r) => r.result === result)?.count ?? 0);
    return { wins: count('win'), losses: count('loss'), draws: count('draw') };
  }

  /** A finished match, only for the two players who played it. */
  async getMatch(id: string, uid: string): Promise<MatchSummary> {
    const match = await this.matchRepo.findOne({
      where: { id },
      relations: ['players', 'players.player'],
    });
    if (!match || !match.players.some((p) => p.playerId === uid)) {
      throw new NotFoundException('Match not found');
    }

    return {
      matchId: match.id,
      category: match.category,
      source: match.source as MatchSummary['source'],
      reason: match.endReason as MatchSummary['reason'],
      winnerUid: match.winnerId,
      rounds: match.rounds,
      players: match.players.map((p) => ({
        uid: p.playerId,
        userName: p.player?.userName ?? '',
        heroId: p.heroId ?? '',
        livesLeft: p.livesLeft,
        correctAnswers: p.correctAnswers,
        wrongAnswers: p.wrongAnswers,
        xpGained: p.xpGained,
        result: p.result as MatchResult,
      })),
    };
  }
}
