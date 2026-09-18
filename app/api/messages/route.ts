import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase-server";

export async function GET(request: Request) {
  try {
    const supabase = await createSupabaseServerClient();

    // Get authenticated user
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return NextResponse.json(
        { error: "User is not authenticated" },
        { status: 401 },
      );
    }

    // Get conversation ID from URL
    const { searchParams } = new URL(request.url);
    const conversationId = searchParams.get("conversationId");

    if (!conversationId) {
      return NextResponse.json(
        { error: "Conversation ID is required" },
        { status: 400 },
      );
    }

    // Load messages
    const { data: messages, error: messagesError } = await supabase
      .from("messages")
      .select("id, role, content, created_at")
      .eq("conversation_id", conversationId)
      .eq("user_id", user.id)
      .order("created_at", {
        ascending: true,
      });

    if (messagesError) {
      console.error("Messages query error:", messagesError);

      return NextResponse.json(
        { error: messagesError.message },
        { status: 500 },
      );
    }

    return NextResponse.json({
      messages: messages ?? [],
    });
  } catch (error) {
    console.error("Messages API error:", error);

    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Failed to load messages",
      },
      { status: 500 },
    );
  }
}
