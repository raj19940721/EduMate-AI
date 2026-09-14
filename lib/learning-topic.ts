import { ai } from "@/lib/gemini";

export interface LearningTopic {
  topic: string;
  subject: string;
  masteryLevel: "learning" | "practicing" | "mastered";
  notes: string;
}

export async function extractLearningTopic(
  currentQuestion: string,
  conversation: string,
): Promise<LearningTopic | null> {
  const prompt = `
You are an educational learning tracker for EduMate.

Your job is to identify whether the student is actually LEARNING or PRACTICING an educational topic.

Conversation History:
${conversation || "No previous conversation."}

Current Student Question:
${currentQuestion}

IMPORTANT:
Not every question represents a learning session.

For example:
- "What is photosynthesis?" → learning topic: Photosynthesis
- "Explain photosynthesis" → learning topic: Photosynthesis
- "Why is photosynthesis important?" → learning topic: Photosynthesis
- "Give me some questions on photosynthesis" → learning topic: Photosynthesis
- "Can you quiz me on photosynthesis?" → learning topic: Photosynthesis
- "Why is it important?" after discussing photosynthesis → learning topic: Photosynthesis

But:
- "Which planet is known as the Red Planet?" → NOT a learning topic
- "What is the capital of France?" → NOT a learning topic
- "Who invented the telephone?" → NOT a learning topic
- A simple general-knowledge question → NOT a learning topic
- A greeting → NOT a learning topic
- "Thank you" → NOT a learning topic

RULES:

1. Only create or update learning memory when the student is clearly learning,
   practicing, studying, reviewing, or being quizzed on a topic.

2. A standalone general-knowledge/fact question should return null.

3. If the current question is a follow-up to an existing educational topic,
   use the previous topic.

4. Never create "General Knowledge" as a learning topic.

5. Never use "General Knowledge" as the topic value.

6. Do not create a new topic simply because the question has an objectively
   correct answer.

7. If the conversation contains a clear educational learning topic and the
   student continues asking about it, return that topic.

8. For quiz or practice requests, return the topic being practiced only when
   the topic is explicitly known from the conversation.

9. If there is no meaningful learning topic, return null.

10. Identify the appropriate school subject:
    - Science for plants, photosynthesis, animals, Solar System, etc.
    - Math for arithmetic, multiplication, division, fractions, geometry, etc.
    - English for grammar, vocabulary, reading, writing, etc.
    - Social Studies for history, geography, civics, etc.

11. Set masteryLevel:
    - "learning" when the student is learning or asking for an explanation.
    - "practicing" when the student is solving questions or practicing.
    - "mastered" only when there is strong evidence that the student understands
      the topic.

12. Keep notes short.

Return JSON only.

If there is no meaningful learning topic, return:

{
  "topic": "",
  "subject": "",
  "masteryLevel": "learning",
  "notes": ""
}

Otherwise return:

{
  "topic": "Photosynthesis",
  "subject": "Science",
  "masteryLevel": "learning",
  "notes": "The student is learning about photosynthesis."
}
`;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash-lite",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: "object",
          properties: {
            topic: {
              type: "string",
            },
            subject: {
              type: "string",
            },
            masteryLevel: {
              type: "string",
              enum: [
                "learning",
                "practicing",
                "mastered",
              ],
            },
            notes: {
              type: "string",
            },
          },
          required: [
            "topic",
            "subject",
            "masteryLevel",
            "notes",
          ],
        },
      },
    });

    const text = response.text?.trim();

    if (!text) {
      return null;
    }

    const result =
      JSON.parse(text) as LearningTopic;

    // ----------------------------------------
    // Reject empty topic
    // ----------------------------------------
    if (!result.topic?.trim()) {
      return null;
    }

    // ----------------------------------------
    // Never store General Knowledge
    // ----------------------------------------
    if (
      result.topic
        .trim()
        .toLowerCase() ===
      "general knowledge"
    ) {
      return null;
    }

    return result;
  } catch (error) {
    console.error(
      "Learning topic extraction failed:",
      error,
    );

    return null;
  }
}