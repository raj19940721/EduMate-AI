"use client";

import { useEffect, useState } from "react";

interface LearningTopic {
  id: string;
  topic: string;
  subject: string | null;
  grade: number | null;
  mastery_level: string;
  questions_asked: number;
  correct_answers: number;
  incorrect_answers: number;
  accuracy: number;
}

interface LearningSummary {
  totalTopics: number;
  totalQuestions: number;
  totalCorrect: number;
  totalIncorrect: number;
  overallAccuracy: number;
  masteredTopics: number;
  practicingTopics: number;
  learningTopics: number;
}

export default function LearningProgress() {
  const [progressOpen, setProgressOpen] =
    useState(false);

  const [summary, setSummary] =
    useState<LearningSummary | null>(null);

  const [topics, setTopics] =
    useState<LearningTopic[]>([]);

  const [loading, setLoading] =
    useState(true);

  const [error, setError] =
    useState("");

  useEffect(() => {
    const loadProgress = async () => {
      try {
        setLoading(true);
        setError("");

        const response = await fetch(
          "/api/learning-progress",
        );

        const data = await response.json();

        if (!response.ok) {
          throw new Error(
            data.error ||
              "Failed to load learning progress",
          );
        }

        setSummary(data.summary);
        setTopics(data.topics ?? []);
      } catch (error) {
        console.error(
          "Failed to load learning progress:",
          error,
        );

        setError(
          error instanceof Error
            ? error.message
            : "Failed to load learning progress",
        );
      } finally {
        setLoading(false);
      }
    };

    loadProgress();
  }, []);

  if (loading) {
    return (
      <div className="border-b bg-white px-6 py-3">
        <p className="text-sm text-gray-500">
          📊 Loading your progress...
        </p>
      </div>
    );
  }

  if (error) {
    return null;
  }

  if (!summary || topics.length === 0) {
    return null;
  }

  return (
    <div className="w-full border-b bg-white">
      {/* Progress Header */}
      <button
        type="button"
        onClick={() =>
          setProgressOpen(
            (previous) => !previous,
          )
        }
        className="flex w-full items-center justify-between px-6 py-3 text-left hover:bg-gray-50"
      >
        <div>
          <h2 className="font-semibold">
            📊 My Learning Progress
          </h2>

          <p className="text-sm text-gray-500">
            Track your learning journey
          </p>
        </div>

        <span className="text-lg">
          {progressOpen ? "▲" : "▼"}
        </span>
      </button>

      {/* Progress Content */}
      {progressOpen && (
        <div className="max-h-[360px] overflow-y-auto border-t px-6 py-4">
          {/* Overall statistics */}
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <div className="rounded-lg border p-3">
              <p className="text-xs text-gray-500">
                Topics
              </p>

              <p className="mt-1 text-xl font-semibold">
                {summary.totalTopics}
              </p>
            </div>

            <div className="rounded-lg border p-3">
              <p className="text-xs text-gray-500">
                Questions
              </p>

              <p className="mt-1 text-xl font-semibold">
                {summary.totalQuestions}
              </p>
            </div>

            <div className="rounded-lg border p-3">
              <p className="text-xs text-gray-500">
                Accuracy
              </p>

              <p className="mt-1 text-xl font-semibold">
                {summary.overallAccuracy}%
              </p>
            </div>

            <div className="rounded-lg border p-3">
              <p className="text-xs text-gray-500">
                Mastered
              </p>

              <p className="mt-1 text-xl font-semibold">
                {summary.masteredTopics}
              </p>
            </div>
          </div>

          {/* Topic progress */}
          <div className="mt-5">
            <h3 className="mb-3 font-semibold">
              📚 Topic Progress
            </h3>

            <div className="space-y-3">
              {topics.map((topic) => (
                <div
                  key={topic.id}
                  className="rounded-lg border p-3"
                >
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="font-semibold">
                        {topic.topic}
                      </p>

                      <p className="text-xs text-gray-500">
                        {topic.subject ??
                          "General"}
                        {" · "}
                        {topic.mastery_level}
                      </p>
                    </div>

                    <p className="font-semibold">
                      {topic.accuracy ?? 0}%
                    </p>
                  </div>

                  {/* Progress bar */}
                  <div className="mt-2 h-2 w-full rounded-full bg-gray-200">
                    <div
                      className="h-2 rounded-full bg-black"
                      style={{
                        width: `${Math.min(
                          topic.accuracy ?? 0,
                          100,
                        )}%`,
                      }}
                    />
                  </div>

                  <div className="mt-2 flex justify-between text-xs text-gray-500">
                    <span>
                      Questions:{" "}
                      {topic.questions_asked}
                    </span>

                    <span>
                      Correct:{" "}
                      {topic.correct_answers}
                    </span>

                    <span>
                      Incorrect:{" "}
                      {topic.incorrect_answers}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}