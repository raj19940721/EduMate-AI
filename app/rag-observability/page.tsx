"use client";

import { useEffect, useState } from "react";

interface ObservabilityLog {
  id: string;
  question: string;
  grade: number | null;
  subject: string | null;
  guardrail_allowed: boolean;
  embedding_time_ms: number | null;
  retrieval_time_ms: number | null;
  total_time_ms: number | null;
  result_count: number;
  usable_result_count: number;
  top_similarity: number | null;
  top_relevance: "high" | "medium" | "low" | null;
  ai_mode: "mock" | "gemini" | null;
  created_at: string;
}

interface ObservabilitySummary {
  totalRequests: number;
  averageTotalTime: number;
  averageEmbeddingTime: number;
  averageRetrievalTime: number;
  highRelevance: number;
  mediumRelevance: number;
  lowRelevance: number;
}

export default function RagObservabilityPage() {
  const [summary, setSummary] = useState<ObservabilitySummary | null>(null);

  const [logs, setLogs] = useState<ObservabilityLog[]>([]);

  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadObservability = async () => {
      try {
        const response = await fetch("/api/observability");

        if (!response.ok) {
          throw new Error("Failed to load observability data");
        }

        const data = await response.json();

        setSummary(data.summary);
        setLogs(data.logs ?? []);
      } catch (error) {
        console.error("Failed to load observability:", error);
      } finally {
        setLoading(false);
      }
    };

    loadObservability();
  }, []);

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center">
        <p className="text-gray-500">Loading observability data...</p>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-gray-50 p-8">
      <div className="mx-auto max-w-7xl">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">
            EduMate Observability
          </h1>

          <p className="mt-2 text-gray-600">
            Monitor RAG performance, latency, and retrieval quality.
          </p>
        </div>

        {/* Summary Cards */}
        {summary && (
          <div className="grid gap-4 md:grid-cols-3 lg:grid-cols-6">
            <div className="rounded-xl bg-white p-5 shadow-sm">
              <p className="text-sm text-gray-500">Total Requests</p>

              <p className="mt-2 text-2xl font-bold">{summary.totalRequests}</p>
            </div>

            <div className="rounded-xl bg-white p-5 shadow-sm">
              <p className="text-sm text-gray-500">Avg Total Time</p>

              <p className="mt-2 text-2xl font-bold">
                {Math.round(summary.averageTotalTime)} ms
              </p>
            </div>

            <div className="rounded-xl bg-white p-5 shadow-sm">
              <p className="text-sm text-gray-500">Avg Embedding</p>

              <p className="mt-2 text-2xl font-bold">
                {Math.round(summary.averageEmbeddingTime)} ms
              </p>
            </div>

            <div className="rounded-xl bg-white p-5 shadow-sm">
              <p className="text-sm text-gray-500">Avg Retrieval</p>

              <p className="mt-2 text-2xl font-bold">
                {Math.round(summary.averageRetrievalTime)} ms
              </p>
            </div>

            <div className="rounded-xl bg-white p-5 shadow-sm">
              <p className="text-sm text-gray-500">High Relevance</p>

              <p className="mt-2 text-2xl font-bold text-green-600">
                {summary.highRelevance}
              </p>
            </div>

            <div className="rounded-xl bg-white p-5 shadow-sm">
              <p className="text-sm text-gray-500">Medium / Low</p>

              <p className="mt-2 text-2xl font-bold text-yellow-600">
                {summary.mediumRelevance} / {summary.lowRelevance}
              </p>
            </div>
          </div>
        )}

        {/* Recent Requests */}
        <div className="mt-8 overflow-hidden rounded-xl bg-white shadow-sm">
          <div className="border-b px-6 py-4">
            <h2 className="text-lg font-semibold text-gray-900">
              Recent Requests
            </h2>
          </div>

          {logs.length === 0 ? (
            <div className="p-6 text-gray-500">
              No observability records found.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="border-b bg-gray-50 text-gray-600">
                  <tr>
                    <th className="px-6 py-3">Question</th>

                    <th className="px-6 py-3">Grade</th>

                    <th className="px-6 py-3">Subject</th>

                    <th className="px-6 py-3">Embedding</th>

                    <th className="px-6 py-3">Retrieval</th>

                    <th className="px-6 py-3">Total</th>

                    <th className="px-6 py-3">Similarity</th>

                    <th className="px-6 py-3">Relevance</th>

                    <th className="px-6 py-3">AI</th>
                  </tr>
                </thead>

                <tbody>
                  {logs.map((log) => (
                    <tr key={log.id} className="border-b last:border-b-0">
                      <td className="max-w-xs px-6 py-4">
                        <div className="truncate font-medium text-gray-900">
                          {log.question}
                        </div>
                      </td>

                      <td className="px-6 py-4">{log.grade ?? "-"}</td>

                      <td className="px-6 py-4">{log.subject ?? "-"}</td>

                      <td className="px-6 py-4">
                        {log.embedding_time_ms ?? "-"} ms
                      </td>

                      <td className="px-6 py-4">
                        {log.retrieval_time_ms ?? "-"} ms
                      </td>

                      <td className="px-6 py-4 font-medium">
                        {log.total_time_ms ?? "-"} ms
                      </td>

                      <td className="px-6 py-4">
                        {log.top_similarity !== null
                          ? log.top_similarity.toFixed(3)
                          : "-"}
                      </td>

                      <td className="px-6 py-4">
                        {log.top_relevance ? (
                          <span
                            className={`rounded-full px-2 py-1 text-xs font-medium ${
                              log.top_relevance === "high"
                                ? "bg-green-100 text-green-700"
                                : log.top_relevance === "medium"
                                  ? "bg-yellow-100 text-yellow-700"
                                  : "bg-red-100 text-red-700"
                            }`}
                          >
                            {log.top_relevance}
                          </span>
                        ) : (
                          "-"
                        )}
                      </td>

                      <td className="px-6 py-4">{log.ai_mode ?? "-"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
