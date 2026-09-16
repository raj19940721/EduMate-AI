import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { saveLearningMemory } from "@/lib/learning-memory";

export async function POST(request: Request) {
  try {
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

    const body = await request.json().catch(() => null);

    const question =
      typeof body?.question === "string"
        ? body.question.trim()
        : "";

    const topic =
      typeof body?.topic === "string"
        ? body.topic.trim()
        : "";

    const subject =
      typeof body?.subject === "string"
        ? body.subject.trim()
        : null;

    const notes =
      typeof body?.notes === "string"
        ? body.notes.trim()
        : null;

    if (!question) {
      return NextResponse.json(
        {
          error: "Homework question is required",
        },
        { status: 400 },
      );
    }

    // ----------------------------------------
    // Get authenticated student's profile
    // ----------------------------------------

    const {
      data: student,
      error: studentError,
    } = await supabase
      .from("students")
      .select("grade, subject")
      .eq("user_id", user.id)
      .maybeSingle();

    if (studentError) {
      console.error(
        "Failed to load student profile:",
        studentError,
      );

      return NextResponse.json(
        {
          error: "Failed to load student profile",
        },
        { status: 500 },
      );
    }

    if (!student) {
      return NextResponse.json(
        {
          error: "Student profile was not found",
        },
        { status: 404 },
      );
    }

    // ----------------------------------------
    // Save homework topic to learning memory
    // ----------------------------------------

    const memory = await saveLearningMemory({
      userId: user.id,

      topic:
        topic || question,

      subject:
        subject ||
        student.subject ||
        null,

      grade:
        typeof student.grade === "number"
          ? student.grade
          : null,

      masteryLevel: "learning",

      notes:
        notes ||
        `Student received voice homework help. Question: ${question}`,
    });

    console.log(
      "🧠 Voice homework learning memory saved:",
      memory,
    );

    return NextResponse.json({
      success: true,
      memory,
    });
  } catch (error) {
    console.error(
      "Voice homework memory error:",
      error,
    );

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to save homework learning memory",
      },
      { status: 500 },
    );
  }
}