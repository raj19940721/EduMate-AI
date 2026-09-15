import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { supabase as adminSupabase } from "@/lib/supabase";

export async function GET() {
  try {
    // ----------------------------------------
    // 1. Authenticate student
    // ----------------------------------------
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

    // ----------------------------------------
    // 2. Get learning memories
    // ----------------------------------------
    const { data: memories, error: memoryError } =
      await adminSupabase
        .from("student_learning_memory")
        .select(
          "id, topic, subject, grade, mastery_level, questions_asked, correct_answers, incorrect_answers, accuracy, notes, created_at, updated_at",
        )
        .eq("user_id", user.id)
        .order("updated_at", {
          ascending: false,
        });

    if (memoryError) {
      console.error(
        "Failed to load learning progress:",
        memoryError,
      );

      return NextResponse.json(
        {
          error:
            "Failed to load learning progress",
        },
        { status: 500 },
      );
    }

    // ----------------------------------------
    // 3. Calculate overall statistics
    // ----------------------------------------
    const totalTopics = memories?.length ?? 0;

    const totalQuestions =
      memories?.reduce(
        (total, memory) =>
          total +
          (memory.questions_asked ?? 0),
        0,
      ) ?? 0;

    const totalCorrect =
      memories?.reduce(
        (total, memory) =>
          total +
          (memory.correct_answers ?? 0),
        0,
      ) ?? 0;

    const totalIncorrect =
      memories?.reduce(
        (total, memory) =>
          total +
          (memory.incorrect_answers ?? 0),
        0,
      ) ?? 0;

    const overallAccuracy =
      totalQuestions > 0
        ? Number(
            (
              (totalCorrect /
                totalQuestions) *
              100
            ).toFixed(2),
          )
        : 0;

    const masteredTopics =
      memories?.filter(
        (memory) =>
          memory.mastery_level ===
          "mastered",
      ).length ?? 0;

    const practicingTopics =
      memories?.filter(
        (memory) =>
          memory.mastery_level ===
          "practicing",
      ).length ?? 0;

    const learningTopics =
      memories?.filter(
        (memory) =>
          memory.mastery_level ===
          "learning",
      ).length ?? 0;

    // ----------------------------------------
    // 4. Return progress
    // ----------------------------------------
    return NextResponse.json({
      success: true,

      summary: {
        totalTopics,
        totalQuestions,
        totalCorrect,
        totalIncorrect,
        overallAccuracy,
        masteredTopics,
        practicingTopics,
        learningTopics,
      },

      topics: memories ?? [],
    });
  } catch (error) {
    console.error(
      "Learning progress API error:",
      error,
    );

    return NextResponse.json(
      {
        error:
          "Failed to load learning progress",
      },
      { status: 500 },
    );
  }
}