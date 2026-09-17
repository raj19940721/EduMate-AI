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

  plan?: {
    id: string;
    title: string;
    grade: number;
    startDate: string;
    endDate: string;
    status: string;
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

type DayGroup = {
  date: string;
  items: StudyPlanItem[];
};

function getActivityIcon(activityType: string) {
  switch (activityType) {
    case "learn":
      return "📚";

    case "practice":
      return "✏️";

    case "quiz":
      return "🧠";

    case "review":
      return "📖";

    case "homework":
      return "📝";

    default:
      return "📚";
  }
}

function getActivityButtonLabel(activityType: string) {
  switch (activityType) {
    case "learn":
      return "▶ Start Learning";

    case "practice":
      return "▶ Start Practice";

    case "quiz":
      return "▶ Start Quiz";

    case "review":
      return "▶ Start Review";

    case "homework":
      return "▶ Start Homework";

    default:
      return "▶ Start Activity";
  }
}

function getActivityTypeClass(activityType: string) {
  switch (activityType) {
    case "learn":
      return "bg-blue-50 text-blue-700";

    case "practice":
      return "bg-purple-50 text-purple-700";

    case "quiz":
      return "bg-orange-50 text-orange-700";

    case "review":
      return "bg-green-50 text-green-700";

    case "homework":
      return "bg-pink-50 text-pink-700";

    default:
      return "bg-gray-100 text-gray-700";
  }
}

function getStatusClass(status: string) {
  switch (status) {
    case "completed":
      return "bg-green-100 text-green-700";

    case "in_progress":
      return "bg-blue-100 text-blue-700";

    default:
      return "bg-gray-100 text-gray-600";
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
      return status.replaceAll("_", " ");
  }
}

function formatDate(dateString: string) {
  const [year, month, day] = dateString
    .split("-")
    .map(Number);

  if (!year || !month || !day) {
    return dateString;
  }

  return new Intl.DateTimeFormat("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(
    new Date(
      year,
      month - 1,
      day,
    ),
  );
}

function formatDayName(dateString: string) {
  const [year, month, day] = dateString
    .split("-")
    .map(Number);

  if (!year || !month || !day) {
    return "";
  }

  return new Intl.DateTimeFormat("en-IN", {
    weekday: "long",
  }).format(
    new Date(
      year,
      month - 1,
      day,
    ),
  );
}

function getTodayDate() {
  const parts = new Intl.DateTimeFormat(
    "en-CA",
    {
      timeZone: "Asia/Kolkata",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    },
  ).formatToParts(new Date());

  const year = parts.find(
    (part) => part.type === "year",
  )?.value;

  const month = parts.find(
    (part) => part.type === "month",
  )?.value;

  const day = parts.find(
    (part) => part.type === "day",
  )?.value;

  if (!year || !month || !day) {
    return "";
  }

  return `${year}-${month}-${day}`;
}

function getDayLabel(
  date: string,
  today: string,
) {
  if (date === today) {
    return "Today";
  }

  return formatDayName(date);
}

function groupActivitiesByDate(
  activities: StudyPlanItem[],
): DayGroup[] {
  const groups = new Map<
    string,
    StudyPlanItem[]
  >();

  for (const item of activities) {
    const existing =
      groups.get(item.scheduledDate);

    if (existing) {
      existing.push(item);
    } else {
      groups.set(item.scheduledDate, [
        item,
      ]);
    }
  }

  return Array.from(groups.entries()).map(
    ([date, items]) => ({
      date,
      items,
    }),
  );
}

export default function StudyPlan() {
  const [data, setData] =
    useState<StudyPlanResponse | null>(
      null,
    );

  const [loading, setLoading] =
    useState(true);

  const [refreshing, setRefreshing] =
    useState(false);

  const [updatingId, setUpdatingId] =
    useState<string | null>(null);

  const [error, setError] =
    useState("");

  const [expandedDays, setExpandedDays] =
    useState<Record<string, boolean>>({});

  // --------------------------------------------------
  // Load study plan
  // --------------------------------------------------

  const loadStudyPlan = useCallback(
    async (isRefresh = false) => {
      try {
        if (isRefresh) {
          setRefreshing(true);
        } else {
          setLoading(true);
        }

        setError("");

        const response = await fetch(
          "/api/study-plan",
          {
            method: "GET",
            credentials: "include",
            cache: "no-store",
          },
        );

        const result =
          await response.json();

        if (!response.ok) {
          throw new Error(
            result.error ||
              "Failed to load study plan",
          );
        }

        if (
          !result ||
          typeof result !== "object" ||
          !Array.isArray(result.studyPlan)
        ) {
          throw new Error(
            "Invalid study plan response",
          );
        }

        setData(result);
      } catch (error) {
        console.error(
          "Study plan load error:",
          error,
        );

        setError(
          error instanceof Error
            ? error.message
            : "Failed to load study plan",
        );
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [],
  );

  useEffect(() => {
    void loadStudyPlan();
  }, [loadStudyPlan]);

  // --------------------------------------------------
  // Study Plan → Quiz
  // --------------------------------------------------

  const launchQuizActivity = (
    item: StudyPlanItem,
  ) => {
    window.dispatchEvent(
      new CustomEvent(
        "edumate:start-quiz",
        {
          detail: {
            topic: item.topic,
            studyPlanId: item.id,
          },
        },
      ),
    );
  };

  // --------------------------------------------------
  // Study Plan → Practice
  // --------------------------------------------------

  const launchPracticeActivity = (
    item: StudyPlanItem,
  ) => {
    window.dispatchEvent(
      new CustomEvent(
        "edumate:start-practice",
        {
          detail: {
            topic: item.topic,
            studyPlanId: item.id,
          },
        },
      ),
    );
  };

  // --------------------------------------------------
  // Study Plan → Review
  // --------------------------------------------------

  const launchReviewActivity = (
    item: StudyPlanItem,
  ) => {
    window.dispatchEvent(
      new CustomEvent(
        "edumate:start-review",
        {
          detail: {
            topic: item.topic,
            studyPlanId: item.id,
          },
        },
      ),
    );
  };

  // --------------------------------------------------
  // Study Plan → Homework
  // --------------------------------------------------

  const launchHomeworkActivity = (
    item: StudyPlanItem,
  ) => {
    window.dispatchEvent(
      new CustomEvent(
        "edumate:start-homework",
        {
          detail: {
            topic: item.topic,
            studyPlanId: item.id,
          },
        },
      ),
    );
  };

  // --------------------------------------------------
  // Update activity status
  // --------------------------------------------------

  const updateActivityStatus = async (
    id: string,
    status:
      | "in_progress"
      | "completed",
  ) => {
    try {
      setUpdatingId(id);
      setError("");

      const response = await fetch(
        `/api/study-plan/${id}`,
        {
          method: "PATCH",
          credentials: "include",
          headers: {
            "Content-Type":
              "application/json",
          },
          body: JSON.stringify({
            status,
          }),
        },
      );

      const result =
        await response.json();

      if (!response.ok) {
        throw new Error(
          result.error ||
            "Failed to update study activity",
        );
      }

      await loadStudyPlan(true);

      return result.studyPlan;
    } catch (error) {
      console.error(
        "Study plan update error:",
        error,
      );

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
  // Start activity
  // --------------------------------------------------

  const handleStartActivity = async (
    item: StudyPlanItem,
  ) => {
    const updated =
      await updateActivityStatus(
        item.id,
        "in_progress",
      );

    if (!updated) {
      return;
    }

    switch (item.activityType) {
      case "quiz":
        launchQuizActivity(item);
        break;

      case "practice":
        launchPracticeActivity(item);
        break;

      case "review":
        launchReviewActivity(item);
        break;

      case "homework":
        launchHomeworkActivity(item);
        break;

      default:
        // Learn activities can be completed
        // after starting.
        break;
    }
  };

  // --------------------------------------------------
  // Quiz → Study Plan
  // --------------------------------------------------

  useEffect(() => {
    const handleQuizCompleted = async (
      event: Event,
    ) => {
      const customEvent =
        event as CustomEvent<{
          topic?: string;
        }>;

      const topic =
        customEvent.detail?.topic?.trim();

      if (!topic) {
        return;
      }

      try {
        console.log(
          "Quiz completed event received:",
          topic,
        );

        const response = await fetch(
          "/api/study-plan",
          {
            method: "GET",
            credentials: "include",
            cache: "no-store",
          },
        );

        const latestPlan: StudyPlanResponse =
          await response.json();

        if (!response.ok) {
          throw new Error(
            latestPlan.error ||
              "Failed to load latest study plan",
          );
        }

        const matchingActivity =
          latestPlan.studyPlan.find(
            (item) =>
              item.topic.toLowerCase() ===
                topic.toLowerCase() &&
              item.activityType ===
                "quiz" &&
              item.status ===
                "in_progress",
          );

        if (!matchingActivity) {
          console.log(
            "No matching in-progress quiz found.",
          );

          return;
        }

        await updateActivityStatus(
          matchingActivity.id,
          "completed",
        );
      } catch (error) {
        console.error(
          "Failed to complete Study Plan quiz:",
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
  // Today's date
  // --------------------------------------------------

  const today = useMemo(
    () => getTodayDate(),
    [],
  );

  // --------------------------------------------------
  // Progress
  // --------------------------------------------------

  const progress = useMemo(() => {
    const items =
      data?.studyPlan ?? [];

    const completedCount =
      items.filter(
        (item) =>
          item.status ===
          "completed",
      ).length;

    const inProgressCount =
      items.filter(
        (item) =>
          item.status ===
          "in_progress",
      ).length;

    const percentage =
      items.length > 0
        ? Math.round(
            (completedCount /
              items.length) *
              100,
          )
        : 0;

    const todayItems =
      items.filter(
        (item) =>
          item.scheduledDate ===
          today,
      );

    const todayCompleted =
      todayItems.filter(
        (item) =>
          item.status ===
          "completed",
      ).length;

    const todayPercentage =
      todayItems.length > 0
        ? Math.round(
            (todayCompleted /
              todayItems.length) *
              100,
          )
        : 0;

    return {
      completedCount,
      inProgressCount,
      percentage,
      todayItems,
      todayCompleted,
      todayPercentage,
    };
  }, [data, today]);

  // --------------------------------------------------
  // Group by day
  // --------------------------------------------------

  const dayGroups = useMemo(
    () =>
      groupActivitiesByDate(
        data?.studyPlan ?? [],
      ),
    [data],
  );

  // --------------------------------------------------
  // Expand/collapse
  // --------------------------------------------------

  useEffect(() => {
    if (dayGroups.length === 0) {
      return;
    }

    const initialState: Record<
      string,
      boolean
    > = {};

    for (const group of dayGroups) {
      initialState[group.date] =
        group.date === today;
    }

    setExpandedDays(initialState);
  }, [dayGroups, today]);

  const toggleDay = (
    date: string,
  ) => {
    setExpandedDays((previous) => ({
      ...previous,
      [date]:
        !previous[date],
    }));
  };

  // --------------------------------------------------
  // Loading
  // --------------------------------------------------

  if (loading) {
    return (
      <div className="w-full border-b bg-white px-6 py-5">
        <div className="animate-pulse">
          <div className="h-6 w-52 rounded bg-gray-200" />

          <div className="mt-2 h-4 w-80 rounded bg-gray-200" />

          <div className="mt-5 h-24 rounded-xl bg-gray-100" />

          <div className="mt-4 h-32 rounded-xl bg-gray-100" />
        </div>
      </div>
    );
  }

  // --------------------------------------------------
  // Error
  // --------------------------------------------------

  if (error && !data) {
    return (
      <div className="w-full border-b bg-white px-6 py-5">
        <div className="rounded-xl bg-red-50 p-4 text-sm text-red-600">
          {error}
        </div>

        <button
          type="button"
          onClick={() =>
            void loadStudyPlan(true)
          }
          className="mt-3 rounded-lg border px-4 py-2 text-sm font-medium hover:bg-gray-50"
        >
          Try Again
        </button>
      </div>
    );
  }

  const studyPlan =
    data?.studyPlan ?? [];

  const plan =
    data?.plan;

  return (
    <div className="w-full border-b bg-white">
      {/* ------------------------------------------------
          Header
      ------------------------------------------------ */}

      <div className="px-6 py-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-semibold text-gray-900">
                🎯 Personal Study Plan
              </h2>

              {data?.student?.grade && (
                <span className="rounded-full bg-blue-50 px-2.5 py-1 text-xs font-medium text-blue-700">
                  Grade {data.student.grade}
                </span>
              )}
            </div>

            <p className="mt-1 text-sm text-gray-500">
              {plan?.title ??
                "Your personalized 7-day learning journey"}
            </p>

            {plan && (
              <p className="mt-1 text-xs text-gray-400">
                {formatDate(
                  plan.startDate,
                )}{" "}
                →{" "}
                {formatDate(
                  plan.endDate,
                )}
              </p>
            )}
          </div>

          <button
            type="button"
            onClick={() =>
              void loadStudyPlan(true)
            }
            disabled={refreshing}
            className="shrink-0 rounded-lg border px-3 py-2 text-xs font-medium text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {refreshing
              ? "Refreshing..."
              : "↻ Refresh"}
          </button>
        </div>
      </div>

      {/* ------------------------------------------------
          Progress
      ------------------------------------------------ */}

      {studyPlan.length > 0 && (
        <div className="px-6 pb-4">
          <div className="rounded-xl border bg-gray-50 p-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="text-sm font-semibold text-gray-900">
                  7-Day Progress
                </div>

                <div className="mt-1 text-xs text-gray-500">
                  {progress.completedCount} of{" "}
                  {studyPlan.length} activities
                  completed
                </div>
              </div>

              <div className="text-right">
                <div className="text-xl font-bold text-gray-900">
                  {progress.percentage}%
                </div>

                <div className="text-xs text-gray-500">
                  complete
                </div>
              </div>
            </div>

            <div className="mt-3 h-2.5 overflow-hidden rounded-full bg-gray-200">
              <div
                className="h-full rounded-full bg-green-500 transition-all duration-500"
                style={{
                  width: `${progress.percentage}%`,
                }}
              />
            </div>

            <div className="mt-3 flex flex-wrap gap-3 text-xs text-gray-500">
              <span>
                📅 Today:{" "}
                {progress.todayCompleted}/
                {progress.todayItems.length}
              </span>

              <span>
                ⏱️{" "}
                {data?.summary
                  .totalDurationMinutes ??
                  0}{" "}
                min planned
              </span>

              {progress.inProgressCount >
                0 && (
                <span>
                  ▶{" "}
                  {progress.inProgressCount}{" "}
                  in progress
                </span>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ------------------------------------------------
          Error while data exists
      ------------------------------------------------ */}

      {error && data && (
        <div className="mx-6 mb-4 rounded-xl bg-red-50 p-3 text-sm text-red-600">
          {error}
        </div>
      )}

      {/* ------------------------------------------------
          Empty state
      ------------------------------------------------ */}

      {studyPlan.length === 0 && (
        <div className="px-6 pb-5">
          <div className="rounded-xl border border-dashed p-6 text-center">
            <div className="text-3xl">
              📚
            </div>

            <div className="mt-2 font-semibold text-gray-900">
              No study activities yet
            </div>

            <div className="mt-1 text-sm text-gray-500">
              Continue learning and practicing
              to build your personalized study
              plan.
            </div>
          </div>
        </div>
      )}

      {/* ------------------------------------------------
          7-Day Plan
      ------------------------------------------------ */}

      {studyPlan.length > 0 && (
        <div className="max-h-[650px] space-y-3 overflow-y-auto px-6 pb-6">
          {dayGroups.map((group) => {
            const isToday =
              group.date === today;

            const isExpanded =
              expandedDays[group.date] ??
              false;

            const completed =
              group.items.filter(
                (item) =>
                  item.status ===
                  "completed",
              ).length;

            const dayPercentage =
              group.items.length > 0
                ? Math.round(
                    (completed /
                      group.items
                        .length) *
                      100,
                  )
                : 0;

            return (
              <div
                key={group.date}
                className={`overflow-hidden rounded-xl border ${
                  isToday
                    ? "border-blue-200 bg-blue-50/30"
                    : "bg-white"
                }`}
              >
                {/* Day header */}

                <button
                  type="button"
                  onClick={() =>
                    toggleDay(
                      group.date,
                    )
                  }
                  className="w-full px-4 py-3 text-left hover:bg-gray-50"
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div
                        className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-lg ${
                          isToday
                            ? "bg-blue-100"
                            : "bg-gray-100"
                        }`}
                      >
                        {isToday
                          ? "📅"
                          : "🗓️"}
                      </div>

                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-gray-900">
                            {getDayLabel(
                              group.date,
                              today,
                            )}
                          </span>

                          {isToday && (
                            <span className="rounded-full bg-blue-100 px-2 py-0.5 text-[10px] font-semibold text-blue-700">
                              TODAY
                            </span>
                          )}
                        </div>

                        <div className="mt-0.5 text-xs text-gray-500">
                          {formatDate(
                            group.date,
                          )}{" "}
                          ·{" "}
                          {
                            group.items
                              .length
                          }{" "}
                          activities
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      <div className="hidden text-right sm:block">
                        <div className="text-xs font-medium text-gray-700">
                          {completed}/
                          {
                            group.items
                              .length
                          }
                        </div>

                        <div className="text-[10px] text-gray-400">
                          {dayPercentage}%
                        </div>
                      </div>

                      <span className="text-gray-400">
                        {isExpanded
                          ? "⌃"
                          : "⌄"}
                      </span>
                    </div>
                  </div>
                </button>

                {/* Day activities */}

                {isExpanded && (
                  <div className="space-y-3 border-t px-4 py-4">
                    {group.items.map(
                      (item) => {
                        const isUpdating =
                          updatingId ===
                          item.id;

                        const isCompleted =
                          item.status ===
                          "completed";

                        const isInProgress =
                          item.status ===
                          "in_progress";

                        return (
                          <div
                            key={item.id}
                            className={`rounded-xl border p-4 transition ${
                              isCompleted
                                ? "border-green-200 bg-green-50/50"
                                : "bg-white"
                            }`}
                          >
                            <div className="flex items-start gap-3">
                              {/* Icon */}

                              <div
                                className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-lg ${
                                  isCompleted
                                    ? "bg-green-100"
                                    : "bg-gray-100"
                                }`}
                              >
                                {isCompleted
                                  ? "✓"
                                  : getActivityIcon(
                                      item.activityType,
                                    )}
                              </div>

                              {/* Content */}

                              <div className="min-w-0 flex-1">
                                <div className="flex items-start justify-between gap-3">
                                  <div>
                                    <h3 className="font-semibold text-gray-900">
                                      {
                                        item.title
                                      }
                                    </h3>

                                    <p className="mt-1 text-sm leading-5 text-gray-500">
                                      {
                                        item.description
                                      }
                                    </p>
                                  </div>

                                  <span
                                    className={`shrink-0 rounded-full px-2 py-1 text-[10px] font-medium ${getStatusClass(
                                      item.status,
                                    )}`}
                                  >
                                    {getStatusLabel(
                                      item.status,
                                    )}
                                  </span>
                                </div>

                                {/* Metadata */}

                                <div className="mt-3 flex flex-wrap gap-2">
                                  <span
                                    className={`rounded-full px-2.5 py-1 text-[11px] font-medium capitalize ${getActivityTypeClass(
                                      item.activityType,
                                    )}`}
                                  >
                                    {item.activityType}
                                  </span>

                                  <span className="rounded-full bg-gray-100 px-2.5 py-1 text-[11px] text-gray-600">
                                    ⏱️{" "}
                                    {
                                      item.durationMinutes
                                    }{" "}
                                    min
                                  </span>

                                  <span className="rounded-full bg-gray-100 px-2.5 py-1 text-[11px] text-gray-600">
                                    🌱{" "}
                                    {item.topic}
                                  </span>

                                  {item.accuracy >
                                    0 && (
                                    <span className="rounded-full bg-gray-100 px-2.5 py-1 text-[11px] text-gray-600">
                                      📊{" "}
                                      {Math.round(
                                        item.accuracy,
                                      )}
                                      %
                                    </span>
                                  )}
                                </div>

                                {/* Start button */}

                                {item.status ===
                                  "pending" && (
                                  <button
                                    type="button"
                                    onClick={() =>
                                      void handleStartActivity(
                                        item,
                                      )
                                    }
                                    disabled={
                                      isUpdating
                                    }
                                    className="mt-3 w-full rounded-lg bg-black px-4 py-2.5 text-sm font-medium text-white transition hover:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-50"
                                  >
                                    {isUpdating
                                      ? "Starting..."
                                      : getActivityButtonLabel(
                                          item.activityType,
                                        )}
                                  </button>
                                )}

                                {/* In progress */}

                                {isInProgress && (
                                  <div className="mt-3 flex gap-2">
                                    <div className="flex flex-1 items-center justify-center rounded-lg bg-blue-50 px-3 py-2 text-xs font-medium text-blue-700">
                                      ▶ Activity in
                                      progress
                                    </div>

                                    <button
                                      type="button"
                                      onClick={() =>
                                        void updateActivityStatus(
                                          item.id,
                                          "completed",
                                        )
                                      }
                                      disabled={
                                        isUpdating
                                      }
                                      className="rounded-lg border px-4 py-2 text-xs font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                                    >
                                      {isUpdating
                                        ? "Updating..."
                                        : "✓ Complete"}
                                    </button>
                                  </div>
                                )}

                                {/* Completed */}

                                {isCompleted && (
                                  <div className="mt-3 rounded-lg bg-green-50 px-3 py-2 text-center text-xs font-medium text-green-700">
                                    🎉 Great job!
                                    You completed
                                    this activity.
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                        );
                      },
                    )}
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