import { ai } from "@/lib/gemini";

export interface LearningMemory {
  topic: string;
  subject?: string | null;
  grade?: number | null;
  mastery_level?: string | null;
  questions_asked?: number | null;
  correct_answers?: number | null;
  incorrect_answers?: number | null;
  accuracy?: number | null;
  next_review_date?: string | null;
  review_interval_days?: number | null;
}

export interface LearningRecommendation {
  topic: string;
  action:
    | "review"
    | "practice"
    | "next_topic";
  priority: "high" | "medium" | "low";
  reason: string;
}

export async function generateLearningRecommendation(
  memories: LearningMemory[],
): Promise<LearningRecommendation | null> {
  if (!memories || memories.length === 0) {
    return null;
  }

  // ----------------------------------------
  // 1. Get today's date
  // ----------------------------------------
  const today = new Date()
    .toISOString()
    .split("T")[0];

  // ----------------------------------------
  // 2. Calculate recommendation candidates
  // ----------------------------------------
  const candidates = memories
    .filter(
      (memory) =>
        memory.topic &&
        memory.topic.toLowerCase() !==
          "general knowledge",
    )
    .map((memory) => {
      const accuracy = Number(
        memory.accuracy ?? 0,
      );

      const questionsAsked =
        Number(
          memory.questions_asked ?? 0,
        );

      const masteryLevel =
        memory.mastery_level ?? "learning";

      const nextReviewDate =
        memory.next_review_date ?? null;

      const isDue =
        nextReviewDate !== null &&
        nextReviewDate <= today;

      let action:
        | "review"
        | "practice"
        | "next_topic";

      let priority:
        | "high"
        | "medium"
        | "low";

      let reason: string;

      // ----------------------------------------
      // Priority 1:
      // Due + weak performance
      // ----------------------------------------
      if (isDue && accuracy < 50) {
        action = "review";
        priority = "high";

        reason =
          "This topic is due for review and your accuracy is below 50%.";
      }

      // ----------------------------------------
      // Priority 2:
      // Due + moderate performance
      // ----------------------------------------
      else if (isDue && accuracy < 80) {
        action = "review";
        priority = "medium";

        reason =
          "This topic is due for review and needs more reinforcement.";
      }

      // ----------------------------------------
      // Priority 3:
      // Weak performance
      // ----------------------------------------
      else if (accuracy < 50) {
        action = "review";
        priority = "high";

        reason =
          "Your accuracy is below 50%, so reviewing this topic will help strengthen the basics.";
      }

      // ----------------------------------------
      // Priority 4:
      // Moderate performance
      // ----------------------------------------
      else if (accuracy < 80) {
        action = "practice";
        priority = "medium";

        reason =
          "Your accuracy shows that you understand the topic but need more practice.";
      }

      // ----------------------------------------
      // Priority 5:
      // Strong performance but not mastered
      // ----------------------------------------
      else if (
        accuracy >= 80 &&
        masteryLevel !== "mastered"
      ) {
        action = "practice";
        priority = "medium";

        reason =
          "Your performance is strong, so more challenging practice can help you master the topic.";
      }

      // ----------------------------------------
      // Priority 6:
      // Mastered + strong performance
      // ----------------------------------------
      else {
        action = "next_topic";
        priority = "low";

        reason =
          "You have mastered this topic with strong performance and can move to a new topic.";
      }

      return {
        memory,
        accuracy,
        questionsAsked,
        masteryLevel,
        isDue,
        action,
        priority,
        reason,
      };
    });

  if (candidates.length === 0) {
    return null;
  }

  // ----------------------------------------
  // 3. Sort candidates
  // ----------------------------------------
  const priorityRank = {
    high: 1,
    medium: 2,
    low: 3,
  };

  candidates.sort((a, b) => {
    // Highest priority first
    if (
      priorityRank[a.priority] !==
      priorityRank[b.priority]
    ) {
      return (
        priorityRank[a.priority] -
        priorityRank[b.priority]
      );
    }

    // Due topics first
    if (a.isDue !== b.isDue) {
      return a.isDue ? -1 : 1;
    }

    // Lower accuracy first
    if (a.accuracy !== b.accuracy) {
      return a.accuracy - b.accuracy;
    }

    // More learning history first
    return (
      b.questionsAsked -
      a.questionsAsked
    );
  });

  const bestCandidate = candidates[0];

  // ----------------------------------------
  // 4. Ask Gemini only for a friendly reason
  // ----------------------------------------
  const prompt = `
You are EduMate, an AI educational tutor.

Create ONE short personalized learning recommendation message.

Topic:
${bestCandidate.memory.topic}

Subject:
${bestCandidate.memory.subject ?? "Unknown"}

Grade:
${bestCandidate.memory.grade ?? "Unknown"}

Accuracy:
${bestCandidate.accuracy}%

Questions Asked:
${bestCandidate.questionsAsked}

Mastery Level:
${bestCandidate.masteryLevel}

Currently Due for Review:
${bestCandidate.isDue ? "Yes" : "No"}

Recommended Action:
${bestCandidate.action}

Priority:
${bestCandidate.priority}

Reason:
${bestCandidate.reason}

IMPORTANT:
The topic, action, and priority have already been determined by EduMate.

You MUST NOT change:
- Topic
- Recommended action
- Priority

Your job is ONLY to create a short, friendly explanation for the student.

RULES:
- Mention only the exact topic provided.
- Do not recommend General Knowledge.
- Do not introduce another topic.
- Keep the message short.
- Use simple, student-friendly language.
- Be encouraging.
- Do not mention databases.
- Do not mention algorithms.
- Do not mention internal systems.
- Do not mention Smart Review.
- Do not change the recommended action.
- Do not change the priority.

Return JSON only:

{
  "reason": "Short personalized recommendation message"
}
`;

  try {
    const response =
      await ai.models.generateContent({
        model: "gemini-3.5-flash-lite",
        contents: prompt,
        config: {
          responseMimeType:
            "application/json",
          responseSchema: {
            type: "object",
            properties: {
              reason: {
                type: "string",
              },
            },
            required: ["reason"],
          },
        },
      });

    const text =
      response.text?.trim();

    if (!text) {
      return {
        topic: bestCandidate.memory.topic,
        action: bestCandidate.action,
        priority: bestCandidate.priority,
        reason: bestCandidate.reason,
      };
    }

    const recommendation =
      JSON.parse(text);

    // ----------------------------------------
    // 5. Validate Gemini reason
    // ----------------------------------------
    if (
      !recommendation.reason ||
      typeof recommendation.reason !==
        "string"
    ) {
      return {
        topic: bestCandidate.memory.topic,
        action: bestCandidate.action,
        priority: bestCandidate.priority,
        reason: bestCandidate.reason,
      };
    }

    // ----------------------------------------
    // 6. Application logic remains authoritative
    // ----------------------------------------
    return {
      topic: bestCandidate.memory.topic,
      action: bestCandidate.action,
      priority: bestCandidate.priority,
      reason: recommendation.reason,
    };
  } catch (error) {
    console.error(
      "Learning recommendation AI error:",
      error,
    );

    // ----------------------------------------
    // 7. Safe fallback
    // ----------------------------------------
    return {
      topic: bestCandidate.memory.topic,
      action: bestCandidate.action,
      priority: bestCandidate.priority,
      reason: bestCandidate.reason,
    };
  }
}