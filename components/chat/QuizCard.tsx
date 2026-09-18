"use client";

import { useEffect, useState } from "react";

interface LearningMemory {
  topic: string;
  subject?: string | null;
  grade?: number | null;
  mastery_level?: string;
  questions_asked?: number;
  correct_answers?: number;
  incorrect_answers?: number;
  accuracy?: number;
}

interface Quiz {
  topic: string;
  question: string;
  correctAnswer: string;
  difficulty?: "easy" | "medium" | "hard";
}

interface QuizResult {
  isCorrect: boolean;
  evaluation: "correct" | "partially_correct" | "incorrect";
  score: number;
  feedback: string;
  correctAnswer: string;
}

interface Performance {
  questionsAsked: number;
  correctAnswers: number;
  incorrectAnswers: number;
  accuracy: number;
  masteryLevel: string;
}

interface DailyGoal {
  targetQuestions: number;
  completedQuestions: number;
  remainingQuestions: number;
  completed: boolean;
}

interface Achievement {
  achievementKey: string;
  achievementName: string;
  description: string;
}

export default function QuizCard() {
  const [memories, setMemories] = useState<LearningMemory[]>([]);
  const [selectedTopic, setSelectedTopic] = useState("");
  const [quiz, setQuiz] = useState<Quiz | null>(null);
  const [answer, setAnswer] = useState("");
  const [result, setResult] = useState<QuizResult | null>(null);
  const [performance, setPerformance] = useState<Performance | null>(null);
  const [dailyGoal, setDailyGoal] = useState<DailyGoal | null>(null);
  const [newAchievements, setNewAchievements] = useState<Achievement[]>([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const loadMemories = async () => {
      try {
        const response = await fetch("/api/learning-memory");
        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error || "Failed to load learning topics");
        }

        const loadedMemories = data.memories ?? [];
        setMemories(loadedMemories);

        if (loadedMemories.length > 0) {
          setSelectedTopic(loadedMemories[0].topic);
        }
      } catch (error) {
        console.error("Learning memory error:", error);
      }
    };

    loadMemories();
  }, []);

  const generateQuizForTopic = async (topic: string) => {
    if (!topic) {
      setError("Please select a learning topic first.");
      return;
    }

    try {
      setLoading(true);
      setError("");
      setResult(null);
      setPerformance(null);
      setDailyGoal(null);
      setNewAchievements([]);
      setAnswer("");

      const response = await fetch("/api/quiz", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ topic }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to generate quiz");
      }

      setQuiz(data.quiz);
    } catch (error) {
      console.error("Quiz generation error:", error);
      setError(
        error instanceof Error ? error.message : "Failed to generate quiz",
      );
    } finally {
      setLoading(false);
    }
  };

  const generateQuiz = async () => {
    if (!selectedTopic) {
      setError("Please select a learning topic first.");
      return;
    }

    await generateQuizForTopic(selectedTopic);
  };

  useEffect(() => {
    const handleStudyPlanQuiz = (event: Event) => {
      const customEvent = event as CustomEvent<{
        topic?: string;
        studyPlanId?: string;
      }>;
      const topic = customEvent.detail?.topic?.trim();
      if (!topic) return;

      setSelectedTopic(topic);
      setQuiz(null);
      setResult(null);
      setPerformance(null);
      setDailyGoal(null);
      setNewAchievements([]);
      setAnswer("");
      setError("");

      generateQuizForTopic(topic);
    };

    window.addEventListener("edumate:start-quiz", handleStudyPlanQuiz);
    return () =>
      window.removeEventListener("edumate:start-quiz", handleStudyPlanQuiz);
  }, []);

  const submitAnswer = async () => {
    if (!quiz || !answer.trim()) return;

    try {
      setSubmitting(true);
      setError("");
      setNewAchievements([]);

      const response = await fetch("/api/quiz/answer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          topic: quiz.topic,
          question: quiz.question,
          studentAnswer: answer.trim(),
          correctAnswer: quiz.correctAnswer,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to evaluate answer");
      }

      setResult(data.result);
      setPerformance(data.performance ?? null);
      setDailyGoal(data.dailyGoal ?? null);

      window.dispatchEvent(
        new CustomEvent("edumate:quiz-completed", {
          detail: { topic: quiz.topic },
        }),
      );

      setNewAchievements(data.achievements ?? []);
    } catch (error) {
      console.error("Quiz answer error:", error);
      setError(
        error instanceof Error ? error.message : "Failed to evaluate answer",
      );
    } finally {
      setSubmitting(false);
    }
  };

  const getAchievementIcon = (achievementKey: string) => {
    switch (achievementKey) {
      case "first_quiz":
        return "🏆";
      case "quiz_10":
        return "🧠";
      case "streak_3":
        return "🔥";
      case "daily_goal":
        return "🎯";
      case "topic_master":
        return "⭐";
      default:
        return "🏅";
    }
  };

  const getEvaluationLabel = () => {
    if (!result) return "";

    switch (result.evaluation) {
      case "correct":
        return "Correct! 🎉";
      case "partially_correct":
        return "Partially Correct 👍";
      case "incorrect":
        return "Not quite";
      default:
        return "";
    }
  };

  return (
    <div className="quiz-card">
      <div className="quiz-card__content">
        <div className="quiz-card__field">
          <label htmlFor="quiz-topic" className="quiz-card__label">
            Select Topic
          </label>
          <select
            id="quiz-topic"
            value={selectedTopic}
            onChange={(event) => setSelectedTopic(event.target.value)}
            className="quiz-card__select"
          >
            <option value="">Select a topic</option>
            {memories.map((memory) => (
              <option key={memory.topic} value={memory.topic}>
                {memory.topic}
              </option>
            ))}
          </select>
        </div>

        <button
          type="button"
          onClick={generateQuiz}
          disabled={loading || !selectedTopic}
          className="quiz-card__main-action"
        >
          {loading ? "Generating..." : "Generate Quiz"}
        </button>

        {error && <div className="quiz-card__alert">{error}</div>}

        {quiz && (
          <div className="quiz-card__question-panel">
            {quiz.difficulty && (
              <div className="quiz-card__difficulty">
                Difficulty: {quiz.difficulty}
              </div>
            )}

            <div className="quiz-card__question-meta">
              <div className="quiz-card__topic">Topic: {quiz.topic}</div>
              <h3>{quiz.question}</h3>
            </div>

            {!result && (
              <>
                <textarea
                  value={answer}
                  onChange={(event) => setAnswer(event.target.value)}
                  placeholder="Type your answer..."
                  rows={3}
                  className="quiz-card__textarea"
                />
                <button
                  type="button"
                  onClick={submitAnswer}
                  disabled={submitting || !answer.trim()}
                  className="quiz-card__submit"
                >
                  {submitting ? "Evaluating..." : "Submit Answer"}
                </button>
              </>
            )}

            {result && (
              <div className="quiz-card__result">
                <div
                  className={`quiz-card__result-header ${result.evaluation === "correct" ? "is-correct" : result.evaluation === "partially_correct" ? "is-partial" : "is-wrong"}`}
                >
                  <div className="quiz-card__result-title">
                    {getEvaluationLabel()}
                  </div>
                  <div className="quiz-card__result-score">
                    Score: <span>{result.score}/100</span>
                  </div>
                  <div className="quiz-card__result-feedback">
                    {result.feedback}
                  </div>
                </div>

                <div className="quiz-card__answer-box">
                  <div className="quiz-card__answer-label">Correct Answer</div>
                  <div>{result.correctAnswer}</div>
                </div>

                {performance && (
                  <div className="quiz-card__stats">
                    <div className="quiz-card__stat">
                      <div>Accuracy</div>
                      <strong>{performance.accuracy}%</strong>
                    </div>
                    <div className="quiz-card__stat">
                      <div>Mastery</div>
                      <strong>{performance.masteryLevel}</strong>
                    </div>
                  </div>
                )}

                {dailyGoal && (
                  <div className="quiz-card__daily-goal">
                    <div className="quiz-card__daily-goal-header">
                      <span>🎯 Daily Goal</span>
                      <span>
                        {dailyGoal.completedQuestions} /{" "}
                        {dailyGoal.targetQuestions}
                      </span>
                    </div>

                    {dailyGoal.completed && (
                      <div className="quiz-card__daily-goal-done">
                        🎉 Goal completed!
                      </div>
                    )}
                  </div>
                )}

                {newAchievements.length > 0 && (
                  <div className="quiz-card__achievement">
                    <div className="quiz-card__achievement-head">
                      <div>🎉 Achievement Unlocked!</div>
                      <div>Great job! You earned a new badge.</div>
                    </div>

                    <div className="quiz-card__achievement-list">
                      {newAchievements.map((achievement) => (
                        <div
                          key={achievement.achievementKey}
                          className="quiz-card__achievement-item"
                        >
                          <div className="quiz-card__achievement-icon">
                            {getAchievementIcon(achievement.achievementKey)}
                          </div>
                          <div>
                            <div className="quiz-card__achievement-name">
                              {achievement.achievementName}
                            </div>
                            <div className="quiz-card__achievement-description">
                              {achievement.description}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <button
                  type="button"
                  onClick={generateQuiz}
                  disabled={loading}
                  className="quiz-card__next-question"
                >
                  {loading ? "Generating..." : "Next Question"}
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
