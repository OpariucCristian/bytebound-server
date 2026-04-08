import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Game } from './entities/game.entity';
import { GameQuestion } from './entities/game-question.entity';
import { GameStats } from './entities/game-stats.entity';
import { QuestionPool } from '../questions/entities/question-pool.entity';
import { QuestionPoolAnswer } from '../questions/entities/question-pool-answer.entity';
import { Player } from '../players/entities/player.entity';
import { Level } from '../levels/entities/level.entity';
import { GameState } from './enums/game-state.enum';
import {
  CreateNewGameDto,
  ReadNewGameDto,
  QuestionPoolDto,
  QuestionPoolAnswerDto,
} from './dto/game.dto';
import { ReadGameStatsDto } from './dto/game-stats.dto';
import { v4 as uuidv4 } from 'uuid';
import { Enemy } from 'src/enemies/entities/enemy.entity';

@Injectable()
export class GamesService {
  private readonly logger = new Logger(GamesService.name);

  constructor(
    @InjectRepository(Game)
    private readonly gameRepo: Repository<Game>,
    @InjectRepository(GameQuestion)
    private readonly gameQuestionRepo: Repository<GameQuestion>,
    @InjectRepository(GameStats)
    private readonly gameStatsRepo: Repository<GameStats>,
    @InjectRepository(QuestionPool)
    private readonly questionRepo: Repository<QuestionPool>,
    @InjectRepository(QuestionPoolAnswer)
    private readonly answerRepo: Repository<QuestionPoolAnswer>,
    @InjectRepository(Player)
    private readonly playerRepo: Repository<Player>,
    @InjectRepository(Level)
    private readonly levelRepo: Repository<Level>,
    @InjectRepository(Enemy)
    private readonly enemyRepo: Repository<Enemy>,
  ) {}

  private toQuestionDto(
    question: QuestionPool,
    game?: Game,
    isDifficultyChange = false,
  ): QuestionPoolDto {
    return {
      id: question.id,
      createdAt: question.createdAt,
      text: question.text,
      category: question.category,
      difficulty:
        question.difficulty !== null ? Number(question.difficulty) : null,
      questionSeconds: game ? Number(game.questionSeconds) : undefined,
      isDifficultyChange,
      answers: (question.questionPoolAnswers ?? []).map(
        (a): QuestionPoolAnswerDto => ({
          id: a.id,
          text: a.text,
        }),
      ),
      enemy: isDifficultyChange ? (game?.enemyNavigation ?? null) : null,
      enemyLives: game?.enemyLives,
    };
  }

  async startNewGame(
    dto: CreateNewGameDto,
    userId: string,
  ): Promise<ReadNewGameDto> {
    const player = await this.playerRepo.findOne({
      where: { uid: userId },
      relations: ['heroNavigation'],
    });

    if (!player) {
      throw new NotFoundException(`Could not find player`);
    }
    // Cancel any active game for this player
    const runningGame = await this.gameRepo.findOne({
      where: { playerId: userId, gameState: GameState.Active },
    });
    if (runningGame) {
      runningGame.gameState = GameState.Cancelled;
      await this.gameRepo.save(runningGame);
    }

    // Find available questions
    const availableQuestions = await this.questionRepo.find({
      where: {
        difficulty: dto.difficulty ?? 1,
        category: dto.category ?? 'dsa',
      },
      relations: ['questionPoolAnswers'],
      take: 100,
    });

    if (availableQuestions.length === 0) {
      throw new NotFoundException(
        `Could not find question with difficulty ${dto.difficulty} and category ${dto.category} to initialize the game`,
      );
    }

    const randomIndex = Math.floor(Math.random() * availableQuestions.length);
    const firstQuestion = availableQuestions[randomIndex];

    const firstEnemy = await this.enemyRepo.findOne({
      where: { difficulty: dto.difficulty },
    });

    if (!firstEnemy || !firstEnemy.baseHealth) {
      throw new NotFoundException(
        `Failed to fetch an enemy of difficulty ${dto.difficulty}`,
      );
    }

    const gameId = uuidv4();

    const newGame = this.gameRepo.create({
      id: gameId,
      type: dto.type ?? 'endless',
      category: dto.category ?? 'dsa',
      difficulty: dto.difficulty ?? 1,
      gameState: GameState.Active,
      playerId: userId,
      createdAt: new Date(),
      currentQuestionId: firstQuestion.id,
      isCurrentQuestionAnswered: false,
      currentQuestionTimestamp: new Date(),
      questionSeconds: 15,
      playerLives: player.heroNavigation.baseHealth,
      enemyLives: firstEnemy.baseHealth,
      enemyNavigation: firstEnemy,
      xpGained: 0,
    });

    const newStats = this.gameStatsRepo.create({
      correctAnswers: 0,
      correctAnswersStreak: 0,
      correctAnswersStreakMax: 0,
      wrongAnswers: 0,
      xpGained: 0,
      gameId: gameId,
      playerId: userId,
    });

    const gameQuestion = this.gameQuestionRepo.create({
      questionId: firstQuestion.id,
      gameId: gameId,
    });

    await this.gameRepo.save(newGame);
    await this.gameStatsRepo.save(newStats);
    await this.gameQuestionRepo.save(gameQuestion);

    return {
      id: newGame.id,
      type: newGame.type,
      category: newGame.category,
      currentQuestionId: newGame.currentQuestionId,
      difficulty: newGame.difficulty,
      gameState: newGame.gameState,
      playerId: newGame.playerId,
      firstQuestion: this.toQuestionDto(firstQuestion, newGame),
      playerLives: newGame.playerLives,
      enemyLives: newGame.enemyNavigation.baseHealth ?? 5,
      enemy: newGame.enemyNavigation,
    };
  }

  async getNextQuestion(
    gameId: string,
    userId: string,
  ): Promise<QuestionPoolDto> {
    const currentGame = await this.gameRepo.findOne({
      where: { id: gameId },
    });
    if (!currentGame) {
      throw new NotFoundException(`Could not find game with id ${gameId}`);
    }
    if (currentGame.playerId !== userId) {
      throw new UnauthorizedException(
        "The player aksed for a question of a game they're not playing",
      );
    }

    if (!currentGame.isCurrentQuestionAnswered) {
      throw new BadRequestException(
        'The current question has not been answered',
      );
    }
    if (currentGame.playerLives < 1) {
      throw new BadRequestException('Player already lost the game');
    }

    let isDifficultyChange = false;
    console.log('Enemy lives:', currentGame.enemyLives);
    if (currentGame.enemyLives <= 0) {
      console.log('current difficulty to search', currentGame.difficulty + 1);
      const newEnemy = await this.enemyRepo.findOne({
        where: { difficulty: currentGame.difficulty + 1 },
      });

      if (newEnemy && newEnemy.baseHealth && newEnemy.difficulty) {
        currentGame.enemyNavigation = newEnemy;
        currentGame.enemyLives = newEnemy?.baseHealth;
        currentGame.difficulty = newEnemy?.difficulty;
      } else {
        throw new NotFoundException('Failed to find enemy for next difficulty');
      }

      isDifficultyChange = true;
    }

    // Get already asked question IDs for this game
    const askedQuestions = await this.gameQuestionRepo.find({
      where: { gameId },
      select: ['questionId'],
    });
    const askedQuestionIds = askedQuestions.map((gq) => gq.questionId);

    let availableQuestions = await this.questionRepo
      .createQueryBuilder('q')
      .leftJoinAndSelect('q.questionPoolAnswers', 'a')
      .where('q.difficulty = :difficulty', {
        difficulty: currentGame.difficulty,
      })
      .andWhere('q.category = :category', {
        category: currentGame.category,
      })
      .andWhere(
        askedQuestionIds.length > 0 ? 'q.id NOT IN (:...askedIds)' : '1=1',
        askedQuestionIds.length > 0 ? { askedIds: askedQuestionIds } : {},
      )
      .take(100)
      .getMany();

    if (availableQuestions.length === 0) {
      // Fallback: get any question within the params (allow repeats)
      availableQuestions = await this.questionRepo.find({
        where: {
          difficulty: currentGame.difficulty,
          category: currentGame.category,
        },
        relations: ['questionPoolAnswers'],
        take: 100,
      });
    }

    const randomIndex = Math.floor(Math.random() * availableQuestions.length);
    const nextQuestion = availableQuestions[randomIndex];

    currentGame.currentQuestionId = nextQuestion.id;
    currentGame.isCurrentQuestionAnswered = false;

    // Add time buffer for difficulty change animations
    if (isDifficultyChange) {
      const timestamp = new Date();
      timestamp.setSeconds(timestamp.getSeconds() + 3);
      currentGame.currentQuestionTimestamp = timestamp;
    } else {
      currentGame.currentQuestionTimestamp = new Date();
    }

    const gameQuestion = this.gameQuestionRepo.create({
      questionId: nextQuestion.id,
      gameId: currentGame.id,
    });

    await this.gameQuestionRepo.save(gameQuestion);
    await this.gameRepo.save(currentGame);

    return this.toQuestionDto(nextQuestion, currentGame, isDifficultyChange);
  }

  async checkAnswer(
    gameId: string,
    answerId: string,
    userId: string,
  ): Promise<boolean> {
    const answer = await this.answerRepo.findOne({
      where: { id: answerId },
    });
    const game = await this.gameRepo.findOne({
      where: { id: gameId },
      relations: ['gameStats', 'enemyNavigation'],
    });

    const player = await this.playerRepo.findOne({
      where: { uid: userId },
      relations: ['heroNavigation'],
    });

    if (game?.playerId !== userId) {
      throw new UnauthorizedException(
        "The player checked an answer for a game they're not playing",
      );
    }

    if (!answer) {
      throw new NotFoundException(`Could not find answer with id ${answerId}`);
    }
    if (!game) {
      throw new NotFoundException(`Could not find game with id ${gameId}`);
    }
    if (game.playerLives < 1) {
      throw new BadRequestException('Player already lost the game');
    }

    // Check for timeout (1 second buffer)
    const questionDeadline = new Date(game.currentQuestionTimestamp);
    questionDeadline.setSeconds(
      questionDeadline.getSeconds() + Number(game.questionSeconds) + 1,
    );
    const isTimeout = new Date() > questionDeadline;

    game.isCurrentQuestionAnswered = true;

    const stats = game.gameStats;
    if (!stats) {
      throw new NotFoundException('Game stats not found');
    }

    if (!answer.isCorrect || isTimeout) {
      game.playerLives -= game.enemyNavigation.baseAttack;
      stats.wrongAnswers += 1;

      if (stats.correctAnswersStreak > stats.correctAnswersStreakMax) {
        stats.correctAnswersStreakMax = stats.correctAnswersStreak;
      }

      stats.correctAnswersStreak = 0;

      if (game.playerLives < 1) {
        await this.finishGame(game);
      }
    } else {
      stats.xpGained = stats.xpGained + 75;
      stats.correctAnswers += 1;
      stats.correctAnswersStreak += 1;

      game.enemyLives =
        game.enemyLives - (player?.heroNavigation?.baseAttack ?? 1);
    }

    await this.gameStatsRepo.save(stats);
    await this.gameRepo.save(game);

    return isTimeout ? false : (answer.isCorrect ?? false);
  }

  async timeoutQuestion(gameId: string, userId: string): Promise<boolean> {
    const currentGame = await this.gameRepo.findOne({
      where: { id: gameId },
      relations: ['gameStats'],
    });

    if (!currentGame || !currentGame.gameStats) {
      throw new NotFoundException('Game or game stats not found');
    }

    if (currentGame?.playerId !== userId) {
      throw new UnauthorizedException(
        "The player timed out a question for a game they're not playing",
      );
    }

    currentGame.isCurrentQuestionAnswered = true;

    if (
      currentGame.gameStats.correctAnswersStreak >
      currentGame.gameStats.correctAnswersStreakMax
    ) {
      currentGame.gameStats.correctAnswersStreakMax =
        currentGame.gameStats.correctAnswersStreak;
    }

    currentGame.gameStats.correctAnswersStreak = 0;

    if (currentGame.playerLives < 2) {
      await this.finishGame(currentGame);
      await this.gameStatsRepo.save(currentGame.gameStats);
      await this.gameRepo.save(currentGame);
      return true;
    }

    currentGame.playerLives -= 1;

    await this.gameStatsRepo.save(currentGame.gameStats);
    await this.gameRepo.save(currentGame);

    return true;
  }

  async getGameStats(
    gameId: string,
    userId: string,
  ): Promise<ReadGameStatsDto> {
    const game = await this.gameRepo.findOne({
      where: { id: gameId },
      relations: ['gameStats'],
    });

    if (!game) {
      throw new NotFoundException(`Could not find game with id ${gameId}`);
    }

    if (game.playerId !== userId) {
      throw new BadRequestException("Requestor and player don't match");
    }

    if (!game.gameStats) {
      throw new NotFoundException('Game stats not found');
    }

    return game.gameStats;
  }

  async getScoreboard(page: number = 0): Promise<GameStats[]> {
    const scoreboard = await this.gameStatsRepo.find({
      take: 10,
      skip: page * 10,
      order: { correctAnswers: 'DESC' },
      relations: ['player'],
    });

    return scoreboard;
  }

  private async finishGame(game: Game): Promise<boolean> {
    const player = await this.playerRepo.findOneOrFail({
      where: { uid: game.playerId },
    });

    let currentPlayerXp = Number(player.xp);
    let xpGained = game.gameStats?.xpGained ?? 0;

    let playerCurrentLevel = await this.levelRepo.findOneOrFail({
      where: { lvl: player.lvl },
    });

    while (xpGained > 0) {
      const neededXp = playerCurrentLevel.neededXp ?? 0;
      if (xpGained >= neededXp - currentPlayerXp) {
        xpGained -= neededXp - currentPlayerXp;
        const nextLevel = await this.levelRepo.findOneOrFail({
          where: { lvl: player.lvl + 1 },
        });
        player.lvl = nextLevel.lvl;
        player.xp = 0;
        currentPlayerXp = 0;
        playerCurrentLevel = nextLevel;
      } else {
        player.xp = player.xp + xpGained;
        xpGained = 0;
      }
    }

    game.gameState = GameState.Finished;
    await this.playerRepo.save(player);
    return true;
  }
}
