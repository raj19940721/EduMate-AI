"use client";

import { useEffect, useState } from "react";

interface Evaluation {
  id: string;
  question: string;
  grade: number | null;
  subject: string | null;
  result_count: number;
  top_similarity: number | null;
  relevance: "high" | "medium" | "low" | null;
  created_at: string;
}

interface EvaluationSummary {
  totalEvaluations: number;
  highRelevance: number;
  mediumRelevance: number;
  lowRelevance: number;
  averageSimilarity: number;
}

export default function RagEvaluationPage() {
  const [summary, setSummary] =
    useState<EvaluationSummary | null>(null);

  const [evaluations, setEvaluations] =
    useState<Evaluation[]>([]);

  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadEvaluations = async () => {
      try {
        const response = await fetch(
          "/api/rag-evaluation",
        );

        if (!response.ok) {
          throw new Error(
            "Failed to load evaluations",
          );
        }

        const data = await response.json();

        setSummary(data.summary);
        setEvaluations(data.evaluations ?? []);
      } catch (error) {
        console.error(
          "Failed to load RAG evaluations:",
          error,
        );
      } finally {
        setLoading(false);
      }
    };

    loadEvaluations();
  }, []);

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center">
        <p className="text-gray-500">
          Loading evaluation data...
        </p>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-gray-50 p-8">
      <div className="mx-auto max-w-6xl">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">
            RAG Evaluation
          </h1>

          <p className="mt-2 text-gray-600">
            Monitor retrieval quality for EduMate.
          </p>
        </div>

        {/* Summary cards */}
        {summary && (
          <div className="grid gap-4 md:grid-cols-5">
            <div className="rounded-xl bg-white p-5 shadow-sm">
              <p className="text-sm text-gray-500">
                Total Questions
              </p>

              <p className="mt-2 text-3xl font-bold">
                {summary.totalEvaluations}
              </p>
            </div>

            <div className="rounded-xl bg-white p-5 shadow-sm">
              <p className="text-sm text-gray-500">
                High Relevance
              </p>

              <p className="mt-2 text-3xl font-bold text-green-600">
                {summary.highRelevance}
              </p>
            </div>

            <div className="rounded-xl bg-white p-5 shadow-sm">
              <p className="text-sm text-gray-500">
                Medium Relevance
              </p>

              <p className="mt-2 text-3xl font-bold text-yellow-600">
                {summary.mediumRelevance}
              </p>
            </div>

            <div className="rounded-xl bg-white p-5 shadow-sm">
              <p className="text-sm text-gray-500">
                Low Relevance
              </p>

              <p className="mt-2 text-3xl font-bold text-red-600">
                {summary.lowRelevance}
              </p>
            </div>

            <div className="rounded-xl bg-white p-5 shadow-sm">
              <p className="text-sm text-gray-500">
                Avg Similarity
              </p>

              <p className="mt-2 text-3xl font-bold">
                {summary.averageSimilarity.toFixed(3)}
              </p>
            </div>
          </div>
        )}

        {/* Evaluation table */}
        <div className="mt-8 overflow-hidden rounded-xl bg-white shadow-sm">
          <div className="border-b px-6 py-4">
            <h2 className="text-lg font-semibold">
              Recent Evaluations
            </h2>
          </div>

          {evaluations.length === 0 ? (
            <div className="p-6 text-gray-500">
              No evaluation records found.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 font-semibold">
                      Question
                    </th>

                    <th className="px-6 py-3 font-semibold">
                      Grade
                    </th>

                    <th className="px-6 py-3 font-semibold">
                      Subject
                    </th>

                    <th className="px-6 py-3 font-semibold">
                      Results
                    </th>

                    <th className="px-6 py-3 font-semibold">
                      Similarity
                    </th>

                    <th className="px-6 py-3 font-semibold">
                      Relevance
                    </th>
                  </tr>
                </thead>

                <tbody className="divide-y">
                  {evaluations.map(
                    (evaluation) => (
                      <tr key={evaluation.id}>
                        <td className="max-w-md px-6 py-4">
                          {evaluation.question}
                        </td>

                        <td className="px-6 py-4">
                          {evaluation.grade ?? "-"}
                        </td>

                        <td className="px-6 py-4">
                          {evaluation.subject ?? "-"}
                        </td>

                        <td className="px-6 py-4">
                          {evaluation.result_count}
                        </td>

                        <td className="px-6 py-4">
                          {evaluation.top_similarity !==
                          null
                            ? evaluation.top_similarity.toFixed(
                                3,
                              )
                            : "-"}
                        </td>

                        <td className="px-6 py-4">
                          <span
                            className={`rounded-full px-3 py-1 text-xs font-medium ${
                              evaluation.relevance ===
                              "high"
                                ? "bg-green-100 text-green-700"
                                : evaluation.relevance ===
                                    "medium"
                                  ? "bg-yellow-100 text-yellow-700"
                                  : "bg-red-100 text-red-700"
                            }`}
                          >
                            {evaluation.relevance ??
                              "unknown"}
                          </span>
                        </td>
                      </tr>
                    ),
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}