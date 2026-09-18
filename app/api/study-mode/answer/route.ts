import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { supabase as adminSupabase } from "@/lib/supabase";
import { evaluateAnswer } from "@/lib/evaluate-answer";

const MAX_ANSWER_LENGTH = 1000;

interface StudyModeAnswerRequest {
  questionId?: unknown;
  studentAnswer?: unknown;
}

export async function POST(request: Request) {
  try {
    // --------------------------------
    // 1. Authentication
    // --------------------------------
    const supabase = await createSupabaseServerClient();

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // --------------------------------
    // 2. Read request body
    // --------------------------------
    let body: StudyModeAnswerRequest;

    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { error: "Invalid request body." },
        { status: 400 },
      );
    }

    // --------------------------------
    // 3. Validate question ID
    // --------------------------------
    if (typeof body.questionId !== "string" || !body.questionId.trim()) {
      return NextResponse.json(
        { error: "Question ID is required." },
        { status: 400 },
      );
    }

    const questionId = body.questionId.trim();

    // --------------------------------
    // 4. Validate student answer
    // --------------------------------
    if (typeof body.studentAnswer !== "string" || !body.studentAnswer.trim()) {
      return NextResponse.json(
        { error: "Please provide your answer." },
        { status: 400 },
      );
    }

    const studentAnswer = body.studentAnswer.trim().slice(0, MAX_ANSWER_LENGTH);

    if (!studentAnswer) {
      return NextResponse.json(
        { error: "Please provide a valid answer." },
        { status: 400 },
      );
    }

    // --------------------------------
    // 5. Load trusted Study Mode question
    // --------------------------------
    const { data: studyQuestion, error: questionError } = await adminSupabase
      .from("study_mode_questions")
      .select("id, topic, subject, grade, question, correct_answer")
      .eq("id", questionId)
      .eq("user_id", user.id)
      .maybeSingle();

    if (questionError) {
      console.error("Study Mode question lookup error:", questionError);

      return NextResponse.json(
        { error: "Failed to load the study question." },
        { status: 500 },
      );
    }

    if (!studyQuestion) {
      return NextResponse.json(
        { error: "Study question not found." },
        { status: 404 },
      );
    }

    // --------------------------------
    // 6. Evaluate using the server-side
    //    correct answer
    // --------------------------------
    const evaluation = await evaluateAnswer({
      question: studyQuestion.question,
      studentAnswer,
      correctAnswer: studyQuestion.correct_answer,
    });

    const isCorrect = evaluation.evaluation === "correct";

    // --------------------------------
    // 7. Load existing learning memory
    // --------------------------------
    const { data: memory, error: memoryError } = await adminSupabase
      .from("student_learning_memory")
      .select(
        "id, topic, subject, grade, mastery_level, notes, questions_asked, correct_answers, incorrect_answers, accuracy",
      )
      .eq("user_id", user.id)
      .eq("topic", studyQuestion.topic)
      .maybeSingle();

    if (memoryError) {
      console.error("Study Mode learning memory lookup error:", memoryError);

      return NextResponse.json(
        { error: "Failed to load learning memory." },
        { status: 500 },
      );
    }

    // --------------------------------
    // 8. Calculate updated performance
    // --------------------------------
    const questionsAsked = Number(memory?.questions_asked ?? 0) + 1;

    const correctAnswers =
      Number(memory?.correct_answers ?? 0) + (isCorrect ? 1 : 0);

    const incorrectAnswers =
      Number(memory?.incorrect_answers ?? 0) + (isCorrect ? 0 : 1);

    const accuracy =
      questionsAsked > 0
        ? Number(((correctAnswers / questionsAsked) * 100).toFixed(2))
        : 0;

    let masteryLevel: "learning" | "practicing" | "mastered";

    if (accuracy >= 90 && questionsAsked >= 5) {
      masteryLevel = "mastered";
    } else if (accuracy >= 50) {
      masteryLevel = "practicing";
    } else {
      masteryLevel = "learning";
    }

    // --------------------------------
    // 9. Create or update learning memory
    // --------------------------------
    if (memory) {
      const { error: updateError } = await adminSupabase
        .from("student_learning_memory")
        .update({
          subject: memory.subject ?? studyQuestion.subject ?? null,
          grade: memory.grade ?? studyQuestion.grade ?? null,
          questions_asked: questionsAsked,
          correct_answers: correctAnswers,
          incorrect_answers: incorrectAnswers,
          accuracy,
          mastery_level: masteryLevel,
          updated_at: new Date().toISOString(),
        })
        .eq("id", memory.id)
        .eq("user_id", user.id);

      if (updateError) {
        console.error("Study Mode learning memory update error:", updateError);

        return NextResponse.json(
          { error: "Failed to update learning memory." },
          { status: 500 },
        );
      }
    } else {
      const { error: insertError } = await adminSupabase
        .from("student_learning_memory")
        .insert({
          user_id: user.id,
          topic: studyQuestion.topic,
          subject: studyQuestion.subject ?? null,
          grade: studyQuestion.grade ?? null,
          mastery_level: masteryLevel,
          questions_asked: questionsAsked,
          correct_answers: correctAnswers,
          incorrect_answers: incorrectAnswers,
          accuracy,
          notes: null,
        });

      if (insertError) {
        console.error("Study Mode learning memory insert error:", insertError);

        return NextResponse.json(
          { error: "Failed to create learning memory." },
          { status: 500 },
        );
      }
    }

    // --------------------------------
    // 10. Return evaluation
    // --------------------------------
    return NextResponse.json({
      success: true,
      result: {
        evaluation: evaluation.evaluation,
        score: evaluation.score,
        feedback: evaluation.feedback,
        isCorrect,
      },
      performance: {
        topic: studyQuestion.topic,
        accuracy,
        masteryLevel,
        questionsAsked,
        correctAnswers,
        incorrectAnswers,
      },
    });
  } catch (error) {
    console.error("Study Mode answer API error:", error);

    return NextResponse.json(
      {
        error: "Failed to check your answer. Please try again.",
      },
      { status: 500 },
    );
  }
}
