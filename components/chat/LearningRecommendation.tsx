"use client";

import { useEffect, useState } from "react";

interface Recommendation {
  topic: string;
  action:
    | "review"
    | "practice"
    | "next_topic";
  reason: string;
  priority: "high" | "medium" | "low";
}

export default function LearningRecommendation() {
  const [recommendation, setRecommendation] =
    useState<Recommendation | null>(null);

  const [loading, setLoading] =
    useState(true);

  const [error, setError] = useState("");

  useEffect(() => {
    const loadRecommendation = async () => {
      try {
        setLoading(true);
        setError("");

        const response = await fetch(
          "/api/learning-recommendation",
        );

        const data =
          await response.json();

        if (!response.ok) {
          throw new Error(
            data.error ||
              "Failed to load recommendation",
          );
        }

        setRecommendation(
          data.recommendation ?? null,
        );
      } catch (error) {
        console.error(
          "Failed to load learning recommendation:",
          error,
        );

        setError(
          error instanceof Error
            ? error.message
            : "Failed to load recommendation",
        );
      } finally {
        setLoading(false);
      }
    };

    loadRecommendation();
  }, []);

  if (loading) {
    return (
      <div className="border-b bg-white px-6 py-3">
        <p className="text-sm text-gray-500">
          🤖 Preparing your learning
          recommendation...
        </p>
      </div>
    );
  }

  if (error) {
    return null;
  }

  if (!recommendation) {
    return null;
  }

  return (
    <div className="border-b bg-white px-6 py-3">
      <div className="rounded-lg border bg-gray-50 p-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-sm font-medium text-gray-500">
              🎯 Your Learning Recommendation
            </p>

            <h2 className="mt-1 font-semibold">
              {recommendation.topic}
            </h2>
          </div>

          <span className="rounded-full border px-2 py-1 text-xs capitalize">
            {recommendation.priority}
          </span>
        </div>

        <p className="mt-2 text-sm">
          {recommendation.reason}
        </p>

        <p className="mt-2 text-xs font-medium capitalize text-gray-500">
          Recommended action:{" "}
          {recommendation.action.replace(
            "_",
            " ",
          )}
        </p>
      </div>
    </div>
  );
}