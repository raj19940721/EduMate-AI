import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { supabase } from "@/lib/supabase";

type StudyPlanItem = {
  id: string;
  topic: string;
  subject: string | null;
  grade: number | null;
  activityType: string;
  title: string;
  description: string;
  durationMinutes: number;
  priority: "high" | "medium" | "low";
  status: "pending" | "in_progress" | "completed" | string;
  accuracy: number;
  masteryLevel: string;
  scheduledDate: string;
  completedAt?: string | null;
};

type StudyPlanResponse = {
  success: boolean;
  source?: "saved" | "generated" | "existing" | "not_generated";
  message?: string;

  student?: {
    name: string;
    grade: number;
    subject: string;
  };

  studyPlan: StudyPlanItem[];

  summary: {
    totalTopics: number;
    highPriority: number;
    mediumPriority: number;
    lowPriority: number;
    totalDurationMinutes: number;
  };

  error?: string;
};

// --------------------------------------------------
// India local date
// --------------------------------------------------

function getIndiaDate() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());

  const year = parts.find((part) => part.type === "year")?.value;

  const month = parts.find((part) => part.type === "month")?.value;

  const day = parts.find((part) => part.type === "day")?.value;

  if (!year || !month || !day) {
    throw new Error("Unable to determine India date");
  }

  return `${year}-${month}-${day}`;
}

// --------------------------------------------------
// Priority
// --------------------------------------------------

function getPriority(
  accuracy: number,
  masteryLevel: string,
): "high" | "medium" | "low" {
  if (accuracy < 50) {
    return "high";
  }

  if (accuracy < 80) {
    return "medium";
  }

  if (masteryLevel === "mastered") {
    return "low";
  }

  return "medium";
}

// --------------------------------------------------
// Convert database activity → UI activity
// --------------------------------------------------

function mapActivity(
  activity: any,
  memoryMap: Map<string, any>,
): StudyPlanItem {
  const memory = memoryMap.get(`${activity.topic}::${activity.subject ?? ""}`);

  const accuracy = Number(memory?.accuracy ?? 0);

  const masteryLevel = memory?.mastery_level ?? "learning";

  return {
    id: activity.id,

    topic: activity.topic,

    subject: activity.subject,

    grade: activity.grade,

    activityType: activity.activity_type,

    title: activity.title,

    description: activity.description,

    durationMinutes: Number(activity.estimated_minutes ?? 0),

    priority: getPriority(accuracy, masteryLevel),

    status: activity.status ?? "pending",

    accuracy,

    masteryLevel,

    scheduledDate: activity.activity_date,

    completedAt: activity.completed_at ?? null,
  };
}

// --------------------------------------------------
// Summary
// --------------------------------------------------

function buildSummary(studyPlan: StudyPlanItem[]) {
  return {
    totalTopics: studyPlan.length,

    highPriority: studyPlan.filter((item) => item.priority === "high").length,

    mediumPriority: studyPlan.filter((item) => item.priority === "medium")
      .length,

    lowPriority: studyPlan.filter((item) => item.priority === "low").length,

    totalDurationMinutes: studyPlan.reduce(
      (total, item) => total + item.durationMinutes,
      0,
    ),
  };
}

// ==================================================
// GET /api/study-plan
// ==================================================

export async function GET() {
  try {
    // ----------------------------------------------
    // Authenticate
    // ----------------------------------------------

    const supabaseServer = await createSupabaseServerClient();

    const {
      data: { user },
      error: authError,
    } = await supabaseServer.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        {
          success: false,
          error: "Unauthorized",
        },
        {
          status: 401,
        },
      );
    }

    // ----------------------------------------------
    // India date
    // ----------------------------------------------

    const today = getIndiaDate();

    // ----------------------------------------------
    // Student
    // ----------------------------------------------

    const { data: student, error: studentError } = await supabase
      .from("students")
      .select("name, grade, subject")
      .eq("user_id", user.id)
      .maybeSingle();

    if (studentError) {
      console.error("Study plan student error:", studentError);

      return NextResponse.json(
        {
          success: false,
          error: "Failed to load student profile.",
        },
        {
          status: 500,
        },
      );
    }

    if (!student) {
      return NextResponse.json(
        {
          success: false,
          error: "Student profile not found.",
        },
        {
          status: 404,
        },
      );
    }

    // ----------------------------------------------
    // Find active plan
    // ----------------------------------------------

    const { data: savedPlans, error: planError } = await supabase
      .from("study_plans")
      .select(
        `
        id,
        title,
        grade,
        start_date,
        end_date,
        status,
        created_at
        `,
      )
      .eq("user_id", user.id)
      .eq("status", "active")
      .order("created_at", {
        ascending: false,
      })
      .limit(1);

    if (planError) {
      console.error("Study plan load error:", planError);

      return NextResponse.json(
        {
          success: false,
          error: "Failed to load study plan.",
        },
        {
          status: 500,
        },
      );
    }

    const savedPlan = savedPlans?.[0];

    // ----------------------------------------------
    // No active plan
    // ----------------------------------------------

    if (!savedPlan) {
      return NextResponse.json({
        success: true,

        source: "not_generated",

        student: {
          name: student.name,

          grade: Number(student.grade),

          subject: student.subject ?? "General",
        },

        studyPlan: [],

        summary: {
          totalTopics: 0,
          highPriority: 0,
          mediumPriority: 0,
          lowPriority: 0,
          totalDurationMinutes: 0,
        },

        message: "No active study plan is available yet.",
      });
    }

    // ----------------------------------------------
    // Load activities
    // ----------------------------------------------

    const { data: activities, error: activitiesError } = await supabase
      .from("study_plan_activities")
      .select(
        `
        id,
        plan_id,
        activity_date,
        activity_type,
        title,
        description,
        topic,
        subject,
        estimated_minutes,
        status,
        completed_at
        `,
      )
      .eq("plan_id", savedPlan.id)
      .eq("user_id", user.id)
      .order("activity_date", {
        ascending: true,
      })
      .order("created_at", {
        ascending: true,
      });

    if (activitiesError) {
      console.error("Study plan activities error:", activitiesError);

      return NextResponse.json(
        {
          success: false,
          error: "Failed to load study activities.",
        },
        {
          status: 500,
        },
      );
    }

    // ----------------------------------------------
    // Load learning memory
    // ----------------------------------------------

    const { data: memories, error: memoryError } = await supabase
      .from("student_learning_memory")
      .select(
        `
        topic,
        subject,
        accuracy,
        mastery_level
        `,
      )
      .eq("user_id", user.id);

    if (memoryError) {
      console.error("Study plan memory error:", memoryError);

      return NextResponse.json(
        {
          success: false,
          error: "Failed to load learning progress.",
        },
        {
          status: 500,
        },
      );
    }

    // ----------------------------------------------
    // Memory lookup
    // ----------------------------------------------

    const memoryMap = new Map<string, any>();

    for (const memory of memories ?? []) {
      memoryMap.set(`${memory.topic}::${memory.subject ?? ""}`, memory);
    }

    // ----------------------------------------------
    // Convert activities
    // ----------------------------------------------

    const studyPlan = (activities ?? []).map((activity) =>
      mapActivity(activity, memoryMap),
    );

    // ----------------------------------------------
    // Return
    // ----------------------------------------------

    return NextResponse.json({
      success: true,

      source: "saved",

      student: {
        name: student.name,

        grade: Number(student.grade),

        subject: student.subject ?? "General",
      },

      plan: {
        id: savedPlan.id,

        title: savedPlan.title,

        grade: savedPlan.grade,

        startDate: savedPlan.start_date,

        endDate: savedPlan.end_date,

        status: savedPlan.status,
      },

      studyPlan,

      summary: buildSummary(studyPlan),
    });
  } catch (error) {
    console.error("Study plan GET error:", error);

    return NextResponse.json(
      {
        success: false,
        error: "Failed to load study plan.",
      },
      {
        status: 500,
      },
    );
  }
}
