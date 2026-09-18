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
  student?: { name: string; grade: number; subject: string };
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

type DayGroup = { date: string; items: StudyPlanItem[] };

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
      return "study-plan__pill study-plan__pill--blue";
    case "practice":
      return "study-plan__pill study-plan__pill--purple";
    case "quiz":
      return "study-plan__pill study-plan__pill--orange";
    case "review":
      return "study-plan__pill study-plan__pill--green";
    case "homework":
      return "study-plan__pill study-plan__pill--pink";
    default:
      return "study-plan__pill";
  }
}

function getStatusClass(status: string) {
  switch (status) {
    case "completed":
      return "study-plan__status study-plan__status--success";
    case "in_progress":
      return "study-plan__status study-plan__status--active";
    default:
      return "study-plan__status";
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
  const [year, month, day] = dateString.split("-").map(Number);
  if (!year || !month || !day) return dateString;

  return new Intl.DateTimeFormat("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(year, month - 1, day));
}

function formatDayName(dateString: string) {
  const [year, month, day] = dateString.split("-").map(Number);
  if (!year || !month || !day) return "";

  return new Intl.DateTimeFormat("en-IN", { weekday: "long" }).format(
    new Date(year, month - 1, day),
  );
}

function getTodayDate() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const year = parts.find((part) => part.type === "year")?.value;
  const month = parts.find((part) => part.type === "month")?.value;
  const day = parts.find((part) => part.type === "day")?.value;

  if (!year || !month || !day) return "";
  return `${year}-${month}-${day}`;
}

function getDayLabel(date: string, today: string) {
  if (date === today) return "Today";
  return formatDayName(date);
}

function groupActivitiesByDate(activities: StudyPlanItem[]): DayGroup[] {
  const groups = new Map<string, StudyPlanItem[]>();

  for (const item of activities) {
    const existing = groups.get(item.scheduledDate);
    if (existing) {
      existing.push(item);
    } else {
      groups.set(item.scheduledDate, [item]);
    }
  }

  return Array.from(groups.entries()).map(([date, items]) => ({ date, items }));
}

export default function StudyPlan() {
  const [data, setData] = useState<StudyPlanResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [expandedDays, setExpandedDays] = useState<Record<string, boolean>>({});

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

      if (
        !result ||
        typeof result !== "object" ||
        !Array.isArray(result.studyPlan)
      ) {
        throw new Error("Invalid study plan response");
      }

      setData(result);
    } catch (error) {
      console.error("Study plan load error:", error);
      setError(
        error instanceof Error ? error.message : "Failed to load study plan",
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void loadStudyPlan();
  }, [loadStudyPlan]);

  const launchQuizActivity = (item: StudyPlanItem) => {
    window.dispatchEvent(
      new CustomEvent("edumate:start-quiz", {
        detail: { topic: item.topic, studyPlanId: item.id },
      }),
    );
  };

  const launchPracticeActivity = (item: StudyPlanItem) => {
    window.dispatchEvent(
      new CustomEvent("edumate:start-practice", {
        detail: { topic: item.topic, studyPlanId: item.id },
      }),
    );
  };

  const launchReviewActivity = (item: StudyPlanItem) => {
    window.dispatchEvent(
      new CustomEvent("edumate:start-review", {
        detail: { topic: item.topic, studyPlanId: item.id },
      }),
    );
  };

  const launchHomeworkActivity = (item: StudyPlanItem) => {
    window.dispatchEvent(
      new CustomEvent("edumate:start-homework", {
        detail: { topic: item.topic, studyPlanId: item.id },
      }),
    );
  };

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
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Failed to update study activity");
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

  const handleStartActivity = async (item: StudyPlanItem) => {
    const updated = await updateActivityStatus(item.id, "in_progress");
    if (!updated) return;

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
        break;
    }
  };

  useEffect(() => {
    const handleQuizCompleted = async (event: Event) => {
      const customEvent = event as CustomEvent<{ topic?: string }>;
      const topic = customEvent.detail?.topic?.trim();
      if (!topic) return;

      try {
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

        if (!matchingActivity) return;
        await updateActivityStatus(matchingActivity.id, "completed");
      } catch (error) {
        console.error("Failed to complete Study Plan quiz:", error);
      }
    };

    window.addEventListener("edumate:quiz-completed", handleQuizCompleted);
    return () =>
      window.removeEventListener("edumate:quiz-completed", handleQuizCompleted);
  }, [loadStudyPlan]);

  const today = useMemo(() => getTodayDate(), []);

  const progress = useMemo(() => {
    const items = data?.studyPlan ?? [];
    const completedCount = items.filter(
      (item) => item.status === "completed",
    ).length;
    const inProgressCount = items.filter(
      (item) => item.status === "in_progress",
    ).length;
    const percentage =
      items.length > 0 ? Math.round((completedCount / items.length) * 100) : 0;
    const todayItems = items.filter((item) => item.scheduledDate === today);
    const todayCompleted = todayItems.filter(
      (item) => item.status === "completed",
    ).length;
    const todayPercentage =
      todayItems.length > 0
        ? Math.round((todayCompleted / todayItems.length) * 100)
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

  const dayGroups = useMemo(
    () => groupActivitiesByDate(data?.studyPlan ?? []),
    [data],
  );

  useEffect(() => {
    if (dayGroups.length === 0) return;

    const initialState: Record<string, boolean> = {};
    for (const group of dayGroups) {
      initialState[group.date] = group.date === today;
    }

    setExpandedDays(initialState);
  }, [dayGroups, today]);

  const toggleDay = (date: string) => {
    setExpandedDays((previous) => ({ ...previous, [date]: !previous[date] }));
  };

  if (loading) {
    return (
      <div className="study-plan study-plan--loading">
        <div className="study-plan__skeleton" />
      </div>
    );
  }

  if (error && !data) {
    return (
      <div className="study-plan study-plan--error">
        <div className="study-plan__error-card">{error}</div>
        <button
          type="button"
          onClick={() => void loadStudyPlan(true)}
          className="study-plan__retry-button"
        >
          Try Again
        </button>
      </div>
    );
  }

  const studyPlan = data?.studyPlan ?? [];
  const plan = data?.plan;

  return (
    <div className="study-plan">
      <div className="study-plan__header">
        <div className="study-plan__heading-wrap">
          <div className="study-plan__title-row">
            <h2>🎯 Personal Study Plan</h2>
            {data?.student?.grade && (
              <span className="study-plan__grade">
                Grade {data.student.grade}
              </span>
            )}
          </div>

          <p>{plan?.title ?? "Your personalized 7-day learning journey"}</p>
          {plan && (
            <span className="study-plan__range">
              {formatDate(plan.startDate)} → {formatDate(plan.endDate)}
            </span>
          )}
        </div>

        <button
          type="button"
          onClick={() => void loadStudyPlan(true)}
          disabled={refreshing}
          className="study-plan__refresh-button"
        >
          {refreshing ? "Refreshing..." : "↻ Refresh"}
        </button>
      </div>

      {studyPlan.length > 0 && (
        <div className="study-plan__progress-wrap">
          <div className="study-plan__progress-card">
            <div className="study-plan__progress-main">
              <div>
                <div className="study-plan__progress-label">7-Day Progress</div>
                <div className="study-plan__progress-subtitle">
                  {progress.completedCount} of {studyPlan.length} activities
                  completed
                </div>
              </div>

              <div className="study-plan__progress-number">
                <div>{progress.percentage}%</div>
                <span>complete</span>
              </div>
            </div>

            <div className="study-plan__progress-bar">
              <span style={{ width: `${progress.percentage}%` }} />
            </div>

            <div className="study-plan__progress-meta">
              <span>
                📅 Today: {progress.todayCompleted}/{progress.todayItems.length}
              </span>
              <span>
                ⏱️ {data?.summary.totalDurationMinutes ?? 0} min planned
              </span>
              {progress.inProgressCount > 0 && (
                <span>▶ {progress.inProgressCount} in progress</span>
              )}
            </div>
          </div>
        </div>
      )}

      {error && data && <div className="study-plan__inline-error">{error}</div>}

      {studyPlan.length === 0 && (
        <div className="study-plan__empty">
          <div className="study-plan__empty-card">
            <div>📚</div>
            <div className="study-plan__empty-title">
              No study activities yet
            </div>
            <div className="study-plan__empty-copy">
              Continue learning and practicing to build your personalized study
              plan.
            </div>
          </div>
        </div>
      )}

      {studyPlan.length > 0 && (
        <div className="study-plan__day-list">
          {dayGroups.map((group) => {
            const isToday = group.date === today;
            const isExpanded = expandedDays[group.date] ?? false;
            const completed = group.items.filter(
              (item) => item.status === "completed",
            ).length;
            const dayPercentage =
              group.items.length > 0
                ? Math.round((completed / group.items.length) * 100)
                : 0;

            return (
              <div
                key={group.date}
                className={`study-plan__day ${isToday ? "is-today" : ""}`}
              >
                <button
                  type="button"
                  onClick={() => toggleDay(group.date)}
                  className="study-plan__day-toggle"
                >
                  <div className="study-plan__day-main">
                    <div
                      className={`study-plan__day-icon ${isToday ? "is-today" : ""}`}
                    >
                      {isToday ? "📅" : "🗓️"}
                    </div>

                    <div>
                      <div className="study-plan__day-label-row">
                        <span>{getDayLabel(group.date, today)}</span>
                        {isToday && (
                          <span className="study-plan__today-badge">TODAY</span>
                        )}
                      </div>
                      <div className="study-plan__day-meta">
                        {formatDate(group.date)} · {group.items.length}{" "}
                        activities
                      </div>
                    </div>
                  </div>

                  <div className="study-plan__day-side">
                    <div className="study-plan__day-summary">
                      <div>
                        {completed}/{group.items.length}
                      </div>
                      <span>{dayPercentage}%</span>
                    </div>
                    <span className="study-plan__collapse-icon">
                      {isExpanded ? "⌃" : "⌄"}
                    </span>
                  </div>
                </button>

                {isExpanded && (
                  <div className="study-plan__day-content">
                    {group.items.map((item) => {
                      const isUpdating = updatingId === item.id;
                      const isCompleted = item.status === "completed";
                      const isInProgress = item.status === "in_progress";

                      return (
                        <div
                          key={item.id}
                          className={`study-plan__activity ${isCompleted ? "is-complete" : ""}`}
                        >
                          <div className="study-plan__activity-head">
                            <div
                              className={`study-plan__activity-icon ${isCompleted ? "is-complete" : ""}`}
                            >
                              {isCompleted
                                ? "✓"
                                : getActivityIcon(item.activityType)}
                            </div>

                            <div className="study-plan__activity-body">
                              <div className="study-plan__activity-top">
                                <div>
                                  <h3>{item.title}</h3>
                                  <p>{item.description}</p>
                                </div>
                                <span className={getStatusClass(item.status)}>
                                  {getStatusLabel(item.status)}
                                </span>
                              </div>

                              <div className="study-plan__activity-meta">
                                <span
                                  className={getActivityTypeClass(
                                    item.activityType,
                                  )}
                                >
                                  {item.activityType}
                                </span>
                                <span className="study-plan__meta-pill">
                                  ⏱️ {item.durationMinutes} min
                                </span>
                                <span className="study-plan__meta-pill">
                                  🌱 {item.topic}
                                </span>
                                {item.accuracy > 0 && (
                                  <span className="study-plan__meta-pill">
                                    📊 {Math.round(item.accuracy)}%
                                  </span>
                                )}
                              </div>

                              {item.status === "pending" && (
                                <button
                                  type="button"
                                  onClick={() => void handleStartActivity(item)}
                                  disabled={isUpdating}
                                  className="study-plan__primary-button"
                                >
                                  {isUpdating
                                    ? "Starting..."
                                    : getActivityButtonLabel(item.activityType)}
                                </button>
                              )}

                              {isInProgress && (
                                <div className="study-plan__status-controls">
                                  <div className="study-plan__in-progress-label">
                                    ▶ Activity in progress
                                  </div>
                                  <button
                                    type="button"
                                    onClick={() =>
                                      void updateActivityStatus(
                                        item.id,
                                        "completed",
                                      )
                                    }
                                    disabled={isUpdating}
                                    className="study-plan__secondary-button"
                                  >
                                    {isUpdating ? "Updating..." : "✓ Complete"}
                                  </button>
                                </div>
                              )}

                              {isCompleted && (
                                <div className="study-plan__completed-banner">
                                  🎉 Great job! You completed this activity.
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
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
