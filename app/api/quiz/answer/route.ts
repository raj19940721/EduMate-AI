import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { supabase as adminSupabase } from "@/lib/supabase";

export async function POST(request: Request) {
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
    // 2. Read request body
    // ----------------------------------------
    const body = await request.json();

    const {
      topic,
      studentAnswer,
      correctAnswer,
    } = body;

    if (!topic || !studentAnswer || !correctAnswer) {
      return NextResponse.json(
        {
          error:
            "topic, studentAnswer and correctAnswer are required",
        },
        { status: 400 },
      );
    }

    // ----------------------------------------
    // 3. Check answer
    // ----------------------------------------
    const isCorrect =
      studentAnswer.trim().toLowerCase() ===
      correctAnswer.trim().toLowerCase();

    // ----------------------------------------
    // 4. Find student's learning memory
    // ----------------------------------------
    const { data: memory, error: memoryError } =
      await adminSupabase
        .from("student_learning_memory")
        .select(
          "id, questions_asked, correct_answers, incorrect_answers, accuracy, mastery_level",
        )
        .eq("user_id", user.id)
        .eq("topic", topic)
        .maybeSingle();

    if (memoryError) {
      console.error(
        "Failed to find learning memory:",
        memoryError,
      );

      return NextResponse.json(
        { error: "Failed to find learning memory" },
        { status: 500 },
      );
    }

    if (!memory) {
      return NextResponse.json(
        {
          error: `No learning memory found for topic: ${topic}`,
        },
        { status: 404 },
      );
    }

    // ----------------------------------------
    // 5. Update quiz statistics
    // ----------------------------------------
    const questionsAsked =
      (memory.questions_asked ?? 0) + 1;

    const correctAnswers =
      (memory.correct_answers ?? 0) +
      (isCorrect ? 1 : 0);

    const incorrectAnswers =
      (memory.incorrect_answers ?? 0) +
      (isCorrect ? 0 : 1);

    const accuracy =
      questionsAsked > 0
        ? Number(
            ((correctAnswers / questionsAsked) * 100).toFixed(2),
          )
        : 0;

    // ----------------------------------------
    // 6. Calculate mastery
    // ----------------------------------------
    let masteryLevel:
      | "learning"
      | "practicing"
      | "mastered";

    if (accuracy >= 90 && questionsAsked >= 5) {
      masteryLevel = "mastered";
    } else if (accuracy >= 50) {
      masteryLevel = "practicing";
    } else {
      masteryLevel = "learning";
    }

    // ----------------------------------------
    // 7. Save updated learning memory
    // ----------------------------------------
    const { data: updatedMemory, error: updateError } =
      await adminSupabase
        .from("student_learning_memory")
        .update({
          questions_asked: questionsAsked,
          correct_answers: correctAnswers,
          incorrect_answers: incorrectAnswers,
          accuracy,
          mastery_level: masteryLevel,
          updated_at: new Date().toISOString(),
        })
        .eq("id", memory.id)
        .eq("user_id", user.id)
        .select()
        .single();

    if (updateError) {
      console.error(
        "Failed to update learning memory:",
        updateError,
      );

      return NextResponse.json(
        { error: "Failed to update learning memory" },
        { status: 500 },
      );
    }

    // ----------------------------------------
    // 8. Return quiz result
    // ----------------------------------------
    return NextResponse.json({
      success: true,
      result: {
        isCorrect,
        topic,
        studentAnswer,
        correctAnswer,
      },
      performance: {
        questionsAsked,
        correctAnswers,
        incorrectAnswers,
        accuracy,
        masteryLevel,
      },
      memory: updatedMemory,
    });
  } catch (error) {
    console.error("Quiz answer API error:", error);

    return NextResponse.json(
      {
        error: "Failed to process quiz answer",
      },
      { status: 500 },
    );
  }
}