import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { generateEmbedding } from "@/lib/embeddings";

export async function POST(request: Request) {
  try {
    const body = await request.json();

    const query = body.query;
    const grade = body.grade;
    const subject = body.subject;

    if (
      typeof query !== "string" ||
      !query.trim()
    ) {
      return NextResponse.json(
        {
          error: "Query is required",
        },
        { status: 400 },
      );
    }

    // Generate query embedding
    const queryEmbedding =
      await generateEmbedding(query);

    console.log(
      "Query embedding dimensions:",
      queryEmbedding.length,
    );

    // Vector search with metadata filters
    const { data, error } =
      await supabase.rpc(
        "match_knowledge_chunks",
        {
          query_embedding: queryEmbedding,
          match_threshold: 0.3,
          match_count: 5,
          match_grade:
            typeof grade === "number"
              ? grade
              : null,
          match_subject:
            typeof subject === "string" &&
            subject.trim()
              ? subject
              : null,
        },
      );

    if (error) {
      console.error(
        "Vector search error:",
        error,
      );

      return NextResponse.json(
        {
          error: error.message,
        },
        { status: 500 },
      );
    }

    return NextResponse.json({
      results: data ?? [],
    });
  } catch (error) {
    console.error(
      "Knowledge search error:",
      error,
    );

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to search knowledge",
      },
      { status: 500 },
    );
  }
}