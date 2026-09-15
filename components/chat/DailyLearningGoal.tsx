"use client";

import { useEffect, useState } from "react";

interface DailyGoal {
  targetQuestions: number;
  completedQuestions: number;
  remainingQuestions: number;
  completed: boolean;
}

export default function DailyLearningGoal() {
  const [goal, setGoal] = useState<DailyGoal | null>(null);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadGoal = async () => {
      try {
        const response = await fetch(
          "/api/daily-learning-goal",
        );

        const data = await response.json();

        if (!response.ok) {
          throw new Error(
            data.error || "Failed to load daily goal",
          );
        }

        setGoal(data.goal);
      } catch (error) {
        console.error(
          "Daily learning goal error:",
          error,
        );
      } finally {
        setLoading(false);
      }
    };

    loadGoal();
  }, []);

  if (loading || !goal) {
    return null;
  }

  const percentage =
    goal.targetQuestions > 0
      ? Math.min(
          100,
          Math.round(
            (goal.completedQuestions /
              goal.targetQuestions) *
              100,
          ),
        )
      : 0;

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
            🎯 Today's Learning Goal
          </h2>

          <p className="text-sm text-gray-500">
            {goal.completed
              ? "Great job! You completed today's goal."
              : `Answer ${goal.remainingQuestions} more question${
                  goal.remainingQuestions === 1
                    ? ""
                    : "s"
                } today.`}
          </p>
        </div>

        <span className="text-lg">
          {open ? "▲" : "▼"}
        </span>
      </button>

      {open && (
        <div className="border-t px-6 py-4">
          {/* Progress header */}

          <div className="mb-2 flex items-center justify-between">
            <span className="text-sm font-medium">
              Questions
            </span>

            <span className="text-sm text-gray-500">
              {goal.completedQuestions} /{" "}
              {goal.targetQuestions}
            </span>
          </div>

          {/* Progress bar */}

          <div className="h-3 w-full overflow-hidden rounded-full bg-gray-200">
            <div
              className="h-full rounded-full bg-green-500 transition-all duration-500"
              style={{
                width: `${percentage}%`,
              }}
            />
          </div>

          {/* Percentage */}

          <div className="mt-2 text-right text-sm text-gray-500">
            {percentage}% complete
          </div>

          {/* Completion message */}

          {goal.completed && (
            <div className="mt-4 rounded-lg bg-green-50 p-3 text-center text-sm font-medium text-green-700">
              🎉 Daily goal completed!
            </div>
          )}

          {!goal.completed && (
            <div className="mt-4 rounded-lg bg-gray-50 p-3 text-center text-sm text-gray-600">
              Keep going! You're making great progress. 💪
            </div>
          )}
        </div>
      )}
    </div>
  );
}