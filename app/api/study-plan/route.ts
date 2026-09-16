import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase-server";

type StudyPlanItem = {
  id?: string;
  topic: string;
  subject: string | null;
  grade: number | null;
  activityType: string;
  title: string;
  description: string;
  durationMinutes: number;
  priority: "high" | "medium" | "low";
  status: string;
  accuracy: number;
  masteryLevel: string;
  scheduledDate: string;
};

function getTodayDate() {
  return new Date().toISOString().split("T")[0];
}

function buildStudyPlan(
  memories: any[],
  today: string,
): StudyPlanItem[] {
  const studyPlan = memories.map((memory) => {
    const accuracy = Number(memory.accuracy ?? 0);

    let activityType = "review";
    let priority: "high" | "medium" | "low" = "medium";
    let title = `Review ${memory.topic}`;
    let description = `Review the basics of ${memory.topic}.`;
    let durationMinutes = 10;

    if (accuracy < 50) {
      activityType = "practice";
      priority = "high";
      title = `Practice ${memory.topic}`;
      description =
        `Practice ${memory.topic} with simple questions and examples.`;
      durationMinutes = 15;
    } else if (accuracy < 80) {
      activityType = "quiz";
      priority = "medium";
      title = `Practice Quiz: ${memory.topic}`;
      description =
        `Take a short quiz to strengthen your understanding of ${memory.topic}.`;
      durationMinutes = 10;
    } else if (memory.mastery_level === "mastered") {
      activityType = "review";
      priority = "low";
      title = `Quick Review: ${memory.topic}`;
      description =
        `Do a quick review to keep your knowledge of ${memory.topic} fresh.`;
      durationMinutes = 5;
    }

    return {
      topic: memory.topic,
      subject: memory.subject,
      grade: memory.grade,
      activityType,
      title,
      description,
      durationMinutes,
      priority,
      status: "pending",
      accuracy,
      masteryLevel: memory.mastery_level ?? "learning",
      scheduledDate: today,
    };
  });

  const priorityOrder = {
    high: 1,
    medium: 2,
    low: 3,
  };

  studyPlan.sort(
    (a, b) =>
      priorityOrder[a.priority] -
      priorityOrder[b.priority],
  );

  return studyPlan;
}

function buildSummary(studyPlan: StudyPlanItem[]) {
  return {
    totalTopics: studyPlan.length,
    highPriority: studyPlan.filter(
      (item) => item.priority === "high",
    ).length,
    mediumPriority: studyPlan.filter(
      (item) => item.priority === "medium",
    ).length,
    lowPriority: studyPlan.filter(
      (item) => item.priority === "low",
    ).length,
    totalDurationMinutes: studyPlan.reduce(
      (total, item) => total + item.durationMinutes,
      0,
    ),
  };
}

function mapSavedPlan(items: any[]) {
  return items.map((item) => ({
    id: item.id,
    topic: item.topic,
    subject: item.subject,
    grade: item.grade,
    activityType: item.activity_type,
    title: item.title,
    description: item.description,
    durationMinutes: item.duration_minutes,
    priority: item.priority,
    status: item.status,
    accuracy: 0,
    masteryLevel: "learning",
    scheduledDate: item.scheduled_date,
    completedAt: item.completed_at ?? null,
  }));
}

// --------------------------------------------------
// GET /api/study-plan
// Get today's saved study plan
// --------------------------------------------------
export async function GET() {
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

    const today = getTodayDate();

    const { data: student, error: studentError } =
      await supabase
        .from("students")
        .select("name, grade, subject")
        .eq("user_id", user.id)
        .maybeSingle();

    if (studentError) {
      console.error(
        "Failed to load student profile:",
        studentError,
      );

      return NextResponse.json(
        { error: "Failed to load student profile" },
        { status: 500 },
      );
    }

    if (!student) {
      return NextResponse.json(
        { error: "Student profile not found" },
        { status: 404 },
      );
    }

    const { data: savedPlan, error: planError } =
      await supabase
        .from("student_study_plans")
        .select("*")
        .eq("user_id", user.id)
        .eq("scheduled_date", today)
        .order("created_at", {
          ascending: true,
        });

    if (planError) {
      console.error(
        "Failed to load today's study plan:",
        planError,
      );

      return NextResponse.json(
        { error: "Failed to load study plan" },
        { status: 500 },
      );
    }

    if (savedPlan && savedPlan.length > 0) {
      const studyPlan = mapSavedPlan(savedPlan);

      return NextResponse.json({
        success: true,
        source: "saved",
        student: {
          name: student.name,
          grade: student.grade,
          subject: student.subject,
        },
        studyPlan,
        summary: buildSummary(studyPlan),
      });
    }

    return NextResponse.json({
      success: true,
      source: "not_generated",
      student: {
        name: student.name,
        grade: student.grade,
        subject: student.subject,
      },
      studyPlan: [],
      summary: {
        totalTopics: 0,
        highPriority: 0,
        mediumPriority: 0,
        lowPriority: 0,
        totalDurationMinutes: 0,
      },
      message:
        "Today's study plan has not been generated yet.",
    });
  } catch (error) {
    console.error("Study plan GET error:", error);

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to load study plan",
      },
      { status: 500 },
    );
  }
}

// --------------------------------------------------
// POST /api/study-plan
//
// Default:
//   Generate today's plan only when one doesn't exist.
//
// Regenerate:
//   POST { "regenerate": true }
//   Deletes today's saved plan and creates a fresh plan
//   from the latest Learning Memory.
// --------------------------------------------------
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

    const body = await request.json().catch(() => ({}));
    const regenerate = body?.regenerate === true;

    const today = getTodayDate();

    const { data: student, error: studentError } =
      await supabase
        .from("students")
        .select("name, grade, subject")
        .eq("user_id", user.id)
        .maybeSingle();

    if (studentError) {
      console.error(
        "Failed to load student profile:",
        studentError,
      );

      return NextResponse.json(
        { error: "Failed to load student profile" },
        { status: 500 },
      );
    }

    if (!student) {
      return NextResponse.json(
        { error: "Student profile not found" },
        { status: 404 },
      );
    }

    const { data: existingPlan, error: existingError } =
      await supabase
        .from("student_study_plans")
        .select("*")
        .eq("user_id", user.id)
        .eq("scheduled_date", today)
        .order("created_at", {
          ascending: true,
        });

    if (existingError) {
      console.error(
        "Failed to check existing study plan:",
        existingError,
      );

      return NextResponse.json(
        { error: "Failed to check existing study plan" },
        { status: 500 },
      );
    }

    // Preserve the original no-duplicate behavior.
    if (
      !regenerate &&
      existingPlan &&
      existingPlan.length > 0
    ) {
      const studyPlan = mapSavedPlan(existingPlan);

      return NextResponse.json({
        success: true,
        source: "existing",
        message: "Today's study plan already exists.",
        student: {
          name: student.name,
          grade: student.grade,
          subject: student.subject,
        },
        studyPlan,
        summary: buildSummary(studyPlan),
      });
    }

    // --------------------------------------------------
    // Regenerate today's plan from the latest memory.
    // This is explicit because it replaces today's saved plan.
    // --------------------------------------------------
    if (regenerate && existingPlan && existingPlan.length > 0) {
      const { error: deleteError } = await supabase
        .from("student_study_plans")
        .delete()
        .eq("user_id", user.id)
        .eq("scheduled_date", today);

      if (deleteError) {
        console.error(
          "Failed to regenerate today's study plan:",
          deleteError,
        );

        return NextResponse.json(
          {
            error: "Failed to regenerate study plan",
            details: deleteError.message,
          },
          { status: 500 },
        );
      }
    }

    // --------------------------------------------------
    // Load latest learning memory
    // --------------------------------------------------
    const {
      data: memories,
      error: memoryError,
    } = await supabase
      .from("student_learning_memory")
      .select(
        `
        id,
        topic,
        subject,
        grade,
        mastery_level,
        notes,
        questions_asked,
        correct_answers,
        incorrect_answers,
        accuracy,
        created_at,
        updated_at
      `,
      )
      .eq("user_id", user.id)
      .order("updated_at", {
        ascending: false,
      });

    if (memoryError) {
      console.error(
        "Failed to load learning memory:",
        memoryError,
      );

      return NextResponse.json(
        { error: "Failed to load learning memory" },
        { status: 500 },
      );
    }

    const generatedPlan = buildStudyPlan(
      memories ?? [],
      today,
    );

    if (generatedPlan.length === 0) {
      return NextResponse.json({
        success: true,
        source: "generated",
        message:
          "No learning topics are available yet to create a study plan.",
        student: {
          name: student.name,
          grade: student.grade,
          subject: student.subject,
        },
        studyPlan: [],
        summary: {
          totalTopics: 0,
          highPriority: 0,
          mediumPriority: 0,
          lowPriority: 0,
          totalDurationMinutes: 0,
        },
      });
    }

    // --------------------------------------------------
    // Save new plan
    // --------------------------------------------------
    const rowsToInsert = generatedPlan.map((item) => ({
      user_id: user.id,
      topic: item.topic,
      subject: item.subject,
      grade: item.grade,
      activity_type: item.activityType,
      title: item.title,
      description: item.description,
      duration_minutes: item.durationMinutes,
      priority: item.priority,
      status: "pending",
      scheduled_date: today,
    }));

    const {
      data: insertedPlan,
      error: insertError,
    } = await supabase
      .from("student_study_plans")
      .insert(rowsToInsert)
      .select("*");

    if (insertError) {
      console.error(
        "Failed to save study plan:",
        insertError,
      );

      return NextResponse.json(
        {
          error: "Failed to save study plan",
          details: insertError.message,
        },
        { status: 500 },
      );
    }

    const studyPlan = (insertedPlan ?? []).map(
      (item) => {
        const sourceMemory = memories?.find(
          (memory) => memory.topic === item.topic,
        );

        return {
          id: item.id,
          topic: item.topic,
          subject: item.subject,
          grade: item.grade,
          activityType: item.activity_type,
          title: item.title,
          description: item.description,
          durationMinutes: item.duration_minutes,
          priority: item.priority,
          status: item.status,
          accuracy: Number(
            sourceMemory?.accuracy ?? 0,
          ),
          masteryLevel:
            sourceMemory?.mastery_level ?? "learning",
          scheduledDate: item.scheduled_date,
          completedAt: item.completed_at ?? null,
        };
      },
    );

    return NextResponse.json({
      success: true,
      source: "generated",
      regenerated: regenerate,
      message: regenerate
        ? "Today's study plan has been regenerated from the latest learning memory."
        : "Today's study plan has been generated and saved.",
      student: {
        name: student.name,
        grade: student.grade,
        subject: student.subject,
      },
      studyPlan,
      summary: buildSummary(studyPlan),
    });
  } catch (error) {
    console.error("Study plan POST error:", error);

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to generate study plan",
      },
      { status: 500 },
    );
  }
}
