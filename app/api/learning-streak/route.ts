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
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 },
      );
    }

    // --------------------------------------------------
    // 2. Load learning activity
    // --------------------------------------------------

    const {
      data: activities,
      error: activityError,
    } = await adminSupabase
      .from("learning_activity")
      .select(
        "activity_date, questions_answered, topics_studied",
      )
      .eq("user_id", user.id)
      .order("activity_date", {
        ascending: false,
      });

    if (activityError) {
      console.error(
        "Learning activity fetch error:",
        activityError,
      );

      return NextResponse.json(
        {
          error: "Failed to load learning activity",
          details: activityError.message,
        },
        { status: 500 },
      );
    }

    // --------------------------------------------------
    // 3. Handle no activity
    // --------------------------------------------------

    if (!activities || activities.length === 0) {
      return NextResponse.json({
        success: true,
        streak: {
          currentStreak: 0,
          bestStreak: 0,
          activeDays: 0,
        },
        totals: {
          questionsAnswered: 0,
          topicsStudied: 0,
        },
        weeklyActivity: [],
      });
    }

    // --------------------------------------------------
    // 4. Create a quick lookup of active dates
    // --------------------------------------------------

    const activityDates = new Set(
      activities.map((activity) => activity.activity_date),
    );

    // --------------------------------------------------
    // 5. Calculate current streak
    // --------------------------------------------------

    const today = new Date();

    const todayString = today
      .toISOString()
      .split("T")[0];

    const yesterday = new Date(today);
    yesterday.setUTCDate(
      yesterday.getUTCDate() - 1,
    );

    const yesterdayString = yesterday
      .toISOString()
      .split("T")[0];

    let currentStreak = 0;

    // A streak can start today or yesterday.
    if (
      activityDates.has(todayString) ||
      activityDates.has(yesterdayString)
    ) {
      const streakDate = new Date(
        activityDates.has(todayString)
          ? todayString
          : yesterdayString,
      );

      while (true) {
        const dateString = streakDate
          .toISOString()
          .split("T")[0];

        if (!activityDates.has(dateString)) {
          break;
        }

        currentStreak++;

        streakDate.setUTCDate(
          streakDate.getUTCDate() - 1,
        );
      }
    }

    // --------------------------------------------------
    // 6. Calculate best streak
    // --------------------------------------------------

    const sortedDates = activities
      .map((activity) => activity.activity_date)
      .sort();

    let bestStreak = 0;
    let runningStreak = 0;
    let previousDate: Date | null = null;

    for (const dateString of sortedDates) {
      const currentDate = new Date(dateString);

      if (!previousDate) {
        runningStreak = 1;
      } else {
        const difference =
          Math.round(
            (currentDate.getTime() -
              previousDate.getTime()) /
              (1000 * 60 * 60 * 24),
          );

        if (difference === 1) {
          runningStreak++;
        } else {
          runningStreak = 1;
        }
      }

      bestStreak = Math.max(
        bestStreak,
        runningStreak,
      );

      previousDate = currentDate;
    }

    // --------------------------------------------------
    // 7. Calculate totals
    // --------------------------------------------------

    const questionsAnswered = activities.reduce(
      (total, activity) =>
        total + (activity.questions_answered ?? 0),
      0,
    );

    const topicsStudied = activities.reduce(
      (total, activity) =>
        total + (activity.topics_studied ?? 0),
      0,
    );

    // --------------------------------------------------
    // 8. Last 7 days activity
    // --------------------------------------------------

    const weeklyActivity = [];

    for (let i = 6; i >= 0; i--) {
      const date = new Date(today);

      date.setUTCDate(
        date.getUTCDate() - i,
      );

      const dateString = date
        .toISOString()
        .split("T")[0];

      const activity = activities.find(
        (item) =>
          item.activity_date === dateString,
      );

      weeklyActivity.push({
        date: dateString,
        active: Boolean(activity),
        questionsAnswered:
          activity?.questions_answered ?? 0,
        topicsStudied:
          activity?.topics_studied ?? 0,
      });
    }

    // --------------------------------------------------
    // 9. Return result
    // --------------------------------------------------

    return NextResponse.json({
      success: true,

      streak: {
        currentStreak,
        bestStreak,
        activeDays: activities.length,
      },

      totals: {
        questionsAnswered,
        topicsStudied,
      },

      weeklyActivity,
    });
  } catch (error) {
    console.error(
      "Learning streak API error:",
      error,
    );

    return NextResponse.json(
      {
        error: "Failed to calculate learning streak",
        details:
          error instanceof Error
            ? error.message
            : "Unknown error",
      },
      { status: 500 },
    );
  }
}