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
import { PlayersService } from '../players/players.service';
import { QuestionsService } from '../questions/questions.service';
import { GameState } from './enums/game-state.enum';
import { GameMode } from './enums/game-mode.enum';
import {
  CreateNewGameDto,
  ReadNewGameDto,
  QuestionPoolDto,
  QuestionPoolAnswerDto,
  AnswerResultDto,
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
    @InjectRepository(QuestionPoolAnswer)
    private readonly answerRepo: Repository<QuestionPoolAnswer>,
    @InjectRepository(Player)
    private readonly playerRepo: Repository<Player>,
    @InjectRepository(Enemy)
    private readonly enemyRepo: Repository<Enemy>,
    private readonly questionsService: QuestionsService,
    private readonly playersService: PlayersService,
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
      playerLives: game?.playerLives,
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

    const firstQuestion = await this.questionsService.pickRandom(
      dto.category ?? 'dsa',
      dto.difficulty ?? 1,
    );

    if (!firstQuestion) {
      throw new NotFoundException(
        `Could not find question with difficulty ${dto.difficulty} and category ${dto.category} to initialize the game`,
      );
    }

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
      type: dto.type ?? GameMode.Endless,
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
    if (
      currentGame.gameState !== GameState.Active ||
      currentGame.playerLives < 1
    ) {
      throw new BadRequestException('The game is no longer active');
    }

    let isDifficultyChange = false;
    if (currentGame.enemyLives <= 0) {
      // Past the hardest enemy, a fresh one of the same difficulty appears.
      const newEnemy =
        (await this.enemyRepo.findOne({
          where: { difficulty: currentGame.difficulty + 1 },
        })) ??
        (await this.enemyRepo.findOne({
          where: { difficulty: currentGame.difficulty },
        }));

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

    const nextQuestion = await this.questionsService.pickRandom(
      currentGame.category,
      currentGame.difficulty,
      askedQuestionIds,
    );
    if (!nextQuestion) {
      throw new NotFoundException('Failed to find a question to ask');
    }

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
  ): Promise<AnswerResultDto> {
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
    if (game.gameState !== GameState.Active || game.playerLives < 1) {
      throw new BadRequestException('The game is no longer active');
    }
    if (game.isCurrentQuestionAnswered) {
      throw new BadRequestException(
        'The current question has already been answered',
      );
    }
    if (answer.questionId !== game.currentQuestionId) {
      throw new BadRequestException(
        'The answer does not belong to the current question',
      );
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

    const correct = !isTimeout && (answer.isCorrect ?? false);

    if (correct) {
      stats.xpGained = stats.xpGained + 75;
      stats.correctAnswers += 1;
      stats.correctAnswersStreak += 1;

      game.enemyLives =
        game.enemyLives - (player?.heroNavigation?.baseAttack ?? 1);
    } else {
      await this.applyWrongAnswer(game, stats);
    }

    await this.gameStatsRepo.save(stats);
    await this.gameRepo.save(game);

    return this.toAnswerResult(game, correct);
  }

  /**
   * Resolves the current question as a wrong answer because the time ran out.
   * Returns null if the question was already answered (the answer and the
   * timer raced), in which case nothing is changed.
   */
  async timeoutQuestion(
    gameId: string,
    userId: string,
  ): Promise<AnswerResultDto | null> {
    const currentGame = await this.gameRepo.findOne({
      where: { id: gameId },
      relations: ['gameStats', 'enemyNavigation'],
    });

    if (!currentGame || !currentGame.gameStats) {
      throw new NotFoundException('Game or game stats not found');
    }

    if (currentGame?.playerId !== userId) {
      throw new UnauthorizedException(
        "The player timed out a question for a game they're not playing",
      );
    }

    if (
      currentGame.isCurrentQuestionAnswered ||
      currentGame.gameState !== GameState.Active
    ) {
      return null;
    }

    currentGame.isCurrentQuestionAnswered = true;
    await this.applyWrongAnswer(currentGame, currentGame.gameStats);

    await this.gameStatsRepo.save(currentGame.gameStats);
    await this.gameRepo.save(currentGame);

    return this.toAnswerResult(currentGame, false);
  }

  /** Restarts the answer window of the current question from `startedAt`. */
  async markQuestionStarted(
    gameId: string,
    userId: string,
    startedAt: Date,
  ): Promise<void> {
    await this.gameRepo.update(
      {
        id: gameId,
        playerId: userId,
        isCurrentQuestionAnswered: false,
        gameState: GameState.Active,
      },
      { currentQuestionTimestamp: startedAt },
    );
  }

  private async applyWrongAnswer(game: Game, stats: GameStats): Promise<void> {
    game.playerLives -= game.enemyNavigation?.baseAttack ?? 1;
    stats.wrongAnswers += 1;

    if (stats.correctAnswersStreak > stats.correctAnswersStreakMax) {
      stats.correctAnswersStreakMax = stats.correctAnswersStreak;
    }

    stats.correctAnswersStreak = 0;

    if (game.playerLives < 1) {
      game.playerLives = 0;
      await this.finishGame(game);
    }
  }

  private toAnswerResult(game: Game, correct: boolean): AnswerResultDto {
    return {
      correct,
      playerLives: game.playerLives,
      enemyLives: game.enemyLives,
      gameOver: game.gameState === GameState.Finished,
    };
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
    await this.playersService.awardXp(
      game.playerId,
      game.gameStats?.xpGained ?? 0,
    );
    game.gameState = GameState.Finished;
    return true;
  }
}
