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
    // 2. Load user's achievements
    // --------------------------------------------------

    const { data: achievements, error: achievementError } = await adminSupabase
      .from("learning_achievements")
      .select("id, achievement_key, achievement_name, description, earned_at")
      .eq("user_id", user.id)
      .order("earned_at", {
        ascending: false,
      });

    if (achievementError) {
      console.error("Achievement fetch error:", achievementError);

      return NextResponse.json(
        {
          error: "Failed to load achievements",
          details: achievementError.message,
        },
        { status: 500 },
      );
    }

    // --------------------------------------------------
    // 3. Return achievements
    // --------------------------------------------------

    return NextResponse.json({
      success: true,
      achievements: achievements ?? [],
    });
  } catch (error) {
    console.error("Learning achievements API error:", error);

    return NextResponse.json(
      {
        error: "Failed to load achievements",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}
