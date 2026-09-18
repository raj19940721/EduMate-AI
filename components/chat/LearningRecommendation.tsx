"use client";

import { useEffect, useState } from "react";

interface Recommendation {
  topic: string;
  action: "review" | "practice" | "next_topic";
  reason: string;
  priority: "high" | "medium" | "low";
}

export default function LearningRecommendation() {
  const [recommendation, setRecommendation] = useState<Recommendation | null>(
    null,
  );
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const loadRecommendation = async () => {
      try {
        setLoading(true);
        setError("");

        const response = await fetch("/api/learning-recommendation");
        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error || "Failed to load recommendation");
        }

        setRecommendation(data.recommendation ?? null);
      } catch (error) {
        console.error("Failed to load learning recommendation:", error);
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
      <div className="learning-recommendation learning-recommendation--loading">
        <p>🤖 Preparing your learning recommendation...</p>
      </div>
    );
  }

  if (error || !recommendation) {
    return null;
  }

  return (
    <div className="learning-recommendation">
      <div className="learning-recommendation__card">
        <div className="learning-recommendation__top">
          <div>
            <p className="learning-recommendation__eyebrow">
              🎯 Your Learning Recommendation
            </p>
            <h2>{recommendation.topic}</h2>
          </div>

          <span className="learning-recommendation__badge">
            {recommendation.priority}
          </span>
        </div>

        <p className="learning-recommendation__reason">
          {recommendation.reason}
        </p>
        <p className="learning-recommendation__action">
          Recommended action: {recommendation.action.replace("_", " ")}
        </p>
      </div>
    </div>
  );
}
