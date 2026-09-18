import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { supabase as adminSupabase } from "@/lib/supabase";

// ========================================
// GET - Retrieve student's learning memory
// ========================================
export async function GET() {
  try {
    // --------------------------------
    // Create authenticated Supabase client
    // --------------------------------
    const supabase = await createSupabaseServerClient();

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
          error: "User is not authenticated.",
        },
        {
          status: 401,
        },
      );
    }

    // --------------------------------
    // Get student's learning memory
    // --------------------------------
    const { data, error } = await adminSupabase
      .from("student_learning_memory")
      .select(
        "id, topic, subject, grade, mastery_level, notes, created_at, updated_at",
      )
      .eq("user_id", user.id)
      .order("updated_at", {
        ascending: false,
      });

    if (error) {
      console.error("Failed to retrieve learning memory:", error);

      return NextResponse.json(
        {
          error: "Failed to retrieve learning memory.",
        },
        {
          status: 500,
        },
      );
    }

    return NextResponse.json({
      memories: data ?? [],
      count: data?.length ?? 0,
    });
  } catch (error) {
    console.error("Learning memory GET API error:", error);

    return NextResponse.json(
      {
        error: "Failed to retrieve learning memory.",
      },
      {
        status: 500,
      },
    );
  }
}

// ========================================
// POST - Save student's learning memory
// ========================================
export async function POST(request: Request) {
  try {
    // --------------------------------
    // Create authenticated Supabase client
    // --------------------------------
    const supabase = await createSupabaseServerClient();

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
          error: "User is not authenticated.",
        },
        {
          status: 401,
        },
      );
    }

    // --------------------------------
    // Read request body
    // --------------------------------
    const body = await request.json();

    const { topic, subject, grade, masteryLevel = "learning", notes } = body;

    // --------------------------------
    // Validate topic
    // --------------------------------
    if (!topic || typeof topic !== "string") {
      return NextResponse.json(
        {
          error: "Topic is required.",
        },
        {
          status: 400,
        },
      );
    }

    // --------------------------------
    // Save using authenticated user ID
    // IMPORTANT:
    // Never trust userId from request body.
    // --------------------------------
    const { data, error } = await adminSupabase
      .from("student_learning_memory")
      .insert({
        user_id: user.id,
        topic: topic.trim(),
        subject: subject ?? null,
        grade: grade ?? null,
        mastery_level: masteryLevel,
        notes: notes ?? null,
      })
      .select()
      .single();

    if (error) {
      console.error("Learning memory insert error:", error);

      return NextResponse.json(
        {
          error: "Failed to save learning memory.",
        },
        {
          status: 500,
        },
      );
    }

    return NextResponse.json({
      message: "Learning memory saved successfully.",
      memory: data,
    });
  } catch (error) {
    console.error("Learning memory POST API error:", error);

    return NextResponse.json(
      {
        error: "Failed to save learning memory.",
      },
      {
        status: 500,
      },
    );
  }
}
