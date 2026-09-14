"use client";

import { useEffect, useState } from "react";

interface LearningMemory {
  id: string;
  topic: string;
  subject: string | null;
  grade: number | null;
  mastery_level: string;
  questions_asked: number;
  correct_answers: number;
  incorrect_answers: number;
  accuracy: number;
  notes: string | null;
}

interface Quiz {
  topic: string;
  question: string;
  correctAnswer: string;
}

interface QuizPerformance {
  questionsAsked: number;
  correctAnswers: number;
  incorrectAnswers: number;
  accuracy: number;
  masteryLevel: string;
}

export default function QuizCard() {
  const [quizOpen, setQuizOpen] = useState(false);
  const [memories, setMemories] = useState<LearningMemory[]>([]);
  const [selectedTopic, setSelectedTopic] = useState("");

  const [quiz, setQuiz] = useState<Quiz | null>(null);
  const [answer, setAnswer] = useState("");

  const [result, setResult] = useState<{
    isCorrect: boolean;
    correctAnswer: string;
  } | null>(null);

  const [performance, setPerformance] = useState<QuizPerformance | null>(null);

  const [loadingMemories, setLoadingMemories] = useState(true);
  const [loadingQuiz, setLoadingQuiz] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const [error, setError] = useState("");

  // ----------------------------------------
  // Load learning memories
  // ----------------------------------------
  useEffect(() => {
    const loadMemories = async () => {
      try {
        setLoadingMemories(true);
        setError("");

        const response = await fetch("/api/learning-memory");

        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error || "Failed to load learning memories");
        }

        const loadedMemories = data.memories ?? [];

        setMemories(loadedMemories);

        // Select the first topic by default
        if (loadedMemories.length > 0) {
          setSelectedTopic(loadedMemories[0].topic);
        }
      } catch (error) {
        console.error("Failed to load learning memories:", error);

        setError(
          error instanceof Error
            ? error.message
            : "Failed to load learning memories",
        );
      } finally {
        setLoadingMemories(false);
      }
    };

    loadMemories();
  }, []);

  // ----------------------------------------
  // Generate quiz
  // ----------------------------------------
  async function generateQuiz() {
    if (!selectedTopic) {
      return;
    }

    setLoadingQuiz(true);
    setError("");
    setResult(null);
    setAnswer("");

    try {
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

      setPerformance({
        questionsAsked: data.learningMemory?.questionsAsked ?? 0,
        correctAnswers: 0,
        incorrectAnswers: 0,
        accuracy: data.learningMemory?.accuracy ?? 0,
        masteryLevel: data.learningMemory?.masteryLevel ?? "learning",
      });
    } catch (error) {
      console.error("Quiz generation failed:", error);

      setError(
        error instanceof Error ? error.message : "Failed to generate quiz",
      );
    } finally {
      setLoadingQuiz(false);
    }
  }

  // ----------------------------------------
  // Submit answer
  // ----------------------------------------
  async function submitAnswer() {
    if (!quiz || !answer.trim()) {
      return;
    }

    setSubmitting(true);
    setError("");

    try {
      const response = await fetch("/api/quiz/answer", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          topic: quiz.topic,
          studentAnswer: answer,
          correctAnswer: quiz.correctAnswer,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to submit answer");
      }

      setResult({
        isCorrect: data.result.isCorrect,
        correctAnswer: data.result.correctAnswer,
      });

      setPerformance({
        questionsAsked: data.performance.questionsAsked,
        correctAnswers: data.performance.correctAnswers,
        incorrectAnswers: data.performance.incorrectAnswers,
        accuracy: data.performance.accuracy,
        masteryLevel: data.performance.masteryLevel,
      });
    } catch (error) {
      console.error("Answer submission failed:", error);

      setError(
        error instanceof Error ? error.message : "Failed to submit answer",
      );
    } finally {
      setSubmitting(false);
    }
  }

  // ----------------------------------------
  // Select another topic
  // ----------------------------------------
  function handleTopicChange(topic: string) {
    setSelectedTopic(topic);

    setQuiz(null);
    setAnswer("");
    setResult(null);
    setPerformance(null);
    setError("");
  }

  return (
    <div className="w-full border-t bg-white">
      {/* Quiz Header */}
      <button
        type="button"
        onClick={() => setQuizOpen((previous) => !previous)}
        className="flex w-full items-center justify-between px-6 py-3 text-left hover:bg-gray-50"
      >
        <div>
          <h2 className="font-semibold">🧠 Practice Quiz</h2>

          <p className="text-sm text-gray-500">Test what you have learned</p>
        </div>

        <span className="text-lg">{quizOpen ? "▲" : "▼"}</span>
      </button>

      {/* Quiz Content */}
      {quizOpen && (
        <div className="max-h-[360px] overflow-y-auto border-t px-6 py-4">
          {/* Loading memories */}
          {loadingMemories && (
            <p className="text-sm text-gray-500">
              Loading your learning topics...
            </p>
          )}

          {/* No memories */}
          {!loadingMemories && memories.length === 0 && (
            <p className="text-sm text-gray-500">
              No learning topics available yet. Learn a topic with EduMate
              first.
            </p>
          )}

          {/* Topic selection */}
          {!loadingMemories && memories.length > 0 && !quiz && (
            <div>
              <p className="mb-3 font-medium">Choose a topic to practice:</p>

              <div className="space-y-2">
                {memories.map((memory) => (
                  <button
                    key={memory.id}
                    type="button"
                    onClick={() => handleTopicChange(memory.topic)}
                    className={`w-full rounded-lg border p-3 text-left transition ${
                      selectedTopic === memory.topic
                        ? "border-blue-500 bg-blue-50"
                        : "border-gray-200 hover:bg-gray-50"
                    }`}
                  >
                    <div className="font-semibold">{memory.topic}</div>

                    <div className="text-sm text-gray-500">
                      {memory.subject ?? "General"}
                      {" · "}
                      {memory.mastery_level}
                      {" · "}
                      Accuracy: {memory.accuracy ?? 0}%
                    </div>
                  </button>
                ))}
              </div>

              <button
                type="button"
                onClick={generateQuiz}
                disabled={loadingQuiz || !selectedTopic}
                className="mt-4 rounded-lg bg-black px-5 py-2.5 text-white disabled:cursor-not-allowed disabled:opacity-50"
              >
                {loadingQuiz ? "Generating..." : "Start Quiz"}
              </button>
            </div>
          )}

          {/* Quiz question */}
          {quiz && (
            <div>
              <div className="mb-3 rounded-lg bg-gray-50 p-3">
                <p className="text-xs text-gray-500">Topic</p>

                <p className="font-semibold">{quiz.topic}</p>
              </div>

              <h3 className="text-lg font-semibold">{quiz.question}</h3>

              <input
                type="text"
                value={answer}
                onChange={(event) => setAnswer(event.target.value)}
                placeholder="Type your answer..."
                disabled={!!result || submitting}
                className="mt-3 w-full rounded-lg border px-4 py-2.5 outline-none focus:border-blue-500"
              />

              {!result && (
                <button
                  type="button"
                  onClick={submitAnswer}
                  disabled={submitting || !answer.trim()}
                  className="mt-3 rounded-lg bg-black px-5 py-2.5 text-white disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {submitting ? "Checking..." : "Submit Answer"}
                </button>
              )}

              {/* Result */}
              {result && (
                <div className="mt-4 rounded-lg bg-gray-50 p-3">
                  {result.isCorrect ? (
                    <p className="font-medium">✅ Correct! Great job!</p>
                  ) : (
                    <p className="font-medium">
                      ❌ Not quite.
                      <br />
                      Correct answer: <strong>{result.correctAnswer}</strong>
                    </p>
                  )}

                  <div className="mt-3 flex gap-2">
                    <button
                      type="button"
                      onClick={generateQuiz}
                      className="rounded-lg bg-black px-4 py-2 text-white"
                    >
                      Next Question
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setQuiz(null);
                        setAnswer("");
                        setResult(null);
                        setPerformance(null);
                      }}
                      className="rounded-lg border px-4 py-2"
                    >
                      Change Topic
                    </button>
                  </div>
                </div>
              )}

              {/* Performance */}
              {performance && (
                <div className="mt-4 rounded-lg border p-3">
                  <h3 className="font-semibold">📊 Your Progress</h3>

                  <div className="mt-2 space-y-1 text-sm">
                    <p>Questions: {performance.questionsAsked}</p>

                    <p>Correct: {performance.correctAnswers}</p>

                    <p>Incorrect: {performance.incorrectAnswers}</p>

                    <p>Accuracy: {performance.accuracy}%</p>

                    <p>Mastery: {performance.masteryLevel}</p>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Error */}
          {error && <p className="mt-3 text-sm text-red-600">❌ {error}</p>}
        </div>
      )}
    </div>
  );
}
