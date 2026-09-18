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
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // --------------------------------------------------
    // 2. Get today's date
    // --------------------------------------------------

    const today = new Date().toISOString().split("T")[0];

    // --------------------------------------------------
    // 3. Find topics due for review
    // --------------------------------------------------

    const { data: memories, error: memoryError } = await adminSupabase
      .from("student_learning_memory")
      .select(
        `
        id,
        topic,
        subject,
        grade,
        mastery_level,
        questions_asked,
        correct_answers,
        incorrect_answers,
        accuracy,
        next_review_date,
        review_interval_days
        `,
      )
      .eq("user_id", user.id)
      .not("next_review_date", "is", null)
      .lte("next_review_date", today);

    if (memoryError) {
      console.error("Smart review fetch error:", memoryError);

      return NextResponse.json(
        {
          error: "Failed to load smart review topics",
          details: memoryError.message,
        },
        { status: 500 },
      );
    }

    // --------------------------------------------------
    // 4. Calculate priority
    // --------------------------------------------------

    const reviewTopics = (memories ?? []).map((memory) => {
      const accuracy = Number(memory.accuracy ?? 0);

      let priority: number;
      let priorityLabel: string;

      if (accuracy < 50) {
        priority = 1;
        priorityLabel = "Needs immediate attention";
      } else if (accuracy < 70) {
        priority = 2;
        priorityLabel = "Needs more practice";
      } else if (accuracy < 90) {
        priority = 3;
        priorityLabel = "Needs reinforcement";
      } else {
        priority = 4;
        priorityLabel = "Strong performance";
      }

      return {
        id: memory.id,
        topic: memory.topic,
        subject: memory.subject,
        grade: memory.grade,

        masteryLevel: memory.mastery_level,

        questionsAsked: memory.questions_asked ?? 0,

        correctAnswers: memory.correct_answers ?? 0,

        incorrectAnswers: memory.incorrect_answers ?? 0,

        accuracy,

        nextReviewDate: memory.next_review_date,

        reviewIntervalDays: memory.review_interval_days ?? 1,

        isDue: true,

        priority,
        priorityLabel,
      };
    });

    // --------------------------------------------------
    // 5. Sort by priority
    // --------------------------------------------------

    reviewTopics.sort((a, b) => {
      // First: weakest topics
      if (a.priority !== b.priority) {
        return a.priority - b.priority;
      }

      // Second: earliest review date
      if (a.nextReviewDate !== b.nextReviewDate) {
        return a.nextReviewDate.localeCompare(b.nextReviewDate);
      }

      // Third: lower accuracy
      return a.accuracy - b.accuracy;
    });

    // --------------------------------------------------
    // 6. Return result
    // --------------------------------------------------

    return NextResponse.json({
      success: true,

      today,

      totalDue: reviewTopics.length,

      reviewTopics,
    });
  } catch (error) {
    console.error("Smart review API error:", error);

    return NextResponse.json(
      {
        error: "Failed to process smart review",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}
