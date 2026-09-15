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
  const [open, setOpen] = useState(false);

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

  // --------------------------------------------------
  // Load learning memories
  // --------------------------------------------------

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

  // --------------------------------------------------
  // Generate quiz
  // --------------------------------------------------

  const generateQuiz = async () => {
    if (!selectedTopic) {
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
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          topic: selectedTopic,
        }),
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

  // --------------------------------------------------
  // Submit answer
  // --------------------------------------------------

  const submitAnswer = async () => {
    if (!quiz || !answer.trim()) {
      return;
    }

    try {
      setSubmitting(true);
      setError("");
      setNewAchievements([]);

      const response = await fetch("/api/quiz/answer", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
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

      // ----------------------------------------------
      // Newly earned achievements
      // ----------------------------------------------

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

  // --------------------------------------------------
  // Achievement icon
  // --------------------------------------------------

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

  // --------------------------------------------------
  // Evaluation label
  // --------------------------------------------------

  const getEvaluationLabel = () => {
    if (!result) {
      return "";
    }

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
    <div className="w-full">
      {/* Header */}

      <button
        type="button"
        onClick={() => setOpen((previous) => !previous)}
        className="flex w-full items-center justify-between border-b bg-white px-6 py-3 text-left hover:bg-gray-50"
      >
        <div>
          <h2 className="font-semibold">🧠 Practice Quiz</h2>

          <p className="text-sm text-gray-500">Test what you've learned</p>
        </div>

        <span className="text-lg">{open ? "▲" : "▼"}</span>
      </button>

      {/* Quiz content */}

      {open && (
        <div className="max-h-[500px] overflow-y-auto border-b bg-white px-6 py-4">
          {/* Topic selector */}

          <div className="mb-4">
            <label
              htmlFor="quiz-topic"
              className="mb-1 block text-sm font-medium"
            >
              Select Topic
            </label>

            <select
              id="quiz-topic"
              value={selectedTopic}
              onChange={(event) => setSelectedTopic(event.target.value)}
              className="w-full rounded-lg border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Select a topic</option>

              {memories.map((memory) => (
                <option key={memory.topic} value={memory.topic}>
                  {memory.topic}
                </option>
              ))}
            </select>
          </div>

          {/* Generate button */}

          <button
            type="button"
            onClick={generateQuiz}
            disabled={loading || !selectedTopic}
            className="w-full rounded-lg bg-black px-4 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loading ? "Generating..." : "Generate Quiz"}
          </button>

          {/* Error */}

          {error && (
            <div className="mt-3 rounded-lg bg-red-50 p-3 text-sm text-red-600">
              {error}
            </div>
          )}

          {/* Quiz */}

          {quiz && (
            <div className="mt-4 rounded-lg border p-4">
              {/* Difficulty */}

              {quiz.difficulty && (
                <div className="mb-2 text-xs font-medium uppercase text-gray-500">
                  Difficulty: {quiz.difficulty}
                </div>
              )}

              {/* Question */}

              <div className="mb-4">
                <div className="text-sm text-gray-500">Topic: {quiz.topic}</div>

                <h3 className="mt-1 font-semibold">{quiz.question}</h3>
              </div>

              {/* Answer */}

              {!result && (
                <>
                  <textarea
                    value={answer}
                    onChange={(event) => setAnswer(event.target.value)}
                    placeholder="Type your answer..."
                    rows={3}
                    className="w-full resize-none rounded-lg border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500"
                  />

                  <button
                    type="button"
                    onClick={submitAnswer}
                    disabled={submitting || !answer.trim()}
                    className="mt-3 w-full rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {submitting ? "Evaluating..." : "Submit Answer"}
                  </button>
                </>
              )}

              {/* Result */}

              {result && (
                <div className="mt-4">
                  <div
                    className={`rounded-lg p-4 ${
                      result.evaluation === "correct"
                        ? "bg-green-50"
                        : result.evaluation === "partially_correct"
                          ? "bg-yellow-50"
                          : "bg-red-50"
                    }`}
                  >
                    <div className="font-semibold">{getEvaluationLabel()}</div>

                    <div className="mt-1 text-sm">
                      Score:{" "}
                      <span className="font-semibold">{result.score}/100</span>
                    </div>

                    <div className="mt-2 text-sm">{result.feedback}</div>
                  </div>

                  {/* Correct answer */}

                  <div className="mt-3 rounded-lg bg-gray-50 p-3">
                    <div className="text-xs font-medium uppercase text-gray-500">
                      Correct Answer
                    </div>

                    <div className="mt-1 text-sm">{result.correctAnswer}</div>
                  </div>

                  {/* Performance */}

                  {performance && (
                    <div className="mt-3 grid grid-cols-2 gap-2">
                      <div className="rounded-lg bg-gray-50 p-3">
                        <div className="text-xs text-gray-500">Accuracy</div>

                        <div className="font-semibold">
                          {performance.accuracy}%
                        </div>
                      </div>

                      <div className="rounded-lg bg-gray-50 p-3">
                        <div className="text-xs text-gray-500">Mastery</div>

                        <div className="font-semibold capitalize">
                          {performance.masteryLevel}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Daily Goal */}

                  {dailyGoal && (
                    <div className="mt-3 rounded-lg border p-3">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium">
                          🎯 Daily Goal
                        </span>

                        <span className="text-sm text-gray-500">
                          {dailyGoal.completedQuestions} /{" "}
                          {dailyGoal.targetQuestions}
                        </span>
                      </div>

                      {dailyGoal.completed && (
                        <div className="mt-2 text-sm font-medium text-green-600">
                          🎉 Goal completed!
                        </div>
                      )}
                    </div>
                  )}

                  {/* Achievement Unlocked */}

                  {newAchievements.length > 0 && (
                    <div className="mt-4 rounded-xl border-2 border-yellow-300 bg-yellow-50 p-4">
                      <div className="text-center">
                        <div className="text-lg font-bold">
                          🎉 Achievement Unlocked!
                        </div>

                        <div className="mt-1 text-sm text-gray-600">
                          Great job! You earned a new badge.
                        </div>
                      </div>

                      <div className="mt-3 space-y-2">
                        {newAchievements.map((achievement) => (
                          <div
                            key={achievement.achievementKey}
                            className="flex items-center gap-3 rounded-lg bg-white p-3"
                          >
                            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-yellow-100 text-2xl">
                              {getAchievementIcon(achievement.achievementKey)}
                            </div>

                            <div>
                              <div className="font-semibold">
                                {achievement.achievementName}
                              </div>

                              <div className="text-sm text-gray-500">
                                {achievement.description}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Next quiz */}

                  <button
                    type="button"
                    onClick={generateQuiz}
                    disabled={loading}
                    className="mt-4 w-full rounded-lg border px-4 py-2 text-sm font-medium hover:bg-gray-50 disabled:opacity-50"
                  >
                    {loading ? "Generating..." : "Next Question"}
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
