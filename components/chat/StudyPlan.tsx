"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

type StudyPlanItem = {
  id: string;
  topic: string;
  subject: string | null;
  grade: number | null;
  activityType: string;
  title: string;
  description: string;
  durationMinutes: number;
  priority: "high" | "medium" | "low";
  status: "pending" | "in_progress" | "completed" | string;
  accuracy: number;
  masteryLevel: string;
  scheduledDate: string;
  completedAt?: string | null;
};

type StudyPlanResponse = {
  success: boolean;
  source?: "saved" | "generated" | "existing" | "not_generated";
  message?: string;
  student?: {
    name: string;
    grade: number;
    subject: string;
  };
  studyPlan: StudyPlanItem[];
  summary: {
    totalTopics: number;
    highPriority: number;
    mediumPriority: number;
    lowPriority: number;
    totalDurationMinutes: number;
  };
  error?: string;
};

function getPriorityClass(priority: StudyPlanItem["priority"]) {
  switch (priority) {
    case "high":
      return "bg-red-50 text-red-700";
    case "medium":
      return "bg-yellow-50 text-yellow-700";
    case "low":
      return "bg-green-50 text-green-700";
    default:
      return "bg-gray-50 text-gray-700";
  }
}

function getStatusLabel(status: string) {
  switch (status) {
    case "pending":
      return "Not Started";
    case "in_progress":
      return "In Progress";
    case "completed":
      return "Completed";
    default:
      return status.replace("_", " ");
  }
}

function getActivityIcon(activityType: string) {
  switch (activityType) {
    case "quiz":
      return "🧠";
    case "practice":
      return "✏️";
    case "review":
      return "📖";
    default:
      return "📚";
  }
}

export default function StudyPlan() {
  const [data, setData] = useState<StudyPlanResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [error, setError] = useState("");

  const loadStudyPlan = useCallback(async (isRefresh = false) => {
    try {
      if (isRefresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }

      setError("");

      const response = await fetch("/api/study-plan", {
        method: "GET",
        credentials: "include",
        cache: "no-store",
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Failed to load study plan");
      }

      setData(result);
    } catch (error) {
      console.error("Study plan load error:", error);

      setError(
        error instanceof Error
          ? error.message
          : "Failed to load study plan",
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadStudyPlan();
  }, [loadStudyPlan]);

  // --------------------------------------------------
  // Study Plan → Quiz
  // --------------------------------------------------

  const launchQuizActivity = (item: StudyPlanItem) => {
    window.dispatchEvent(
      new CustomEvent("edumate:start-quiz", {
        detail: {
          topic: item.topic,
          studyPlanId: item.id,
        },
      }),
    );
  };

  // --------------------------------------------------
  // Study Plan → Practice / AI Tutor
  // --------------------------------------------------

  const launchPracticeActivity = (item: StudyPlanItem) => {
    window.dispatchEvent(
      new CustomEvent("edumate:start-practice", {
        detail: {
          topic: item.topic,
          studyPlanId: item.id,
        },
      }),
    );
  };

  // --------------------------------------------------
  // Study Plan → Review / AI Tutor
  // --------------------------------------------------

  const launchReviewActivity = (item: StudyPlanItem) => {
    window.dispatchEvent(
      new CustomEvent("edumate:start-review", {
        detail: {
          topic: item.topic,
          studyPlanId: item.id,
        },
      }),
    );
  };

  // --------------------------------------------------
  // Update Study Plan activity status
  // --------------------------------------------------

  const updateActivityStatus = async (
    id: string,
    status: "in_progress" | "completed",
  ) => {
    try {
      setUpdatingId(id);
      setError("");

      const response = await fetch(`/api/study-plan/${id}`, {
        method: "PATCH",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          status,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(
          result.error || "Failed to update study activity",
        );
      }

      await loadStudyPlan(true);

      return result.studyPlan;
    } catch (error) {
      console.error("Study plan update error:", error);

      setError(
        error instanceof Error
          ? error.message
          : "Failed to update study activity",
      );

      return null;
    } finally {
      setUpdatingId(null);
    }
  };

  // --------------------------------------------------
  // Quiz → Study Plan
  // When QuizCard completes a quiz, automatically
  // complete the matching in-progress quiz activity.
  // --------------------------------------------------

  useEffect(() => {
    const handleQuizCompleted = async (event: Event) => {
      const customEvent = event as CustomEvent<{
        topic?: string;
      }>;

      const topic = customEvent.detail?.topic?.trim();

      if (!topic) {
        return;
      }

      try {
        console.log(
          "Quiz completed event received for topic:",
          topic,
        );

        // Get the latest plan so we don't depend on
        // an old/stale React state value.
        const response = await fetch("/api/study-plan", {
          method: "GET",
          credentials: "include",
          cache: "no-store",
        });

        const latestPlan: StudyPlanResponse = await response.json();

        if (!response.ok) {
          throw new Error(
            latestPlan.error || "Failed to load latest study plan",
          );
        }

        const matchingActivity = latestPlan.studyPlan.find(
          (item) =>
            item.topic.toLowerCase() === topic.toLowerCase() &&
            item.activityType === "quiz" &&
            item.status === "in_progress",
        );

        if (!matchingActivity) {
          console.log(
            "No matching in-progress Study Plan quiz found.",
          );
          return;
        }

        console.log(
          "Completing Study Plan quiz activity:",
          matchingActivity.id,
        );

        await updateActivityStatus(
          matchingActivity.id,
          "completed",
        );
      } catch (error) {
        console.error(
          "Failed to complete Study Plan quiz activity:",
          error,
        );
      }
    };

    window.addEventListener(
      "edumate:quiz-completed",
      handleQuizCompleted,
    );

    return () => {
      window.removeEventListener(
        "edumate:quiz-completed",
        handleQuizCompleted,
      );
    };
  }, [loadStudyPlan]);

  // --------------------------------------------------
  // Progress
  // --------------------------------------------------

  const progress = useMemo(() => {
    const items = data?.studyPlan ?? [];

    const completedCount = items.filter(
      (item) => item.status === "completed",
    ).length;

    const inProgressCount = items.filter(
      (item) => item.status === "in_progress",
    ).length;

    const percentage =
      items.length > 0
        ? Math.round((completedCount / items.length) * 100)
        : 0;

    return {
      completedCount,
      inProgressCount,
      percentage,
    };
  }, [data]);

  if (loading) {
    return (
      <div className="w-full border-b bg-white px-6 py-4">
        <div className="animate-pulse">
          <div className="h-5 w-40 rounded bg-gray-200" />
          <div className="mt-2 h-4 w-64 rounded bg-gray-200" />
          <div className="mt-4 h-20 rounded-lg bg-gray-100" />
        </div>
      </div>
    );
  }

  if (error && !data) {
    return (
      <div className="w-full border-b bg-white px-6 py-4">
        <div className="rounded-lg bg-red-50 p-3 text-sm text-red-600">
          {error}
        </div>

        <button
          type="button"
          onClick={() => loadStudyPlan(true)}
          className="mt-3 rounded-lg border px-4 py-2 text-sm font-medium hover:bg-gray-50"
        >
          Try Again
        </button>
      </div>
    );
  }

  const studyPlan = data?.studyPlan ?? [];

  return (
    <div className="w-full border-b bg-white">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-3">
        <div>
          <h2 className="font-semibold">
            🎯 Personal Study Plan
          </h2>

          <p className="text-sm text-gray-500">
            Follow today's recommended learning activities
          </p>
        </div>

        <button
          type="button"
          onClick={() => loadStudyPlan(true)}
          disabled={refreshing}
          className="rounded-lg border px-3 py-1.5 text-xs font-medium hover:bg-gray-50 disabled:opacity-50"
        >
          {refreshing ? "Refreshing..." : "Refresh"}
        </button>
      </div>

      {/* Progress */}
      {studyPlan.length > 0 && (
        <div className="px-6 pb-4">
          <div className="rounded-lg bg-gray-50 p-3">
            <div className="flex items-center justify-between text-sm">
              <span className="font-medium">
                Today's Progress
              </span>

              <span className="text-gray-500">
                {progress.completedCount} / {studyPlan.length} completed
              </span>
            </div>

            <div className="mt-2 h-2 overflow-hidden rounded-full bg-gray-200">
              <div
                className="h-full rounded-full bg-green-500 transition-all"
                style={{
                  width: `${progress.percentage}%`,
                }}
              />
            </div>

            <div className="mt-2 flex justify-between text-xs text-gray-500">
              <span>{progress.percentage}% complete</span>

              {progress.inProgressCount > 0 && (
                <span>
                  {progress.inProgressCount} in progress
                </span>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Error */}
      {error && data && (
        <div className="mx-6 mb-3 rounded-lg bg-red-50 p-3 text-sm text-red-600">
          {error}
        </div>
      )}

      {/* Empty state */}
      {studyPlan.length === 0 && (
        <div className="px-6 pb-4">
          <div className="rounded-lg border border-dashed p-4 text-center">
            <div className="text-2xl">📚</div>

            <div className="mt-2 font-medium">
              No study activities yet
            </div>

            <div className="mt-1 text-sm text-gray-500">
              Continue learning to build your personalized study plan.
            </div>
          </div>
        </div>
      )}

      {/* Activities */}
      {studyPlan.length > 0 && (
        <div className="max-h-[520px] space-y-3 overflow-y-auto px-6 pb-5">
          {studyPlan.map((item) => {
            const isUpdating = updatingId === item.id;
            const isCompleted = item.status === "completed";
            const isQuiz = item.activityType === "quiz";

            return (
              <div
                key={item.id}
                className={`rounded-xl border p-4 transition ${
                  isCompleted
                    ? "border-green-200 bg-green-50/50"
                    : "bg-white"
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex min-w-0 gap-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gray-100 text-lg">
                      {getActivityIcon(item.activityType)}
                    </div>

                    <div className="min-w-0">
                      <div className="font-semibold">
                        {item.title}
                      </div>

                      <div className="mt-1 text-sm text-gray-500">
                        {item.description}
                      </div>

                      <div className="mt-2 flex flex-wrap gap-2 text-xs">
                        <span className="rounded-full bg-gray-100 px-2 py-1 capitalize">
                          {item.activityType}
                        </span>

                        <span className="rounded-full bg-gray-100 px-2 py-1">
                          {item.durationMinutes} min
                        </span>

                        <span
                          className={`rounded-full px-2 py-1 capitalize ${getPriorityClass(
                            item.priority,
                          )}`}
                        >
                          {item.priority} priority
                        </span>
                      </div>
                    </div>
                  </div>

                  <span
                    className={`shrink-0 rounded-full px-2 py-1 text-xs font-medium ${
                      isCompleted
                        ? "bg-green-100 text-green-700"
                        : item.status === "in_progress"
                          ? "bg-blue-100 text-blue-700"
                          : "bg-gray-100 text-gray-600"
                    }`}
                  >
                    {isCompleted
                      ? "✓ Completed"
                      : getStatusLabel(item.status)}
                  </span>
                </div>

                {/* Quiz activity */}
                {item.status === "pending" && isQuiz && (
                  <button
                    type="button"
                    onClick={async () => {
                      const updated = await updateActivityStatus(
                        item.id,
                        "in_progress",
                      );

                      if (updated) {
                        launchQuizActivity(item);
                      }
                    }}
                    disabled={isUpdating}
                    className="mt-3 w-full rounded-lg bg-black px-4 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {isUpdating
                      ? "Starting..."
                      : "▶ Start Quiz"}
                  </button>
                )}

                {/* Practice activity */}
                {item.status === "pending" &&
                  item.activityType === "practice" && (
                    <button
                      type="button"
                      onClick={async () => {
                        const updated = await updateActivityStatus(
                          item.id,
                          "in_progress",
                        );

                        if (updated) {
                          launchPracticeActivity(item);
                        }
                      }}
                      disabled={isUpdating}
                      className="mt-3 w-full rounded-lg bg-black px-4 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {isUpdating
                        ? "Starting..."
                        : "▶ Start Practice"}
                    </button>
                  )}

                {/* Review activity */}
                {item.status === "pending" &&
                  item.activityType === "review" && (
                    <button
                      type="button"
                      onClick={async () => {
                        const updated = await updateActivityStatus(
                          item.id,
                          "in_progress",
                        );

                        if (updated) {
                          launchReviewActivity(item);
                        }
                      }}
                      disabled={isUpdating}
                      className="mt-3 w-full rounded-lg bg-black px-4 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {isUpdating
                        ? "Starting..."
                        : "▶ Start Review"}
                    </button>
                  )}

                {/* Other non-quiz activity */}
                {item.status === "pending" &&
                  !isQuiz &&
                  item.activityType !== "practice" && (
                    <button
                      type="button"
                      onClick={() =>
                        updateActivityStatus(
                          item.id,
                          "in_progress",
                        )
                      }
                      disabled={isUpdating}
                      className="mt-3 w-full rounded-lg bg-black px-4 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {isUpdating
                        ? "Starting..."
                        : "▶ Start Activity"}
                    </button>
                  )}

                {/* In progress */}
                {item.status === "in_progress" && (
                  <button
                    type="button"
                    onClick={() =>
                      updateActivityStatus(
                        item.id,
                        "completed",
                      )
                    }
                    disabled={isUpdating}
                    className="mt-3 w-full rounded-lg border px-4 py-2 text-sm font-medium hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {isUpdating
                      ? "Updating..."
                      : "✓ Mark Complete"}
                  </button>
                )}

                {/* Completed */}
                {isCompleted && (
                  <div className="mt-3 text-center text-sm font-medium text-green-700">
                    🎉 Great job! Activity completed.
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
