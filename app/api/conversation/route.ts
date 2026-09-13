import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase-server";

export async function GET() {
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

    // Get all conversations for this user
    const { data: conversations, error } =
      await supabase
        .from("conversations")
        .select("id, title, created_at, updated_at")
        .eq("user_id", user.id)
        .order("updated_at", {
          ascending: false,
        });

    if (error) {
      console.error(
        "Conversation query error:",
        error,
      );

      return NextResponse.json(
        { error: error.message },
        { status: 500 },
      );
    }

    return NextResponse.json({
      conversations: conversations ?? [],
    });
  } catch (error) {
    console.error(
      "Conversation API error:",
      error,
    );

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

    // Create a new conversation
    const { data: conversation, error } =
      await supabase
        .from("conversations")
        .insert({
          user_id: user.id,
          title: "New Chat",
        })
        .select("id, title, created_at, updated_at")
        .single();

    if (error) {
      console.error(
        "Conversation creation error:",
        error,
      );

      return NextResponse.json(
        { error: error.message },
        { status: 500 },
      );
    }

    return NextResponse.json({
      conversation,
    });
  } catch (error) {
    console.error(
      "Create conversation API error:",
      error,
    );

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
    const supabase =
      await createSupabaseServerClient();

    // Get authenticated user
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return NextResponse.json(
        {
          error:
            "User is not authenticated",
        },
        { status: 401 },
      );
    }

    // Get conversation ID
    const { searchParams } =
      new URL(request.url);

    const conversationId =
      searchParams.get(
        "conversationId",
      );

    if (!conversationId) {
      return NextResponse.json(
        {
          error:
            "Conversation ID is required",
        },
        { status: 400 },
      );
    }

    // Delete conversation
    const { error } =
      await supabase
        .from("conversations")
        .delete()
        .eq("id", conversationId)
        .eq("user_id", user.id);

    if (error) {
      console.error(
        "Conversation delete error:",
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
    });
  } catch (error) {
    console.error(
      "Delete conversation API error:",
      error,
    );

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