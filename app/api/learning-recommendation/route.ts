import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { supabase as adminSupabase } from "@/lib/supabase";
import { generateLearningRecommendation } from "@/lib/learning-recommendation";

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
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // ----------------------------------------
    // 2. Load student's learning memory
    // ----------------------------------------
    const { data: memories, error: memoryError } = await adminSupabase
      .from("student_learning_memory")
      .select(
        `
          topic,
          subject,
          questions_asked,
          correct_answers,
          incorrect_answers,
          accuracy,
          mastery_level,
          notes
          `,
      )
      .eq("user_id", user.id)
      .order("updated_at", {
        ascending: false,
      })
      .limit(20);

    if (memoryError) {
      console.error("Failed to load learning memories:", memoryError);

      return NextResponse.json(
        {
          error: "Failed to load learning memories",
        },
        { status: 500 },
      );
    }

    // ----------------------------------------
    // 3. Check whether student has learning data
    // ----------------------------------------
    if (!memories || memories.length === 0) {
      return NextResponse.json({
        success: true,
        recommendation: null,
        message: "No learning data available yet.",
      });
    }

    // ----------------------------------------
    // 4. Generate AI recommendation
    // ----------------------------------------
    const recommendation = await generateLearningRecommendation(memories);

    // ----------------------------------------
    // 5. Return recommendation
    // ----------------------------------------
    return NextResponse.json({
      success: true,
      recommendation,
    });
  } catch (error) {
    console.error("Learning recommendation API error:", error);

    return NextResponse.json(
      {
        error: "Failed to generate learning recommendation",
      },
      { status: 500 },
    );
  }
}
