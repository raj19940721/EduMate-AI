import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { supabase } from "@/lib/supabase";

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

export async function PATCH(request: Request, context: RouteContext) {
  try {
    // ----------------------------------------------
    // Authenticate user
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
    // Get activity ID
    // ----------------------------------------------

    const { id } = await context.params;

    if (!id) {
      return NextResponse.json(
        {
          success: false,
          error: "Study plan activity ID is required.",
        },
        {
          status: 400,
        },
      );
    }

    // ----------------------------------------------
    // Validate request body
    // ----------------------------------------------

    let body: {
      status?: string;
    };

    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        {
          success: false,
          error: "Invalid request body.",
        },
        {
          status: 400,
        },
      );
    }

    const status = body.status?.trim();

    if (status !== "in_progress" && status !== "completed") {
      return NextResponse.json(
        {
          success: false,
          error: "Invalid study activity status.",
        },
        {
          status: 400,
        },
      );
    }

    // ----------------------------------------------
    // Prepare update
    // ----------------------------------------------

    const updateData: {
      status: string;
      completed_at?: string | null;
    } = {
      status,
    };

    if (status === "completed") {
      updateData.completed_at = new Date().toISOString();
    } else {
      updateData.completed_at = null;
    }

    // ----------------------------------------------
    // Update activity
    //
    // IMPORTANT:
    // Use the NEW table:
    // study_plan_activities
    // ----------------------------------------------

    const { data: updatedActivity, error: updateError } = await supabase
      .from("study_plan_activities")
      .update(updateData)
      .eq("id", id)
      .eq("user_id", user.id)
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
      .maybeSingle();

    if (updateError) {
      console.error("Study plan activity update error:", updateError);

      return NextResponse.json(
        {
          success: false,
          error: "Failed to update study activity.",
        },
        {
          status: 500,
        },
      );
    }

    // ----------------------------------------------
    // Activity not found
    // ----------------------------------------------

    if (!updatedActivity) {
      return NextResponse.json(
        {
          success: false,
          error: "Study plan item not found.",
        },
        {
          status: 404,
        },
      );
    }

    // ----------------------------------------------
    // Return updated activity
    // ----------------------------------------------

    return NextResponse.json({
      success: true,

      message:
        status === "completed"
          ? "Study activity completed."
          : "Study activity started.",

      studyPlan: {
        id: updatedActivity.id,

        planId: updatedActivity.plan_id,

        topic: updatedActivity.topic,

        subject: updatedActivity.subject,

        activityType: updatedActivity.activity_type,

        title: updatedActivity.title,

        description: updatedActivity.description,

        durationMinutes: Number(updatedActivity.estimated_minutes ?? 0),

        status: updatedActivity.status,

        scheduledDate: updatedActivity.activity_date,

        completedAt: updatedActivity.completed_at,
      },
    });
  } catch (error) {
    console.error("Study plan PATCH error:", error);

    return NextResponse.json(
      {
        success: false,
        error: "Failed to update study activity.",
      },
      {
        status: 500,
      },
    );
  }
}
