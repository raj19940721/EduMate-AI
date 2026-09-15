"use client";

import { useEffect, useState } from "react";

interface Achievement {
  id: string;
  achievement_key: string;
  achievement_name: string;
  description: string | null;
  earned_at: string;
}

export default function LearningAchievements() {
  const [open, setOpen] = useState(false);
  const [achievements, setAchievements] = useState<
    Achievement[]
  >([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadAchievements = async () => {
      try {
        const response = await fetch(
          "/api/learning-achievements",
        );

        const data = await response.json();

        if (!response.ok) {
          throw new Error(
            data.error ||
              "Failed to load achievements",
          );
        }

        setAchievements(
          data.achievements ?? [],
        );
      } catch (error) {
        console.error(
          "Learning achievements error:",
          error,
        );
      } finally {
        setLoading(false);
      }
    };

    loadAchievements();
  }, []);

  if (loading) {
    return null;
  }

  const getAchievementIcon = (
    achievementKey: string,
  ) => {
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
            🏆 Achievements
          </h2>

          <p className="text-sm text-gray-500">
            {achievements.length === 0
              ? "Start learning to earn badges"
              : `${achievements.length} achievement${
                  achievements.length === 1
                    ? ""
                    : "s"
                } earned`}
          </p>
        </div>

        <span className="text-lg">
          {open ? "▲" : "▼"}
        </span>
      </button>

      {open && (
        <div className="max-h-[320px] overflow-y-auto border-t px-6 py-4">
          {achievements.length === 0 ? (
            <div className="rounded-lg bg-gray-50 p-5 text-center">
              <div className="mb-2 text-3xl">
                🌱
              </div>

              <p className="text-sm font-medium">
                No achievements yet
              </p>

              <p className="mt-1 text-xs text-gray-500">
                Keep learning and complete quizzes
                to earn your first badge!
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {achievements.map(
                (achievement) => (
                  <div
                    key={achievement.id}
                    className="flex items-center gap-3 rounded-lg border p-3"
                  >
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-gray-100 text-2xl">
                      {getAchievementIcon(
                        achievement.achievement_key,
                      )}
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="font-medium">
                        {
                          achievement.achievement_name
                        }
                      </div>

                      {achievement.description && (
                        <div className="text-sm text-gray-500">
                          {
                            achievement.description
                          }
                        </div>
                      )}

                      <div className="mt-1 text-xs text-gray-400">
                        Earned{" "}
                        {new Date(
                          achievement.earned_at,
                        ).toLocaleDateString()}
                      </div>
                    </div>
                  </div>
                ),
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}