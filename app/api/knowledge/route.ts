import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { generateEmbedding } from "@/lib/embeddings";

export async function POST(request: Request) {
  try {
    const body = await request.json();

    const content = body.content;
    const metadata = body.metadata ?? {};

    if (
      typeof content !== "string" ||
      !content.trim()
    ) {
      return NextResponse.json(
        {
          error: "Content is required",
        },
        { status: 400 },
      );
    }

    // Generate embedding
    const embedding =
      await generateEmbedding(content);

    console.log(
      "Embedding dimensions:",
      embedding.length,
    );

    // Store content + embedding
    const { data, error } =
      await supabase
        .from("knowledge_chunks")
        .insert({
          content,
          metadata,
          embedding,
        })
        .select(
          "id, content, metadata, created_at",
        )
        .single();

    if (error) {
      console.error(
        "Knowledge insert error:",
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
      success: true,
      knowledge: data,
    });
  } catch (error) {
    console.error(
      "Knowledge API error:",
      error,
    );

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to create knowledge",
      },
      { status: 500 },
    );
  }
}