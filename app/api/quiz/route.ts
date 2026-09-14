import { NextResponse } from "next/server";
import { ai } from "@/lib/gemini";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { supabase as adminSupabase } from "@/lib/supabase";

export async function POST(request: Request) {
  try {
    // ----------------------------------------
    // 1. Read request body
    // ----------------------------------------
    const body = await request.json().catch(() => null);

    const requestedTopic = body?.topic ?? null;

    // ----------------------------------------
    // 2. Authenticate student
    // ----------------------------------------
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

    // ----------------------------------------
    // 3. Get student's learning memories
    // ----------------------------------------
    const { data: memories, error: memoryError } =
      await adminSupabase
        .from("student_learning_memory")
        .select(
          "topic, subject, grade, mastery_level, notes, questions_asked, correct_answers, incorrect_answers, accuracy",
        )
        .eq("user_id", user.id)
        .order("updated_at", { ascending: false })
        .limit(20);

    if (memoryError) {
      console.error(
        "Failed to load learning memories:",
        memoryError,
      );

      return NextResponse.json(
        { error: "Failed to load learning memories" },
        { status: 500 },
      );
    }

    if (!memories || memories.length === 0) {
      return NextResponse.json(
        {
          error:
            "No learning memory available. Please learn a topic first.",
        },
        { status: 404 },
      );
    }

    // ----------------------------------------
    // 4. Select topic
    // ----------------------------------------
    const selectedMemory = requestedTopic
      ? memories.find(
          (memory) =>
            memory.topic.toLowerCase() ===
            requestedTopic.toLowerCase(),
        )
      : memories[0];

    if (!selectedMemory) {
      return NextResponse.json(
        {
          error: `No learning memory found for topic: ${requestedTopic}`,
        },
        { status: 404 },
      );
    }

    // ----------------------------------------
    // 5. Generate quiz question
    // ----------------------------------------
    const prompt = `
You are EduMate, an AI educational tutor.

Create ONE quiz question ONLY about the exact topic provided below.

EXACT TOPIC:
${selectedMemory.topic}

SUBJECT:
${selectedMemory.subject ?? "Unknown"}

GRADE:
${selectedMemory.grade ?? "Unknown"}

CURRENT MASTERY:
${selectedMemory.mastery_level}

PREVIOUS QUIZ PERFORMANCE:
Questions Asked: ${selectedMemory.questions_asked ?? 0}
Correct Answers: ${selectedMemory.correct_answers ?? 0}
Incorrect Answers: ${selectedMemory.incorrect_answers ?? 0}
Accuracy: ${selectedMemory.accuracy ?? 0}%

LEARNING NOTES:
${selectedMemory.notes ?? "No notes available."}

STRICT RULES:
- The quiz MUST test the exact topic: "${selectedMemory.topic}".
- Do NOT generate a question about General Knowledge.
- Do NOT switch to another topic.
- Do NOT introduce an unrelated topic.
- The topic returned in the JSON MUST be exactly "${selectedMemory.topic}".
- The question must be appropriate for Grade ${selectedMemory.grade ?? "the student's grade"}.
- If the topic is Photosynthesis, ask specifically about photosynthesis.
- If the topic is Solar System, ask specifically about the Solar System.
- If the topic is Multiplication, ask specifically about multiplication.
- Test understanding of the selected topic.
- Keep the question clear and concise.
- Provide one clear expected answer.
- If mastery is "learning", make the question simple.
- If mastery is "practicing", make the question moderately challenging.
- If mastery is "mastered", make the question slightly more challenging.
- Return JSON only.

Return exactly this format:

{
  "topic": "${selectedMemory.topic}",
  "question": "The quiz question",
  "correctAnswer": "The expected answer"
}
`;

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
            question: {
              type: "string",
            },
            correctAnswer: {
              type: "string",
            },
          },
          required: [
            "topic",
            "question",
            "correctAnswer",
          ],
        },
      },
    });

    const text = response.text?.trim();

    if (!text) {
      return NextResponse.json(
        { error: "Failed to generate quiz question" },
        { status: 500 },
      );
    }

    const quiz = JSON.parse(text);

    // ----------------------------------------
    // 6. Return quiz
    // ----------------------------------------
    return NextResponse.json({
      success: true,
      quiz,
      learningMemory: {
        topic: selectedMemory.topic,
        masteryLevel: selectedMemory.mastery_level,
        accuracy: selectedMemory.accuracy ?? 0,
        questionsAsked: selectedMemory.questions_asked ?? 0,
      },
    });
  } catch (error) {
    console.error("Quiz generation error:", error);

    return NextResponse.json(
      {
        error: "Failed to generate quiz",
      },
      { status: 500 },
    );
  }
}