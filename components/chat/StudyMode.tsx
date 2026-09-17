"use client";

import { useState } from "react";

interface StudyModeResult {
  questionId: string;
  topic: string;
  subject: string;
  explanation: string;
  keyIdeas: string[];
  example: string;
  question: string;
  encouragement: string;
}

interface AnswerResult {
  evaluation: "correct" | "partial" | "incorrect";
  score: number;
  feedback: string;
  isCorrect: boolean;
}

interface Performance {
  topic: string;
  accuracy: number;
  masteryLevel: string;
  questionsAsked: number;
  correctAnswers: number;
  incorrectAnswers: number;
}

export default function StudyMode() {
  const [isOpen, setIsOpen] = useState(false);

  const [topic, setTopic] = useState("");
  const [subject, setSubject] = useState("Science");

  const [study, setStudy] =
    useState<StudyModeResult | null>(null);

  const [studentAnswer, setStudentAnswer] = useState("");
  const [answerResult, setAnswerResult] =
    useState<AnswerResult | null>(null);
  const [performance, setPerformance] =
    useState<Performance | null>(null);

  const [loading, setLoading] = useState(false);
  const [checkingAnswer, setCheckingAnswer] =
    useState(false);
  const [error, setError] = useState("");

  async function startStudy(
    studyTopic = topic,
    studySubject = subject
  ) {
    const normalizedTopic = studyTopic.trim();

    if (!normalizedTopic) {
      setError("Please enter a topic to study.");
      return;
    }

    if (normalizedTopic.length > 200) {
      setError(
        "Please keep the topic under 200 characters."
      );
      return;
    }

    setLoading(true);
    setError("");
    setStudy(null);
    setStudentAnswer("");
    setAnswerResult(null);
    setPerformance(null);

    try {
      const response = await fetch("/api/study-mode", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          topic: normalizedTopic,
          subject: studySubject.trim(),
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(
          data.error ||
            data.message ||
            "Failed to start Study Mode."
        );
        return;
      }

      if (data.blocked) {
        setError(
          data.message ||
            "I can't help with that request."
        );
        return;
      }

      const result = data.study;

      if (
        !result ||
        typeof result !== "object" ||
        typeof result.questionId !== "string" ||
        !result.questionId.trim() ||
        typeof result.explanation !== "string" ||
        !Array.isArray(result.keyIdeas) ||
        typeof result.example !== "string" ||
        typeof result.question !== "string" ||
        typeof result.encouragement !== "string"
      ) {
        setError(
          "EduMate returned an invalid study response."
        );
        return;
      }

      const keyIdeas = result.keyIdeas
        .filter(
          (item: unknown): item is string =>
            typeof item === "string"
        )
        .map((item: string) => item.trim())
        .filter(Boolean)
        .slice(0, 5);

      if (keyIdeas.length === 0) {
        setError(
          "EduMate did not return any key ideas."
        );
        return;
      }

      setStudy({
        questionId: result.questionId.trim(),
        topic:
          typeof result.topic === "string" &&
          result.topic.trim()
            ? result.topic.trim()
            : normalizedTopic,
        subject:
          typeof result.subject === "string" &&
          result.subject.trim()
            ? result.subject.trim()
            : studySubject,
        explanation: result.explanation.trim(),
        keyIdeas,
        example: result.example.trim(),
        question: result.question.trim(),
        encouragement:
          result.encouragement.trim(),
      });

      // Keep the UI topic/subject synchronized with
      // the current Study Mode session.
      setTopic(normalizedTopic);
      setSubject(studySubject);
    } catch (error) {
      console.error(
        "Study Mode request error:",
        error
      );

      setError(
        "Something went wrong. Please try again."
      );
    } finally {
      setLoading(false);
    }
  }

  async function checkAnswer() {
    if (!study) {
      return;
    }

    const normalizedAnswer =
      studentAnswer.trim();

    if (!normalizedAnswer) {
      setError("Please enter your answer first.");
      return;
    }

    if (normalizedAnswer.length > 1000) {
      setError(
        "Please keep your answer under 1,000 characters."
      );
      return;
    }

    setCheckingAnswer(true);
    setError("");
    setAnswerResult(null);
    setPerformance(null);

    try {
      const response = await fetch(
        "/api/study-mode/answer",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            questionId: study.questionId,
            studentAnswer: normalizedAnswer,
          }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        setError(
          data.error ||
            data.message ||
            "Failed to check your answer."
        );
        return;
      }

      if (
        !data.result ||
        typeof data.result.evaluation !== "string" ||
        typeof data.result.score !== "number" ||
        typeof data.result.feedback !== "string"
      ) {
        setError(
          "EduMate returned an invalid answer response."
        );
        return;
      }

      setAnswerResult({
        evaluation:
          data.result.evaluation,
        score: data.result.score,
        feedback:
          data.result.feedback.trim(),
        isCorrect:
          data.result.isCorrect === true ||
          data.result.evaluation === "correct",
      });

      if (
        data.performance &&
        typeof data.performance === "object"
      ) {
        setPerformance({
          topic:
            typeof data.performance.topic === "string"
              ? data.performance.topic
              : study.topic,
          accuracy:
            typeof data.performance.accuracy === "number"
              ? data.performance.accuracy
              : 0,
          masteryLevel:
            typeof data.performance.masteryLevel ===
            "string"
              ? data.performance.masteryLevel
              : "learning",
          questionsAsked:
            typeof data.performance.questionsAsked ===
            "number"
              ? data.performance.questionsAsked
              : 0,
          correctAnswers:
            typeof data.performance.correctAnswers ===
            "number"
              ? data.performance.correctAnswers
              : 0,
          incorrectAnswers:
            typeof data.performance.incorrectAnswers ===
            "number"
              ? data.performance.incorrectAnswers
              : 0,
        });
      }
    } catch (error) {
      console.error(
        "Study Mode answer request error:",
        error
      );

      setError(
        "Something went wrong while checking your answer."
      );
    } finally {
      setCheckingAnswer(false);
    }
  }

  async function nextQuestion() {
    if (!study) {
      return;
    }

    await startStudy(
      study.topic,
      study.subject
    );
  }

  function clearStudy() {
    setTopic("");
    setStudy(null);
    setStudentAnswer("");
    setAnswerResult(null);
    setPerformance(null);
    setError("");
  }

  return (
    <div className="border-t bg-white">
      {/* Header */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="flex w-full items-center justify-between px-6 py-4 text-left hover:bg-gray-50"
      >
        <div>
          <h2 className="text-base font-semibold text-gray-900">
            📚 Study Mode
          </h2>

          <p className="mt-1 text-sm text-gray-500">
            Learn a topic step by step with EduMate
          </p>
        </div>

        <span className="text-gray-500">
          {isOpen ? "▲" : "▼"}
        </span>
      </button>

      {isOpen && (
        <div className="px-6 pb-6">
          {/* Topic */}
          <div className="mb-4">
            <label className="mb-2 block text-sm font-medium text-gray-700">
              Topic
            </label>

            <input
              type="text"
              value={topic}
              onChange={(e) => {
                setTopic(e.target.value);
                setError("");
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !loading) {
                  e.preventDefault();
                  void startStudy();
                }
              }}
              placeholder="Example: Photosynthesis"
              maxLength={200}
              className="w-full rounded-lg border border-gray-300 p-3 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
            />
          </div>

          {/* Subject */}
          <div className="mb-4">
            <label className="mb-2 block text-sm font-medium text-gray-700">
              Subject
            </label>

            <select
              value={subject}
              onChange={(e) => {
                setSubject(e.target.value);
                setStudy(null);
                setStudentAnswer("");
                setAnswerResult(null);
                setPerformance(null);
                setError("");
              }}
              className="w-full rounded-lg border border-gray-300 bg-white p-3 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
            >
              <option value="Science">
                Science
              </option>
              <option value="Math">Math</option>
              <option value="English">
                English
              </option>
              <option value="Social Studies">
                Social Studies
              </option>
            </select>
          </div>

          {/* Actions */}
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => void startStudy()}
              disabled={loading || checkingAnswer}
              className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {loading
                ? "Learning..."
                : "🚀 Start Learning"}
            </button>

            {(topic || study || error) && (
              <button
                type="button"
                onClick={clearStudy}
                disabled={loading || checkingAnswer}
                className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Clear
              </button>
            )}
          </div>

          {/* Error */}
          {error && (
            <div className="mt-4 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
              {error}
            </div>
          )}

          {/* Study Result */}
          {study && (
            <div className="mt-6 rounded-xl border border-gray-200 bg-gray-50 p-5">
              {/* Topic + Subject */}
              <div className="mb-5">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded-full bg-blue-100 px-3 py-1 text-xs font-medium text-blue-700">
                    {study.subject}
                  </span>

                  <span className="rounded-full bg-purple-100 px-3 py-1 text-xs font-medium text-purple-700">
                    {study.topic}
                  </span>
                </div>

                <h3 className="mt-3 text-lg font-semibold text-gray-900">
                  📚 Let&apos;s Learn
                </h3>
              </div>

              {/* Explanation */}
              <div className="mb-5 rounded-lg bg-white p-4">
                <h4 className="mb-2 text-sm font-semibold text-gray-900">
                  📖 Explanation
                </h4>

                <p className="whitespace-pre-wrap text-sm leading-6 text-gray-700">
                  {study.explanation}
                </p>
              </div>

              {/* Key Ideas */}
              <div className="mb-5">
                <h4 className="mb-3 text-sm font-semibold text-gray-900">
                  💡 Key Ideas
                </h4>

                <div className="space-y-2">
                  {study.keyIdeas.map(
                    (idea, index) => (
                      <div
                        key={`${idea}-${index}`}
                        className="flex gap-3 rounded-lg bg-white p-3"
                      >
                        <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-blue-100 text-xs font-semibold text-blue-700">
                          ✓
                        </div>

                        <p className="text-sm leading-6 text-gray-700">
                          {idea}
                        </p>
                      </div>
                    )
                  )}
                </div>
              </div>

              {/* Example */}
              <div className="mb-5 rounded-lg border border-purple-200 bg-purple-50 p-4">
                <h4 className="mb-2 text-sm font-semibold text-purple-900">
                  🌎 Example
                </h4>

                <p className="text-sm leading-6 text-purple-800">
                  {study.example}
                </p>
              </div>

              {/* Quick Check */}
              <div className="mb-5 rounded-lg border border-yellow-200 bg-yellow-50 p-4">
                <h4 className="mb-2 text-sm font-semibold text-yellow-900">
                  🧠 Quick Check
                </h4>

                <p className="text-sm leading-6 text-yellow-900">
                  {study.question}
                </p>

                {!answerResult && (
                  <>
                    <textarea
                      value={studentAnswer}
                      onChange={(e) => {
                        setStudentAnswer(
                          e.target.value
                        );
                        setError("");
                      }}
                      placeholder="Type your answer here..."
                      maxLength={1000}
                      rows={3}
                      className="mt-4 w-full resize-none rounded-lg border border-yellow-300 bg-white p-3 text-sm text-gray-800 outline-none focus:border-yellow-500 focus:ring-2 focus:ring-yellow-100"
                    />

                    <button
                      type="button"
                      onClick={() =>
                        void checkAnswer()
                      }
                      disabled={
                        checkingAnswer ||
                        !studentAnswer.trim()
                      }
                      className="mt-3 rounded-lg bg-yellow-500 px-4 py-2 text-sm font-medium text-white transition hover:bg-yellow-600 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {checkingAnswer
                        ? "Checking..."
                        : "✅ Check Answer"}
                    </button>
                  </>
                )}

                {/* Answer Feedback */}
                {answerResult && (
                  <div className="mt-4 rounded-lg bg-white p-4">
                    <div className="flex flex-wrap items-center gap-2">
                      <span
                        className={`rounded-full px-3 py-1 text-xs font-semibold ${
                          answerResult.evaluation ===
                          "correct"
                            ? "bg-green-100 text-green-700"
                            : answerResult.evaluation ===
                              "partial"
                            ? "bg-yellow-100 text-yellow-700"
                            : "bg-red-100 text-red-700"
                        }`}
                      >
                        {answerResult.evaluation ===
                        "correct"
                          ? "🎉 Correct"
                          : answerResult.evaluation ===
                            "partial"
                          ? "💡 Almost There"
                          : "🔄 Keep Practicing"}
                      </span>

                      <span className="text-sm font-semibold text-gray-700">
                        Score: {answerResult.score}/100
                      </span>
                    </div>

                    <p className="mt-3 text-sm leading-6 text-gray-700">
                      {answerResult.feedback}
                    </p>

                    {performance && (
                      <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
                        <div className="rounded-lg bg-gray-50 p-3 text-center">
                          <p className="text-xs text-gray-500">
                            Accuracy
                          </p>
                          <p className="mt-1 text-sm font-semibold text-gray-900">
                            {performance.accuracy}%
                          </p>
                        </div>

                        <div className="rounded-lg bg-gray-50 p-3 text-center">
                          <p className="text-xs text-gray-500">
                            Mastery
                          </p>
                          <p className="mt-1 text-sm font-semibold capitalize text-gray-900">
                            {performance.masteryLevel}
                          </p>
                        </div>

                        <div className="rounded-lg bg-gray-50 p-3 text-center">
                          <p className="text-xs text-gray-500">
                            Questions
                          </p>
                          <p className="mt-1 text-sm font-semibold text-gray-900">
                            {performance.questionsAsked}
                          </p>
                        </div>

                        <div className="rounded-lg bg-gray-50 p-3 text-center">
                          <p className="text-xs text-gray-500">
                            Correct
                          </p>
                          <p className="mt-1 text-sm font-semibold text-gray-900">
                            {performance.correctAnswers}
                          </p>
                        </div>
                      </div>
                    )}

                    <button
                      type="button"
                      onClick={() =>
                        void nextQuestion()
                      }
                      disabled={loading}
                      className="mt-4 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {loading
                        ? "Loading..."
                        : "➡️ Next Question"}
                    </button>
                  </div>
                )}
              </div>

              {/* Encouragement */}
              {study.encouragement && (
                <div className="rounded-lg border border-green-200 bg-green-50 p-4">
                  <p className="text-sm leading-6 text-green-800">
                    🎉 {study.encouragement}
                  </p>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
