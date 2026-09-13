import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase-server";

export async function GET() {
  try {
    // --------------------------------
    // Create authenticated Supabase client
    // --------------------------------
    const supabase =
      await createSupabaseServerClient();

    // --------------------------------
    // Get authenticated user
    // --------------------------------
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return NextResponse.json(
        {
          error: "User is not authenticated",
        },
        {
          status: 401,
        },
      );
    }

    // --------------------------------
    // Get evaluations
    // --------------------------------
    const {
      data: evaluations,
      error,
    } = await supabase
      .from("rag_evaluations")
      .select(
        "id, question, grade, subject, result_count, top_similarity, relevance, created_at",
      )
      .eq("user_id", user.id)
      .order("created_at", {
        ascending: false,
      });

    if (error) {
      console.error(
        "Failed to load RAG evaluations:",
        error,
      );

      return NextResponse.json(
        {
          error:
            "Failed to load RAG evaluations",
        },
        {
          status: 500,
        },
      );
    }

    const results = evaluations ?? [];

    // --------------------------------
    // Calculate summary
    // --------------------------------
    const totalEvaluations = results.length;

    const highRelevance = results.filter(
      (item) => item.relevance === "high",
    ).length;

    const mediumRelevance = results.filter(
      (item) => item.relevance === "medium",
    ).length;

    const lowRelevance = results.filter(
      (item) => item.relevance === "low",
    ).length;

    const similarityValues = results
      .map((item) => item.top_similarity)
      .filter(
        (value): value is number =>
          typeof value === "number",
      );

    const averageSimilarity =
      similarityValues.length > 0
        ? similarityValues.reduce(
            (sum, value) => sum + value,
            0,
          ) / similarityValues.length
        : 0;

    return NextResponse.json({
      summary: {
        totalEvaluations,
        highRelevance,
        mediumRelevance,
        lowRelevance,
        averageSimilarity,
      },
      evaluations: results,
    });
  } catch (error) {
    console.error(
      "RAG evaluation API error:",
      error,
    );

    return NextResponse.json(
      {
        error:
          "Failed to load RAG evaluation data",
      },
      {
        status: 500,
      },
    );
  }
}