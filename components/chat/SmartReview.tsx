"use client";

import { useEffect, useState } from "react";

interface ReviewTopic {
  id: string;
  topic: string;
  subject: string | null;
  grade: number | null;
  masteryLevel: string;
  questionsAsked: number;
  correctAnswers: number;
  incorrectAnswers: number;
  accuracy: number;
  nextReviewDate: string;
  reviewIntervalDays: number;
  isDue: boolean;
  priority: number;
  priorityLabel: string;
}

interface Quiz {
  topic: string;
  question: string;
  correctAnswer: string;
  difficulty: string;
}

interface QuizResult {
  isCorrect: boolean;
  evaluation: string;
  score: number;
  feedback: string;
  correctAnswer: string;
}

interface ReviewResult {
  result: QuizResult;
  performance: {
    questionsAsked: number;
    correctAnswers: number;
    incorrectAnswers: number;
    accuracy: number;
    masteryLevel: string;
  };
  review: {
    nextReviewDate: string;
    reviewIntervalDays: number;
  };
}

export default function SmartReview() {
  const [topics, setTopics] = useState<ReviewTopic[]>([]);
  const [loading, setLoading] = useState(true);

  const [quiz, setQuiz] = useState<Quiz | null>(null);
  const [quizLoading, setQuizLoading] = useState(false);

  const [selectedTopic, setSelectedTopic] = useState<string | null>(null);

  const [studentAnswer, setStudentAnswer] = useState("");

  const [submitting, setSubmitting] = useState(false);

  const [reviewResult, setReviewResult] = useState<ReviewResult | null>(null);

  useEffect(() => {
    loadSmartReview();
  }, []);

  // --------------------------------------------------
  // Load topics due for review
  // --------------------------------------------------

  async function loadSmartReview() {
    try {
      setLoading(true);

      const response = await fetch("/api/smart-review");

      if (!response.ok) {
        throw new Error("Failed to load smart review");
      }

      const data = await response.json();

      setTopics(data.reviewTopics ?? []);
    } catch (error) {
      console.error("Smart review error:", error);
    } finally {
      setLoading(false);
    }
  }

  // --------------------------------------------------
  // Generate review question
  // --------------------------------------------------

  async function startReview(topic: string) {
    try {
      setQuizLoading(true);
      setSelectedTopic(topic);
      setQuiz(null);
      setStudentAnswer("");
      setReviewResult(null);

      const response = await fetch("/api/quiz", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          topic,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to generate review quiz");
      }

      setQuiz(data.quiz);
    } catch (error) {
      console.error("Review quiz error:", error);
    } finally {
      setQuizLoading(false);
    }
  }

  // --------------------------------------------------
  // Submit review answer
  // --------------------------------------------------

  async function submitReviewAnswer() {
    if (!quiz || !studentAnswer.trim()) {
      return;
    }

    try {
      setSubmitting(true);
      setReviewResult(null);

      const response = await fetch("/api/quiz/answer", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          topic: quiz.topic,
          question: quiz.question,
          studentAnswer: studentAnswer.trim(),
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to submit review answer");
      }

      setReviewResult({
        result: data.result,
        performance: data.performance,
        review: data.review,
      });

      // Refresh Smart Review topics
      await loadSmartReview();
    } catch (error) {
      console.error("Review answer error:", error);
    } finally {
      setSubmitting(false);
    }
  }

  // --------------------------------------------------
  // Accuracy styling
  // --------------------------------------------------
  function getPriorityStyle(priority: number) {
    if (priority === 1) {
      return {
        label: "🔴 High Priority",
        className: "bg-red-100 text-red-700",
      };
    }

    if (priority === 2) {
      return {
        label: "🟠 Medium Priority",
        className: "bg-orange-100 text-orange-700",
      };
    }

    if (priority === 3) {
      return {
        label: "🟡 Review",
        className: "bg-yellow-100 text-yellow-700",
      };
    }

    return {
      label: "🟢 Strong",
      className: "bg-green-100 text-green-700",
    };
  }

  function getAccuracyClass(accuracy: number) {
    if (accuracy < 50) {
      return "text-red-600";
    }

    if (accuracy < 70) {
      return "text-orange-600";
    }

    if (accuracy < 90) {
      return "text-yellow-600";
    }

    return "text-green-600";
  }

  // --------------------------------------------------
  // Review message
  // --------------------------------------------------

  function getReviewMessage(topic: ReviewTopic) {
    if (topic.accuracy < 50) {
      return "Needs review today";
    }

    if (topic.accuracy < 70) {
      return "Review again soon";
    }

    if (topic.accuracy < 90) {
      return "Review in a few days";
    }

    return "Strong performance";
  }

  // --------------------------------------------------
  // Loading
  // --------------------------------------------------

  if (loading) {
    return (
      <div className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 text-sm text-slate-500">
        <div>Loading smart review...</div>
      </div>
    );
  }

  return (
    <div className="w-full">
      {topics.length === 0 ? (
        <div className="rounded-2xl border border-green-100 bg-green-50 p-5 text-sm text-green-700">
          <div className="font-semibold">🎉 You're all caught up!</div>
          <div className="mt-1">No topics are due for review right now.</div>
        </div>
      ) : (
        <div>
          <div className="mb-4 rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-semibold text-slate-900">
                Review topics that need attention
              </span>
              <span className="rounded-full bg-red-100 px-2.5 py-1 text-xs font-semibold text-red-600">
                {topics.length} {topics.length === 1 ? "topic" : "topics"} due
              </span>
            </div>

            <p className="mt-1 text-sm text-slate-600">
              Start with{" "}
              <span className="font-semibold text-slate-700">
                {topics[0].topic}
              </span>
            </p>
          </div>

          <div className="grid items-start gap-4 lg:grid-cols-2">
            {topics.map((topic) => (
              <div
                key={topic.id}
                className="self-start rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5"
              >
                {/* Topic header */}

                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="font-semibold text-gray-800">
                      {topic.topic}
                    </h3>

                    {topic.subject && (
                      <p className="text-xs text-gray-500">
                        {topic.subject}
                        {topic.grade ? ` • Grade ${topic.grade}` : ""}
                      </p>
                    )}

                    <div className="mt-2">
                      {(() => {
                        const priorityStyle = getPriorityStyle(topic.priority);

                        return (
                          <span
                            className={`inline-flex rounded-full px-2 py-1 text-[11px] font-semibold ${priorityStyle.className}`}
                          >
                            {priorityStyle.label}
                          </span>
                        );
                      })()}
                    </div>
                  </div>

                  <span
                    className={`text-sm font-semibold ${getAccuracyClass(
                      topic.accuracy,
                    )}`}
                  >
                    {topic.accuracy}%
                  </span>
                </div>

                {/* Review status */}

                <div className="mt-3 text-sm text-gray-600">
                  {getReviewMessage(topic)}
                </div>

                {/* Stats */}

                <div className="mt-3 grid grid-cols-3 gap-2 text-center">
                  <div className="rounded-xl bg-slate-50 p-3">
                    <div className="text-sm font-semibold text-gray-800">
                      {topic.questionsAsked}
                    </div>

                    <div className="text-[11px] text-gray-500">Questions</div>
                  </div>

                  <div className="rounded-xl bg-slate-50 p-3">
                    <div className="text-sm font-semibold text-gray-800">
                      {topic.correctAnswers}
                    </div>

                    <div className="text-[11px] text-gray-500">Correct</div>
                  </div>

                  <div className="rounded-xl bg-slate-50 p-3">
                    <div className="text-sm font-semibold text-gray-800">
                      {topic.reviewIntervalDays}d
                    </div>

                    <div className="text-[11px] text-gray-500">Interval</div>
                  </div>
                </div>

                {/* Review date */}

                <div className="mt-3 rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-600">
                  📅 Review date: {topic.nextReviewDate}
                </div>

                {/* Practice button */}

                <button
                  type="button"
                  onClick={() => startReview(topic.topic)}
                  disabled={quizLoading}
                  className="mt-4 w-full rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {quizLoading && selectedTopic === topic.topic
                    ? "Generating..."
                    : "🔄 Practice Now"}
                </button>

                {/* --------------------------------------------------
                      Generated Question
                  -------------------------------------------------- */}

                {selectedTopic === topic.topic && quiz && (
                  <div className="mt-4 rounded-2xl border border-blue-100 bg-blue-50/40 p-4">
                    <div className="text-xs font-semibold uppercase text-gray-500">
                      Smart Review Question
                    </div>

                    <div className="mt-2 text-base font-medium text-gray-800">
                      {quiz.question}
                    </div>

                    <div className="mt-2 text-xs text-gray-500">
                      Difficulty: {quiz.difficulty}
                    </div>

                    {/* Answer input */}

                    <textarea
                      value={studentAnswer}
                      onChange={(event) => setStudentAnswer(event.target.value)}
                      placeholder="Type your answer here..."
                      rows={3}
                      className="mt-4 w-full resize-none rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-800 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                    />

                    {/* Submit */}

                    <button
                      type="button"
                      onClick={submitReviewAnswer}
                      disabled={submitting || !studentAnswer.trim()}
                      className="mt-3 w-full rounded-xl bg-green-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-green-700 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {submitting ? "Checking Answer..." : "✅ Submit Answer"}
                    </button>

                    {/* --------------------------------------------------
                            Result
                        -------------------------------------------------- */}

                    {reviewResult && (
                      <div className="mt-4 space-y-3">
                        {/* Review completed */}

                        <div
                          className={`rounded-lg p-4 ${
                            reviewResult.result.isCorrect
                              ? "bg-green-50"
                              : "bg-red-50"
                          }`}
                        >
                          <div
                            className={`font-semibold ${
                              reviewResult.result.isCorrect
                                ? "text-green-700"
                                : "text-red-700"
                            }`}
                          >
                            {reviewResult.result.isCorrect
                              ? "🎉 Review completed!"
                              : "📚 Review completed — keep practicing!"}
                          </div>

                          <p className="mt-1 text-sm text-gray-600">
                            {quiz?.topic} has been reviewed successfully.
                          </p>

                          <div className="mt-3 text-sm text-gray-700">
                            <span className="font-semibold">Score:</span>{" "}
                            {reviewResult.result.score}%
                          </div>

                          <div className="mt-2 text-sm text-gray-700">
                            {reviewResult.result.feedback}
                          </div>
                        </div>

                        {/* Correct answer */}

                        <div className="rounded-lg bg-blue-50 p-3 text-sm text-blue-700">
                          <span className="font-semibold">Correct answer:</span>{" "}
                          {reviewResult.result.correctAnswer}
                        </div>

                        {/* Updated performance */}

                        <div className="grid grid-cols-2 gap-2">
                          <div className="rounded-lg bg-gray-50 p-3">
                            <div className="text-xs text-gray-500">
                              Accuracy
                            </div>

                            <div className="mt-1 font-semibold text-gray-800">
                              {reviewResult.performance.accuracy}%
                            </div>
                          </div>

                          <div className="rounded-lg bg-gray-50 p-3">
                            <div className="text-xs text-gray-500">Mastery</div>

                            <div className="mt-1 font-semibold capitalize text-gray-800">
                              {reviewResult.performance.masteryLevel}
                            </div>
                          </div>
                        </div>

                        {/* Next review */}

                        <div className="rounded-lg bg-purple-50 p-4 text-sm text-purple-700">
                          <div className="font-semibold">🔄 Next review</div>

                          <div className="mt-1">
                            📅 {reviewResult.review.nextReviewDate}
                          </div>

                          <div className="mt-1 text-xs">
                            Review interval:{" "}
                            {reviewResult.review.reviewIntervalDays} day
                            {reviewResult.review.reviewIntervalDays !== 1
                              ? "s"
                              : ""}
                          </div>
                        </div>

                        {/* Start another review */}

                        <button
                          type="button"
                          onClick={() => {
                            setQuiz(null);
                            setStudentAnswer("");
                            setReviewResult(null);
                            setSelectedTopic(null);
                          }}
                          className="w-full rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50"
                        >
                          🔄 Review Another Topic
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
