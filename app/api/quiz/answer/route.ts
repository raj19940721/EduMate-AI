import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { supabase as adminSupabase } from "@/lib/supabase";
import { evaluateAnswer } from "@/lib/evaluate-answer";
import { checkAndAwardAchievements } from "@/lib/learning-achievements";
import { calculateReviewSchedule } from "@/lib/spaced-repetition";

export async function POST(request: Request) {
  try {
    const supabase = await createSupabaseServerClient();

    // --------------------------------------------------
    // 1. Authenticate user
    // --------------------------------------------------

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
    // 2. Read request
    // --------------------------------------------------

    const body = await request.json();

    const {
      topic,
      question,
      studentAnswer,
      correctAnswer,
    } = body;

    if (!topic || !question || !studentAnswer || !correctAnswer) {
      return NextResponse.json(
        {
          error:
            "topic, question, studentAnswer and correctAnswer are required",
        },
        { status: 400 },
      );
    }

    // --------------------------------------------------
    // 3. Evaluate student's answer using AI
    // --------------------------------------------------

    const evaluation = await evaluateAnswer({
      question,
      studentAnswer,
      correctAnswer,
    });

    const isCorrect =
      evaluation.evaluation === "correct";

    // --------------------------------------------------
    // 4. Load learning memory
    // --------------------------------------------------

    const {
      data: memory,
      error: memoryError,
    } = await adminSupabase
      .from("student_learning_memory")
      .select(
        "id, questions_asked, correct_answers, incorrect_answers, accuracy, mastery_level",
      )
      .eq("user_id", user.id)
      .eq("topic", topic)
      .maybeSingle();

    if (memoryError) {
      console.error(
        "Learning memory fetch error:",
        memoryError,
      );

      return NextResponse.json(
        {
          error: "Failed to load learning memory",
          details: memoryError.message,
        },
        { status: 500 },
      );
    }

    if (!memory) {
      return NextResponse.json(
        {
          error:
            "Learning memory not found for this topic",
        },
        { status: 404 },
      );
    }

    // --------------------------------------------------
    // 5. Update topic performance
    // --------------------------------------------------

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
            (
              (correctAnswers / questionsAsked) *
              100
            ).toFixed(2),
          )
        : 0;

    let masteryLevel:
      | "learning"
      | "practicing"
      | "mastered";

    if (
      accuracy >= 90 &&
      questionsAsked >= 5
    ) {
      masteryLevel = "mastered";
    } else if (accuracy >= 50) {
      masteryLevel = "practicing";
    } else {
      masteryLevel = "learning";
    }

    // --------------------------------------------------
    // 6. Calculate Smart Review schedule
    // --------------------------------------------------

    const reviewSchedule = calculateReviewSchedule({
      accuracy,
      masteryLevel,
    });

    console.log("Smart Review Schedule:", {
      topic,
      accuracy,
      masteryLevel,
      nextReviewDate:
        reviewSchedule.nextReviewDate,
      reviewIntervalDays:
        reviewSchedule.reviewIntervalDays,
    });

    // --------------------------------------------------
    // 7. Update learning memory
    // --------------------------------------------------

    const {
      data: updatedMemory,
      error: updateError,
    } = await adminSupabase
      .from("student_learning_memory")
      .update({
        questions_asked: questionsAsked,
        correct_answers: correctAnswers,
        incorrect_answers: incorrectAnswers,
        accuracy,
        mastery_level: masteryLevel,

        // Smart Review fields
        next_review_date:
          reviewSchedule.nextReviewDate,
        review_interval_days:
          reviewSchedule.reviewIntervalDays,

        updated_at: new Date().toISOString(),
      })
      .eq("id", memory.id)
      .eq("user_id", user.id)
      .select()
      .single();

    if (updateError) {
      console.error(
        "Learning memory update error:",
        updateError,
      );

      return NextResponse.json(
        {
          error:
            "Failed to update learning memory",
          details: updateError.message,
        },
        { status: 500 },
      );
    }

    // --------------------------------------------------
    // 8. Record today's learning activity
    // --------------------------------------------------

    const today = new Date()
      .toISOString()
      .split("T")[0];

    const {
      data: existingActivity,
      error: activityFetchError,
    } = await adminSupabase
      .from("learning_activity")
      .select(
        "id, questions_answered, topics_studied",
      )
      .eq("user_id", user.id)
      .eq("activity_date", today)
      .maybeSingle();

    if (activityFetchError) {
      console.error(
        "Learning activity fetch error:",
        activityFetchError,
      );

      return NextResponse.json(
        {
          error:
            "Failed to load learning activity",
          details: activityFetchError.message,
        },
        { status: 500 },
      );
    }

    if (existingActivity) {
      const newQuestionCount =
        (existingActivity.questions_answered ?? 0) +
        1;

      const {
        error: activityUpdateError,
      } = await adminSupabase
        .from("learning_activity")
        .update({
          questions_answered: newQuestionCount,
          updated_at: new Date().toISOString(),
        })
        .eq("id", existingActivity.id)
        .eq("user_id", user.id);

      if (activityUpdateError) {
        console.error(
          "Learning activity update error:",
          activityUpdateError,
        );

        return NextResponse.json(
          {
            error:
              "Failed to update learning activity",
            details:
              activityUpdateError.message,
          },
          { status: 500 },
        );
      }
    } else {
      const {
        error: activityInsertError,
      } = await adminSupabase
        .from("learning_activity")
        .insert({
          user_id: user.id,
          activity_date: today,
          questions_answered: 1,
          topics_studied: 1,
          updated_at: new Date().toISOString(),
        });

      if (activityInsertError) {
        console.error(
          "Learning activity insert error:",
          activityInsertError,
        );

        return NextResponse.json(
          {
            error:
              "Failed to record learning activity",
            details:
              activityInsertError.message,
          },
          { status: 500 },
        );
      }
    }

    // --------------------------------------------------
    // 9. Update today's daily learning goal
    // --------------------------------------------------

    const {
      data: existingGoal,
      error: goalFetchError,
    } = await adminSupabase
      .from("daily_learning_goals")
      .select(
        "id, target_questions, completed_questions",
      )
      .eq("user_id", user.id)
      .eq("goal_date", today)
      .maybeSingle();

    if (goalFetchError) {
      console.error(
        "Daily learning goal fetch error:",
        goalFetchError,
      );

      return NextResponse.json(
        {
          error:
            "Failed to load daily learning goal",
          details: goalFetchError.message,
        },
        { status: 500 },
      );
    }

    let dailyGoal;

    if (existingGoal) {
      const completedQuestions =
        (existingGoal.completed_questions ?? 0) +
        1;

      const {
        data: updatedGoal,
        error: goalUpdateError,
      } = await adminSupabase
        .from("daily_learning_goals")
        .update({
          completed_questions:
            completedQuestions,
          updated_at: new Date().toISOString(),
        })
        .eq("id", existingGoal.id)
        .eq("user_id", user.id)
        .select()
        .single();

      if (goalUpdateError) {
        console.error(
          "Daily learning goal update error:",
          goalUpdateError,
        );

        return NextResponse.json(
          {
            error:
              "Failed to update daily learning goal",
            details:
              goalUpdateError.message,
          },
          { status: 500 },
        );
      }

      dailyGoal = updatedGoal;
    } else {
      const {
        data: newGoal,
        error: goalInsertError,
      } = await adminSupabase
        .from("daily_learning_goals")
        .insert({
          user_id: user.id,
          goal_date: today,
          target_questions: 5,
          completed_questions: 1,
          updated_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (goalInsertError) {
        console.error(
          "Daily learning goal insert error:",
          goalInsertError,
        );

        return NextResponse.json(
          {
            error:
              "Failed to create daily learning goal",
            details: goalInsertError.message,
          },
          { status: 500 },
        );
      }

      dailyGoal = newGoal;
    }

    // --------------------------------------------------
    // 10. Calculate current streak
    // --------------------------------------------------

    const {
      data: activities,
      error: activitiesError,
    } = await adminSupabase
      .from("learning_activity")
      .select("activity_date")
      .eq("user_id", user.id)
      .order("activity_date", {
        ascending: false,
      });

    if (activitiesError) {
      console.error(
        "Streak activity fetch error:",
        activitiesError,
      );

      return NextResponse.json(
        {
          error:
            "Failed to calculate learning streak",
          details: activitiesError.message,
        },
        { status: 500 },
      );
    }

    const activityDates = new Set(
      (activities ?? []).map(
        (activity) =>
          activity.activity_date,
      ),
    );

    const todayDate = new Date();

    const todayString = todayDate
      .toISOString()
      .split("T")[0];

    const yesterdayDate = new Date(
      todayDate,
    );

    yesterdayDate.setUTCDate(
      yesterdayDate.getUTCDate() - 1,
    );

    const yesterdayString = yesterdayDate
      .toISOString()
      .split("T")[0];

    let currentStreak = 0;

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
    // 11. Count total questions
    // --------------------------------------------------

    const {
      data: allMemories,
      error: memoriesError,
    } = await adminSupabase
      .from("student_learning_memory")
      .select(
        "questions_asked, mastery_level",
      )
      .eq("user_id", user.id);

    if (memoriesError) {
      console.error(
        "Learning memories fetch error:",
        memoriesError,
      );

      return NextResponse.json(
        {
          error:
            "Failed to calculate achievements",
          details: memoriesError.message,
        },
        { status: 500 },
      );
    }

    const totalQuestions = (
      allMemories ?? []
    ).reduce(
      (total, item) =>
        total + (item.questions_asked ?? 0),
      0,
    );

    const masteredTopics = (
      allMemories ?? []
    ).filter(
      (item) =>
        item.mastery_level === "mastered",
    ).length;

    // --------------------------------------------------
    // 12. Check and award achievements
    // --------------------------------------------------

    const newlyEarnedAchievements =
      await checkAndAwardAchievements({
        userId: user.id,
        currentStreak,
        questionsAnswered: totalQuestions,
        dailyGoalCompleted:
          dailyGoal.completed_questions >=
          dailyGoal.target_questions,
        masteredTopics,
      });

    // --------------------------------------------------
    // 13. Return result
    // --------------------------------------------------

    return NextResponse.json({
      success: true,

      result: {
        isCorrect,
        evaluation: evaluation.evaluation,
        score: evaluation.score,
        feedback: evaluation.feedback,
        topic,
        question,
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

      // Smart Review
      review: {
        nextReviewDate:
          reviewSchedule.nextReviewDate,
        reviewIntervalDays:
          reviewSchedule.reviewIntervalDays,
      },

      dailyGoal: {
        targetQuestions:
          dailyGoal.target_questions,
        completedQuestions:
          dailyGoal.completed_questions,
        remainingQuestions: Math.max(
          0,
          dailyGoal.target_questions -
            dailyGoal.completed_questions,
        ),
        completed:
          dailyGoal.completed_questions >=
          dailyGoal.target_questions,
      },

      achievements:
        newlyEarnedAchievements,

      memory: updatedMemory,
    });
  } catch (error) {
    console.error(
      "Quiz answer API error:",
      error,
    );

    return NextResponse.json(
      {
        error:
          "Failed to process quiz answer",
        details:
          error instanceof Error
            ? error.message
            : "Unknown error",
      },
      { status: 500 },
    );
  }
}