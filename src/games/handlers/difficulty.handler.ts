export class DifficultyHandler {
  static getDifficultyByCorrectQuestionsAsked(questionsAsked: number): number {
    if (questionsAsked > 5) {
      return 2;
    }
    return 1;
  }
}
