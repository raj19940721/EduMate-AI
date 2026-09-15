export type QuizDifficulty = "easy" | "medium" | "hard";

interface AdaptiveDifficultyParams {
  accuracy: number;
  masteryLevel: string;
  questionsAsked: number;
}

export function determineQuizDifficulty({
  accuracy,
  masteryLevel,
  questionsAsked,
}: AdaptiveDifficultyParams): QuizDifficulty {
  // Give the student some initial easy questions
  // before making difficulty decisions.
  if (questionsAsked < 3) {
    return "easy";
  }

  // Student is still learning the topic.
  if (masteryLevel === "learning") {
    if (accuracy < 50) {
      return "easy";
    }

    if (accuracy < 70) {
      return "easy";
    }

    return "medium";
  }

  // Student is practicing the topic.
  if (masteryLevel === "practicing") {
    if (accuracy < 60) {
      return "easy";
    }

    if (accuracy < 80) {
      return "medium";
    }

    return "hard";
  }

  // Student has mastered the topic.
  if (masteryLevel === "mastered") {
    if (accuracy >= 90) {
      return "hard";
    }

    if (accuracy >= 80) {
      return "medium";
    }

    return "easy";
  }

  // Safe fallback
  return "easy";
}