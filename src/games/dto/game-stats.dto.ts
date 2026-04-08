export class ReadGameStatsDto {
  playerId: string;
  gameId: string;
  correctAnswers: number;
  correctAnswersStreakMax: number;
  wrongAnswers: number;
  xpGained: number;
  createdAt: Date;
}
