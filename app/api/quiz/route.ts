import { NextResponse } from "next/server";
import { ai } from "@/lib/gemini";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { supabase as adminSupabase } from "@/lib/supabase";
import { determineQuizDifficulty } from "@/lib/adaptive-difficulty";

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
    const {
      data: memories,
      error: memoryError,
    } = await adminSupabase
      .from("student_learning_memory")
      .select(
        "topic, subject, grade, mastery_level, notes, questions_asked, correct_answers, incorrect_answers, accuracy",
      )
      .eq("user_id", user.id)
      .order("updated_at", {
        ascending: false,
      })
      .limit(20);

    if (memoryError) {
      console.error(
        "Failed to load learning memories:",
        memoryError,
      );

      return NextResponse.json(
        {
          error:
            "Failed to load learning memories",
        },
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
    // 5. Determine adaptive difficulty
    // ----------------------------------------
    const accuracy = Number(
      selectedMemory.accuracy ?? 0,
    );

    const masteryLevel =
      selectedMemory.mastery_level ??
      "learning";

    const questionsAsked =
      selectedMemory.questions_asked ?? 0;

    const difficulty =
      determineQuizDifficulty({
        accuracy,
        masteryLevel,
        questionsAsked,
      });

    console.log(
      "Adaptive Quiz Difficulty:",
      {
        topic: selectedMemory.topic,
        accuracy,
        masteryLevel,
        questionsAsked,
        difficulty,
      },
    );

    // ----------------------------------------
    // 6. Get previously asked questions
    // ----------------------------------------
    const {
      data: previousQuestions,
      error: previousQuestionsError,
    } = await adminSupabase
      .from("quiz_questions")
      .select(
        "question, correct_answer, difficulty",
      )
      .eq("user_id", user.id)
      .eq("topic", selectedMemory.topic)
      .order("created_at", {
        ascending: false,
      })
      .limit(20);

    if (previousQuestionsError) {
      console.error(
        "Failed to load previous quiz questions:",
        previousQuestionsError,
      );

      return NextResponse.json(
        {
          error:
            "Failed to load previous quiz questions",
        },
        { status: 500 },
      );
    }

    // ----------------------------------------
    // 7. Build previous-question context
    // ----------------------------------------
    const previousQuestionContext =
      previousQuestions &&
      previousQuestions.length > 0
        ? previousQuestions
            .map(
              (item, index) =>
                `${index + 1}. ${item.question}`,
            )
            .join("\n")
        : "No previous questions.";

    // ----------------------------------------
    // 8. Generate NEW adaptive quiz question
    // ----------------------------------------
    const prompt = `
You are EduMate, an AI educational tutor.

Create ONE NEW quiz question ONLY about the exact topic provided below.

EXACT TOPIC:
${selectedMemory.topic}

SUBJECT:
${selectedMemory.subject ?? "Unknown"}

GRADE:
${selectedMemory.grade ?? "Unknown"}

CURRENT MASTERY:
${masteryLevel}

STUDENT PERFORMANCE:
Questions Asked: ${questionsAsked}
Correct Answers: ${
      selectedMemory.correct_answers ?? 0
    }
Incorrect Answers: ${
      selectedMemory.incorrect_answers ?? 0
    }
Accuracy: ${accuracy}%

ADAPTIVE DIFFICULTY:
${difficulty}

IMPORTANT:
The adaptive difficulty has already been calculated by EduMate based on the student's performance.

You MUST generate the question at exactly this difficulty:
${difficulty}

DIFFICULTY DEFINITIONS:

Easy:
- Test basic understanding.
- Use simple and clear wording.
- Ask about an important basic fact or concept.
- The expected answer should be short and clear.
- Do not make the question tricky.

Medium:
- Test understanding and application.
- Require slightly more explanation or reasoning.
- Use age-appropriate language.
- The student should need to think beyond simple recall.

Hard:
- Test deeper understanding.
- Require reasoning, explanation, or application.
- Challenge the student appropriately.
- Do not make the question unnecessarily confusing.

LEARNING NOTES:
${selectedMemory.notes ?? "No notes available."}

PREVIOUSLY ASKED QUESTIONS:
${previousQuestionContext}

STRICT TOPIC RULES:
- The quiz MUST test the exact topic: "${selectedMemory.topic}".
- Do NOT generate a question about General Knowledge.
- Do NOT switch to another topic.
- Do NOT introduce an unrelated topic.
- The topic returned in the JSON MUST be exactly "${selectedMemory.topic}".
- The question must be appropriate for Grade ${
      selectedMemory.grade ??
      "the student's grade"
    }.

STRICT DUPLICATE RULES:
- The new question MUST be different from every question in the PREVIOUSLY ASKED QUESTIONS list.
- Do NOT repeat the same question using slightly different wording.
- Do NOT ask the same concept in almost identical wording.
- Choose a different aspect of the topic when possible.
- If previous questions tested sunlight, choose another aspect such as carbon dioxide, water, oxygen, or the purpose of photosynthesis.
- The question must still test the exact topic.

IMPORTANT:
- Generate exactly ONE new question.
- The question MUST be exactly "${difficulty}" difficulty.
- Do NOT repeat a previous question.
- Provide one clear expected answer.
- Return JSON only.

Return exactly this format:

{
  "topic": "${selectedMemory.topic}",
  "question": "A completely new quiz question",
  "correctAnswer": "The expected answer"
}
`;

    const response =
      await ai.models.generateContent({
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
        {
          error:
            "Failed to generate quiz question",
        },
        { status: 500 },
      );
    }

    const quiz = JSON.parse(text);

    // ----------------------------------------
    // 9. Validate generated quiz
    // ----------------------------------------
    if (
      !quiz.topic ||
      !quiz.question ||
      !quiz.correctAnswer
    ) {
      return NextResponse.json(
        {
          error:
            "AI returned an incomplete quiz question",
        },
        { status: 500 },
      );
    }

    // Make sure the AI did not switch topics.
    if (
      quiz.topic.toLowerCase() !==
      selectedMemory.topic.toLowerCase()
    ) {
      console.error(
        "AI generated incorrect topic:",
        quiz.topic,
      );

      return NextResponse.json(
        {
          error:
            "Generated quiz topic did not match the selected topic",
        },
        { status: 500 },
      );
    }

    // ----------------------------------------
    // 10. Save generated question
    // ----------------------------------------
    const {
      error: saveQuestionError,
    } = await adminSupabase
      .from("quiz_questions")
      .insert({
        user_id: user.id,
        topic: selectedMemory.topic,
        question: quiz.question,
        correct_answer:
          quiz.correctAnswer,
        difficulty,
      });

    if (saveQuestionError) {
      console.error(
        "Failed to save quiz question:",
        saveQuestionError,
      );

      return NextResponse.json(
        {
          error:
            "Failed to save quiz question",
        },
        { status: 500 },
      );
    }

    // ----------------------------------------
    // 11. Return adaptive quiz
    // ----------------------------------------
    return NextResponse.json({
      success: true,

      quiz: {
        ...quiz,
        difficulty,
      },

      learningMemory: {
        topic: selectedMemory.topic,
        masteryLevel,
        accuracy,
        questionsAsked,
      },

      difficulty,
    });
  } catch (error) {
    console.error(
      "Quiz generation error:",
      error,
    );

    return NextResponse.json(
      {
        error: "Failed to generate quiz",
      },
      { status: 500 },
    );
  }
}