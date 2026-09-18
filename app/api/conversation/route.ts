import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { supabase } from "@/lib/supabase";

export async function GET() {
  try {
    const supabaseServer = await createSupabaseServerClient();

    // Get authenticated user
    const {
      data: { user },
      error: userError,
    } = await supabaseServer.auth.getUser();

    if (userError || !user) {
      return NextResponse.json(
        { error: "User is not authenticated" },
        { status: 401 },
      );
    }

    // Get all conversations for this user
    const { data: conversations, error } = await supabaseServer
      .from("conversations")
      .select("id, title, created_at, updated_at")
      .eq("user_id", user.id)
      .order("updated_at", {
        ascending: false,
      });

    if (error) {
      console.error("Conversation query error:", error);

      return NextResponse.json(
        { error: "Failed to load conversations" },
        { status: 500 },
      );
    }

    return NextResponse.json({
      conversations: conversations ?? [],
    });
  } catch (error) {
    console.error("Conversation API error:", error);

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to load conversations",
      },
      { status: 500 },
    );
  }
}

export async function POST() {
  try {
    const supabaseServer = await createSupabaseServerClient();

    // Get authenticated user
    const {
      data: { user },
      error: userError,
    } = await supabaseServer.auth.getUser();

    if (userError || !user) {
      return NextResponse.json(
        {
          error: "User is not authenticated",
        },
        { status: 401 },
      );
    }

    // Create a new conversation
    const { data: conversation, error } = await supabaseServer
      .from("conversations")
      .insert({
        user_id: user.id,
        title: "New Chat",
      })
      .select("id, title, created_at, updated_at")
      .single();

    if (error) {
      console.error("Conversation creation error:", error);

      return NextResponse.json(
        {
          error: "Failed to create conversation",
        },
        { status: 500 },
      );
    }

    return NextResponse.json({
      conversation,
    });
  } catch (error) {
    console.error("Create conversation API error:", error);

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to create conversation",
      },
      { status: 500 },
    );
  }
}

export async function DELETE(request: Request) {
  try {
    const supabaseServer = await createSupabaseServerClient();

    // =========================================================
    // 1. Get authenticated user
    // =========================================================

    const {
      data: { user },
      error: userError,
    } = await supabaseServer.auth.getUser();

    if (userError || !user) {
      return NextResponse.json(
        {
          error: "User is not authenticated",
        },
        { status: 401 },
      );
    }

    // =========================================================
    // 2. Get conversation ID
    // =========================================================

    const { searchParams } = new URL(request.url);

    const conversationId = searchParams.get("conversationId");

    if (!conversationId) {
      return NextResponse.json(
        {
          error: "Conversation ID is required",
        },
        { status: 400 },
      );
    }

    // =========================================================
    // 3. Verify conversation belongs to this user
    // =========================================================

    const { data: conversation, error: conversationLookupError } =
      await supabaseServer
        .from("conversations")
        .select("id, user_id")
        .eq("id", conversationId)
        .eq("user_id", user.id)
        .maybeSingle();

    if (conversationLookupError) {
      console.error(
        "Conversation ownership check error:",
        conversationLookupError,
      );

      return NextResponse.json(
        {
          error: "Failed to verify conversation ownership",
        },
        { status: 500 },
      );
    }

    if (!conversation) {
      return NextResponse.json(
        {
          error: "Conversation not found",
        },
        { status: 404 },
      );
    }

    // =========================================================
    // 4. Delete RAG evaluations
    // =========================================================

    const { error: ragEvaluationError } = await supabase
      .from("rag_evaluations")
      .delete()
      .eq("conversation_id", conversationId);

    if (ragEvaluationError) {
      console.error("RAG evaluation delete error:", ragEvaluationError);

      return NextResponse.json(
        {
          error: "Failed to delete conversation evaluation data",
        },
        { status: 500 },
      );
    }

    // =========================================================
    // 5. Delete messages
    // =========================================================

    const { error: messageDeleteError } = await supabase
      .from("messages")
      .delete()
      .eq("conversation_id", conversationId);

    if (messageDeleteError) {
      console.error("Message delete error:", messageDeleteError);

      return NextResponse.json(
        {
          error: "Failed to delete conversation messages",
        },
        { status: 500 },
      );
    }

    // =========================================================
    // 6. Delete conversation
    // =========================================================

    const { error: conversationDeleteError } = await supabase
      .from("conversations")
      .delete()
      .eq("id", conversationId)
      .eq("user_id", user.id);

    if (conversationDeleteError) {
      console.error("Conversation delete error:", conversationDeleteError);

      return NextResponse.json(
        {
          error: "Failed to delete conversation",
        },
        { status: 500 },
      );
    }

    // =========================================================
    // 7. Success
    // =========================================================

    return NextResponse.json({
      success: true,
      message: "Conversation deleted successfully",
    });
  } catch (error) {
    console.error("Delete conversation API error:", error);

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to delete conversation",
      },
      { status: 500 },
    );
  }
}
