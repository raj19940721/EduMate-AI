import { supabase as adminSupabase } from "@/lib/supabase";

interface AchievementContext {
  userId: string;
  currentStreak: number;
  questionsAnswered: number;
  dailyGoalCompleted: boolean;
  masteredTopics: number;
}

export interface LearningAchievement {
  achievementKey: string;
  achievementName: string;
  description: string;
}

const ACHIEVEMENTS: LearningAchievement[] = [
  {
    achievementKey: "first_quiz",
    achievementName: "First Step",
    description: "Answer your first quiz question.",
  },
  {
    achievementKey: "quiz_10",
    achievementName: "Quiz Starter",
    description: "Answer 10 quiz questions.",
  },
  {
    achievementKey: "streak_3",
    achievementName: "3-Day Streak",
    description: "Learn for 3 consecutive days.",
  },
  {
    achievementKey: "daily_goal",
    achievementName: "Goal Crusher",
    description: "Complete a daily learning goal.",
  },
  {
    achievementKey: "topic_master",
    achievementName: "Topic Master",
    description: "Master at least one topic with strong performance.",
  },
];

export async function checkAndAwardAchievements({
  userId,
  currentStreak,
  questionsAnswered,
  dailyGoalCompleted,
  masteredTopics,
}: AchievementContext) {
  const earnedAchievements: LearningAchievement[] = [];

  const shouldEarn: LearningAchievement[] = [];

  // --------------------------------------------------
  // 1. First quiz
  // --------------------------------------------------

  if (questionsAnswered >= 1) {
    shouldEarn.push(
      ACHIEVEMENTS.find(
        (achievement) => achievement.achievementKey === "first_quiz",
      )!,
    );
  }

  // --------------------------------------------------
  // 2. Answer 10 questions
  // --------------------------------------------------

  if (questionsAnswered >= 10) {
    shouldEarn.push(
      ACHIEVEMENTS.find(
        (achievement) => achievement.achievementKey === "quiz_10",
      )!,
    );
  }

  // --------------------------------------------------
  // 3. Three day streak
  // --------------------------------------------------

  if (currentStreak >= 3) {
    shouldEarn.push(
      ACHIEVEMENTS.find(
        (achievement) => achievement.achievementKey === "streak_3",
      )!,
    );
  }

  // --------------------------------------------------
  // 4. Complete daily goal
  // --------------------------------------------------

  if (dailyGoalCompleted) {
    shouldEarn.push(
      ACHIEVEMENTS.find(
        (achievement) => achievement.achievementKey === "daily_goal",
      )!,
    );
  }

  // --------------------------------------------------
  // 5. Master a topic
  // --------------------------------------------------

  if (masteredTopics >= 1) {
    shouldEarn.push(
      ACHIEVEMENTS.find(
        (achievement) => achievement.achievementKey === "topic_master",
      )!,
    );
  }

  // --------------------------------------------------
  // 6. Check existing achievements
  // --------------------------------------------------

  const { data: existingAchievements, error: fetchError } = await adminSupabase
    .from("learning_achievements")
    .select("achievement_key")
    .eq("user_id", userId);

  if (fetchError) {
    throw fetchError;
  }

  const existingKeys = new Set(
    (existingAchievements ?? []).map(
      (achievement) => achievement.achievement_key,
    ),
  );

  // --------------------------------------------------
  // 7. Insert newly earned achievements
  // --------------------------------------------------

  for (const achievement of shouldEarn) {
    if (existingKeys.has(achievement.achievementKey)) {
      continue;
    }

    const { error: insertError } = await adminSupabase
      .from("learning_achievements")
      .insert({
        user_id: userId,
        achievement_key: achievement.achievementKey,
        achievement_name: achievement.achievementName,
        description: achievement.description,
      });

    if (insertError) {
      throw insertError;
    }

    earnedAchievements.push(achievement);
  }

  return earnedAchievements;
}
