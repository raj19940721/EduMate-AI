import { NextResponse } from "next/server";
import { supabase as adminSupabase } from "@/lib/supabase";
import { generateEmbedding } from "@/lib/embeddings";

export async function PUT(request: Request) {
  try {
    const body = await request.json();

    const id = body.id;
    const content = body.content;
    const metadata = body.metadata;

    // 1. Validate input
    if (typeof id !== "string" || !id.trim()) {
      return NextResponse.json(
        {
          error: "Knowledge ID is required.",
        },
        { status: 400 },
      );
    }

    if (typeof content !== "string" || !content.trim()) {
      return NextResponse.json(
        {
          error: "Content is required.",
        },
        { status: 400 },
      );
    }

    // 2. Generate a new embedding
    const embedding = await generateEmbedding(content);

    console.log("Updated embedding dimensions:", embedding.length);

    // 3. Update content + metadata + embedding
    const { data, error } = await adminSupabase
      .from("knowledge_chunks")
      .update({
        content,
        metadata: metadata ?? {},
        embedding,
      })
      .eq("id", id)
      .select()
      .single();

    if (error) {
      console.error("Knowledge update error:", error);

      return NextResponse.json(
        {
          error: "Failed to update knowledge.",
        },
        { status: 500 },
      );
    }

    return NextResponse.json({
      message: "Knowledge updated and embedding regenerated successfully.",
      knowledge: data,
    });
  } catch (error) {
    console.error("Knowledge update API error:", error);

    return NextResponse.json(
      {
        error: "Failed to update knowledge.",
      },
      { status: 500 },
    );
  }
}
