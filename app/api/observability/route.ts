import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

export async function GET() {
  try {
    const { data, error } = await supabase
      .from("observability_logs")
      .select("*")
      .order("created_at", {
        ascending: false,
      })
      .limit(50);

    if (error) {
      console.error(
        "Failed to load observability logs:",
        error,
      );

      return NextResponse.json(
        {
          error:
            "Failed to load observability logs.",
        },
        { status: 500 },
      );
    }

    const logs = data ?? [];

    const totalRequests = logs.length;

    const average = (
      values: number[],
    ) =>
      values.length > 0
        ? values.reduce(
            (sum, value) => sum + value,
            0,
          ) / values.length
        : 0;

    const averageTotalTime = average(
      logs.map(
        (log) => log.total_time_ms ?? 0,
      ),
    );

    const averageEmbeddingTime = average(
      logs.map(
        (log) =>
          log.embedding_time_ms ?? 0,
      ),
    );

    const averageRetrievalTime = average(
      logs.map(
        (log) =>
          log.retrieval_time_ms ?? 0,
      ),
    );

    const highRelevance = logs.filter(
      (log) =>
        log.top_relevance === "high",
    ).length;

    const mediumRelevance = logs.filter(
      (log) =>
        log.top_relevance === "medium",
    ).length;

    const lowRelevance = logs.filter(
      (log) =>
        log.top_relevance === "low",
    ).length;

    return NextResponse.json({
      summary: {
        totalRequests,
        averageTotalTime,
        averageEmbeddingTime,
        averageRetrievalTime,
        highRelevance,
        mediumRelevance,
        lowRelevance,
      },
      logs,
    });
  } catch (error) {
    console.error(
      "Observability API error:",
      error,
    );

    return NextResponse.json(
      {
        error:
          "Failed to load observability data.",
      },
      { status: 500 },
    );
  }
}