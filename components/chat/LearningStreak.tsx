"use client";

import { useEffect, useState } from "react";

interface WeeklyActivity {
  date: string;
  active: boolean;
  questionsAnswered: number;
  topicsStudied: number;
}

interface StreakData {
  currentStreak: number;
  bestStreak: number;
  activeDays: number;
}

interface Totals {
  questionsAnswered: number;
  topicsStudied: number;
}

interface LearningStreakResponse {
  success: boolean;
  streak: StreakData;
  totals: Totals;
  weeklyActivity: WeeklyActivity[];
}

export default function LearningStreak() {
  const [open, setOpen] = useState(false);
  const [data, setData] =
    useState<LearningStreakResponse | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadStreak = async () => {
      try {
        const response = await fetch(
          "/api/learning-streak",
        );

        const result = await response.json();

        if (!response.ok) {
          throw new Error(
            result.error || "Failed to load streak",
          );
        }

        setData(result);
      } catch (error) {
        console.error(
          "Learning streak error:",
          error,
        );
      } finally {
        setLoading(false);
      }
    };

    loadStreak();
  }, []);

  if (loading || !data) {
    return null;
  }

  const formatDay = (dateString: string) => {
    const date = new Date(
      `${dateString}T00:00:00`,
    );

    return date.toLocaleDateString("en-US", {
      weekday: "short",
    });
  };

  return (
    <div className="w-full border-b bg-white">
      <button
        type="button"
        onClick={() =>
          setOpen((previous) => !previous)
        }
        className="flex w-full items-center justify-between px-6 py-3 text-left hover:bg-gray-50"
      >
        <div>
          <h2 className="font-semibold">
            🔥 Learning Streak
          </h2>

          <p className="text-sm text-gray-500">
            Keep learning every day
          </p>
        </div>

        <span className="text-lg">
          {open ? "▲" : "▼"}
        </span>
      </button>

      {open && (
        <div className="border-t px-6 py-4">
          {/* Streak stats */}

          <div className="grid grid-cols-3 gap-3">
            <div className="rounded-lg border p-3 text-center">
              <div className="text-2xl">
                🔥
              </div>

              <div className="text-xl font-bold">
                {data.streak.currentStreak}
              </div>

              <div className="text-xs text-gray-500">
                Current Streak
              </div>
            </div>

            <div className="rounded-lg border p-3 text-center">
              <div className="text-2xl">
                🏆
              </div>

              <div className="text-xl font-bold">
                {data.streak.bestStreak}
              </div>

              <div className="text-xs text-gray-500">
                Best Streak
              </div>
            </div>

            <div className="rounded-lg border p-3 text-center">
              <div className="text-2xl">
                📅
              </div>

              <div className="text-xl font-bold">
                {data.streak.activeDays}
              </div>

              <div className="text-xs text-gray-500">
                Active Days
              </div>
            </div>
          </div>

          {/* Weekly activity */}

          <div className="mt-5">
            <h3 className="mb-3 text-sm font-semibold">
              Last 7 Days
            </h3>

            <div className="grid grid-cols-7 gap-2">
              {data.weeklyActivity.map(
                (activity) => (
                  <div
                    key={activity.date}
                    className="text-center"
                  >
                    <div className="mb-1 text-xs text-gray-500">
                      {formatDay(activity.date)}
                    </div>

                    <div
                      className={`mx-auto flex h-9 w-9 items-center justify-center rounded-full text-sm ${
                        activity.active
                          ? "bg-green-100"
                          : "bg-gray-100"
                      }`}
                    >
                      {activity.active ? "✓" : "·"}
                    </div>
                  </div>
                ),
              )}
            </div>
          </div>

          {/* Totals */}

          <div className="mt-5 grid grid-cols-2 gap-3">
            <div className="rounded-lg bg-gray-50 p-3">
              <div className="text-sm text-gray-500">
                Questions Answered
              </div>

              <div className="text-lg font-semibold">
                {data.totals.questionsAnswered}
              </div>
            </div>

            <div className="rounded-lg bg-gray-50 p-3">
              <div className="text-sm text-gray-500">
                Topics Studied
              </div>

              <div className="text-lg font-semibold">
                {data.totals.topicsStudied}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}