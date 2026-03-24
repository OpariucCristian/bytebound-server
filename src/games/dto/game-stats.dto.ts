export class ReadGameStatsDto {
  playerId: string;
  correctAnswers: number;
  correctAnswersStreakMax: number;
  wrongAnswers: number;
  xpGained: number;
  createdAt: Date;
}
