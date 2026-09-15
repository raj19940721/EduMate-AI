import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { supabase as adminSupabase } from "@/lib/supabase";

export async function GET() {
  try {
    // --------------------------------------------------
    // 1. Authenticate user
    // --------------------------------------------------

    const supabase = await createSupabaseServerClient();

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 },
      );
    }

    // --------------------------------------------------
    // 2. Get today's date
    // --------------------------------------------------

    const today = new Date()
      .toISOString()
      .split("T")[0];

    // --------------------------------------------------
    // 3. Load today's goal
    // --------------------------------------------------

    const {
      data: goal,
      error: goalError,
    } = await adminSupabase
      .from("daily_learning_goals")
      .select(
        "id, goal_date, target_questions, completed_questions",
      )
      .eq("user_id", user.id)
      .eq("goal_date", today)
      .maybeSingle();

    if (goalError) {
      console.error(
        "Daily goal fetch error:",
        goalError,
      );

      return NextResponse.json(
        {
          error: "Failed to load daily learning goal",
          details: goalError.message,
        },
        { status: 500 },
      );
    }

    // --------------------------------------------------
    // 4. No goal yet
    // --------------------------------------------------

    if (!goal) {
      return NextResponse.json({
        success: true,
        goal: null,
      });
    }

    // --------------------------------------------------
    // 5. Calculate progress
    // --------------------------------------------------

    const targetQuestions =
      goal.target_questions ?? 5;

    const completedQuestions =
      goal.completed_questions ?? 0;

    const remainingQuestions = Math.max(
      0,
      targetQuestions - completedQuestions,
    );

    const completed =
      completedQuestions >= targetQuestions;

    // --------------------------------------------------
    // 6. Return result
    // --------------------------------------------------

    return NextResponse.json({
      success: true,

      goal: {
        targetQuestions,
        completedQuestions,
        remainingQuestions,
        completed,
      },
    });
  } catch (error) {
    console.error(
      "Daily goal API error:",
      error,
    );

    return NextResponse.json(
      {
        error:
          "Failed to load daily learning goal",
        details:
          error instanceof Error
            ? error.message
            : "Unknown error",
      },
      { status: 500 },
    );
  }
}