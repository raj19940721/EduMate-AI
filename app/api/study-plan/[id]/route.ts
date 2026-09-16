import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase-server";

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

// --------------------------------------------------
// PATCH /api/study-plan/[id]
// Update study plan activity status
// --------------------------------------------------
export async function PATCH(
  request: Request,
  context: RouteContext,
) {
  try {
    const supabase = await createSupabaseServerClient();

    // ----------------------------------------------
    // 1. Authenticate user
    // ----------------------------------------------
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

    // ----------------------------------------------
    // 2. Get plan ID
    // ----------------------------------------------
    const { id } = await context.params;

    if (!id) {
      return NextResponse.json(
        { error: "Study plan ID is required" },
        { status: 400 },
      );
    }

    // ----------------------------------------------
    // 3. Read request body
    // ----------------------------------------------
    const body = await request.json().catch(() => null);

    const status =
      typeof body?.status === "string"
        ? body.status.trim().toLowerCase()
        : "";

    const allowedStatuses = [
      "pending",
      "in_progress",
      "completed",
    ];

    if (!allowedStatuses.includes(status)) {
      return NextResponse.json(
        {
          error:
            "Invalid status. Allowed values: pending, in_progress, completed",
        },
        { status: 400 },
      );
    }

    // ----------------------------------------------
    // 4. Verify plan belongs to current user
    // ----------------------------------------------
    const { data: existingPlan, error: findError } =
      await supabase
        .from("student_study_plans")
        .select("*")
        .eq("id", id)
        .eq("user_id", user.id)
        .maybeSingle();

    if (findError) {
      console.error(
        "Failed to find study plan:",
        findError,
      );

      return NextResponse.json(
        { error: "Failed to find study plan" },
        { status: 500 },
      );
    }

    if (!existingPlan) {
      return NextResponse.json(
        { error: "Study plan item not found" },
        { status: 404 },
      );
    }

    // ----------------------------------------------
    // 5. Build update
    // ----------------------------------------------
    const updateData: {
      status: string;
      completed_at?: string | null;
      updated_at: string;
    } = {
      status,
      updated_at: new Date().toISOString(),
    };

    if (status === "completed") {
      updateData.completed_at =
        new Date().toISOString();
    } else {
      updateData.completed_at = null;
    }

    // ----------------------------------------------
    // 6. Update study plan
    // ----------------------------------------------
    const { data: updatedPlan, error: updateError } =
      await supabase
        .from("student_study_plans")
        .update(updateData)
        .eq("id", id)
        .eq("user_id", user.id)
        .select("*")
        .single();

    if (updateError) {
      console.error(
        "Failed to update study plan:",
        updateError,
      );

      return NextResponse.json(
        {
          error: "Failed to update study plan",
          details: updateError.message,
        },
        { status: 500 },
      );
    }

    // ----------------------------------------------
    // 7. Return updated item
    // ----------------------------------------------
    return NextResponse.json({
      success: true,

      message:
        status === "completed"
          ? "Study activity completed."
          : status === "in_progress"
            ? "Study activity started."
            : "Study activity reset.",

      studyPlan: {
        id: updatedPlan.id,

        topic: updatedPlan.topic,
        subject: updatedPlan.subject,
        grade: updatedPlan.grade,

        activityType:
          updatedPlan.activity_type,

        title: updatedPlan.title,
        description:
          updatedPlan.description,

        durationMinutes:
          updatedPlan.duration_minutes,

        priority: updatedPlan.priority,

        status: updatedPlan.status,

        scheduledDate:
          updatedPlan.scheduled_date,

        completedAt:
          updatedPlan.completed_at,
      },
    });
  } catch (error) {
    console.error(
      "Study plan update error:",
      error,
    );

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to update study plan",
      },
      { status: 500 },
    );
  }
}