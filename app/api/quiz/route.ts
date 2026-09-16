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

    const body =
      await request.json().catch(() => null);

    const requestedTopic =
      body?.topic ?? null;

    // ----------------------------------------
    // 2. Authenticate student
    // ----------------------------------------

    const supabase =
      await createSupabaseServerClient();

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        {
          error: "Unauthorized",
        },
        {
          status: 401,
        }
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
        "topic, subject, grade, mastery_level, notes, questions_asked, correct_answers, incorrect_answers, accuracy"
      )
      .eq("user_id", user.id)
      .order("updated_at", {
        ascending: false,
      })
      .limit(20);

    if (memoryError) {
      console.error(
        "Failed to load learning memories:",
        memoryError
      );

      return NextResponse.json(
        {
          error:
            "Failed to load learning memories",
        },
        {
          status: 500,
        }
      );
    }

    if (
      !memories ||
      memories.length === 0
    ) {
      return NextResponse.json(
        {
          error:
            "No learning memory available. Please learn a topic first.",
        },
        {
          status: 404,
        }
      );
    }

    // ----------------------------------------
    // 4. Select topic
    // ----------------------------------------

    const selectedMemory =
      requestedTopic
        ? memories.find(
            (memory) =>
              memory.topic
                .toLowerCase()
                .trim() ===
              requestedTopic
                .toLowerCase()
                .trim()
          )
        : memories[0];

    if (!selectedMemory) {
      return NextResponse.json(
        {
          error: `No learning memory found for topic: ${requestedTopic}`,
        },
        {
          status: 404,
        }
      );
    }

    // ----------------------------------------
    // 5. Determine adaptive difficulty
    // ----------------------------------------

    const accuracy = Number(
      selectedMemory.accuracy ?? 0
    );

    const masteryLevel =
      selectedMemory.mastery_level ??
      "learning";

    const questionsAsked =
      Number(
        selectedMemory.questions_asked ?? 0
      );

    const difficulty =
      determineQuizDifficulty({
        accuracy,
        masteryLevel,
        questionsAsked,
      });

    console.log(
      "🎯 Adaptive Quiz Difficulty:",
      {
        topic:
          selectedMemory.topic,
        accuracy,
        masteryLevel,
        questionsAsked,
        difficulty,
      }
    );

    // ----------------------------------------
    // 6. Get ALL previous questions
    // ----------------------------------------

    const {
      data: previousQuestions,
      error:
        previousQuestionsError,
    } = await adminSupabase
      .from("quiz_questions")
      .select(
        "question, correct_answer, difficulty, created_at"
      )
      .eq("user_id", user.id)
      .eq(
        "topic",
        selectedMemory.topic
      )
      .order("created_at", {
        ascending: false,
      });

    if (previousQuestionsError) {
      console.error(
        "Failed to load previous quiz questions:",
        previousQuestionsError
      );

      return NextResponse.json(
        {
          error:
            "Failed to load previous quiz questions",
        },
        {
          status: 500,
        }
      );
    }

    const allPreviousQuestions =
      previousQuestions ?? [];

    console.log(
      "📚 Previous quiz history:",
      {
        topic:
          selectedMemory.topic,
        totalQuestions:
          allPreviousQuestions.length,
      }
    );

    // ----------------------------------------
    // 7. Normalize questions
    // ----------------------------------------

    function normalizeQuestion(
      question: string
    ) {
      return question
        .toLowerCase()
        .replace(
          /[^\p{L}\p{N}\s]/gu,
          ""
        )
        .replace(/\s+/g, " ")
        .trim();
    }

    // ----------------------------------------
    // 8. Common words that should not affect
    // similarity calculation too much.
    // ----------------------------------------

    const stopWords =
      new Set([
        "what",
        "is",
        "are",
        "the",
        "a",
        "an",
        "of",
        "to",
        "in",
        "on",
        "for",
        "do",
        "does",
        "did",
        "how",
        "why",
        "which",
        "who",
        "where",
        "when",
        "can",
        "and",
        "or",
        "from",
        "with",
        "that",
        "this",
        "their",
        "they",
        "plant",
        "plants",
      ]);

    function getMeaningfulWords(
      question: string
    ) {
      return new Set(
        normalizeQuestion(question)
          .split(" ")
          .filter(
            (word) =>
              word.length > 3 &&
              !stopWords.has(word)
          )
      );
    }

    // ----------------------------------------
    // 9. Build complete previous-question list
    // ----------------------------------------

    const previousQuestionSet =
      new Set(
        allPreviousQuestions
          .map(
            (item) =>
              normalizeQuestion(
                item.question
              )
          )
          .filter(Boolean)
      );

    const previousQuestionContext =
      allPreviousQuestions.length > 0
        ? allPreviousQuestions
            .map(
              (item, index) =>
                `${index + 1}. ${item.question}`
            )
            .join("\n")
        : "No previous questions.";

    // ----------------------------------------
    // 10. Check if question is too similar
    // ----------------------------------------

    function isTooSimilarToPreviousQuestion(
      generatedQuestion: string
    ) {
      const normalizedGenerated =
        normalizeQuestion(
          generatedQuestion
        );

      // ----------------------------------------
      // Exact duplicate
      // ----------------------------------------

      if (
        previousQuestionSet.has(
          normalizedGenerated
        )
      ) {
        return {
          duplicate: true,
          reason:
            "exact_duplicate",
        };
      }

      // ----------------------------------------
      // Meaningful-word similarity
      // ----------------------------------------

      const generatedWords =
        getMeaningfulWords(
          generatedQuestion
        );

      if (
        generatedWords.size === 0
      ) {
        return {
          duplicate: false,
          reason: "",
        };
      }

      for (
        const previousQuestion
        of allPreviousQuestions
      ) {
        const previousWords =
          getMeaningfulWords(
            previousQuestion.question
          );

        if (
          previousWords.size === 0
        ) {
          continue;
        }

        let intersection = 0;

        for (
          const word of generatedWords
        ) {
          if (
            previousWords.has(word)
          ) {
            intersection++;
          }
        }

        const unionSize =
          new Set([
            ...generatedWords,
            ...previousWords,
          ]).size;

        const jaccardSimilarity =
          unionSize > 0
            ? intersection /
              unionSize
            : 0;

        // Very high semantic-word overlap
        if (
          jaccardSimilarity >= 0.75
        ) {
          return {
            duplicate: true,
            reason:
              "very_similar",
            previousQuestion:
              previousQuestion.question,
            similarity:
              jaccardSimilarity,
          };
        }
      }

      return {
        duplicate: false,
        reason: "",
      };
    }

    // ----------------------------------------
    // 11. Generate adaptive question
    // ----------------------------------------

    const maxGenerationAttempts = 3;

    let quiz: {
      topic: string;
      question: string;
      correctAnswer: string;
    } | null = null;

    for (
      let attempt = 1;
      attempt <=
      maxGenerationAttempts;
      attempt++
    ) {
      console.log(
        `🎯 Generating quiz question - attempt ${attempt}/${maxGenerationAttempts}`,
        {
          topic:
            selectedMemory.topic,
          difficulty,
        }
      );

      const prompt = `
You are EduMate, a friendly AI educational tutor.

Create ONE completely NEW quiz question.

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
        selectedMemory.correct_answers ??
        0
      }
Incorrect Answers: ${
        selectedMemory.incorrect_answers ??
        0
      }
Accuracy: ${accuracy}%

REQUIRED DIFFICULTY:
${difficulty}

The difficulty has already been calculated by EduMate.
You MUST follow this difficulty.

DIFFICULTY DEFINITIONS:

Easy:
- Basic understanding.
- Simple age-appropriate wording.
- Test an important basic fact or concept.
- Short and clear expected answer.
- No tricky wording.

Medium:
- Understanding and application.
- Require some reasoning or explanation.
- Age appropriate.
- More than simple recall.

Hard:
- Deeper understanding.
- Reasoning, explanation, or application.
- Challenging but still age appropriate.
- Do not make the question confusing.

LEARNING NOTES:
${selectedMemory.notes ?? "No notes available."}

PREVIOUSLY ASKED QUESTIONS:
${previousQuestionContext}

VERY IMPORTANT — QUESTION VARIETY:

The student has already answered the questions listed above.

You MUST NOT repeat any previous question.

You MUST NOT create a question that is merely a reworded version of a previous question.

You MUST NOT test exactly the same concept using nearly identical wording.

Choose a different aspect, fact, relationship, or application within the exact topic.

For example, if previous questions already tested:
- chlorophyll
- sunlight
- water
- carbon dioxide
- the purpose of photosynthesis

then choose another valid aspect of photosynthesis rather than asking those same concepts again.

The question must still remain strictly within the topic:
${selectedMemory.topic}

IMPORTANT:
- Generate exactly ONE question.
- Keep it at ${difficulty} difficulty.
- Do not switch topics.
- Do not ask General Knowledge.
- Do not repeat previous questions.
- Do not create a minor wording variation of a previous question.
- The question must be appropriate for Grade ${
        selectedMemory.grade ??
        "the student's grade"
      }.
- Provide one clear expected answer.
- Return JSON only.

The returned topic MUST exactly match:
${selectedMemory.topic}

Return exactly:

{
  "topic": "${selectedMemory.topic}",
  "question": "A completely new question",
  "correctAnswer": "The expected answer"
}
`;

      try {
        const response =
          await ai.models.generateContent({
            model:
              "gemini-3.5-flash-lite",

            contents: prompt,

            config: {
              responseMimeType:
                "application/json",

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

        const text =
          response.text?.trim();

        if (!text) {
          console.warn(
            `⚠️ Attempt ${attempt}: empty AI response.`
          );

          continue;
        }

        const generatedQuiz =
          JSON.parse(text);

        // ----------------------------------------
        // Validate response
        // ----------------------------------------

        if (
          !generatedQuiz.topic ||
          !generatedQuiz.question ||
          !generatedQuiz.correctAnswer
        ) {
          console.warn(
            `⚠️ Attempt ${attempt}: incomplete quiz response.`
          );

          continue;
        }

        // ----------------------------------------
        // Validate topic
        // ----------------------------------------

        if (
          generatedQuiz.topic
            .toLowerCase()
            .trim() !==
          selectedMemory.topic
            .toLowerCase()
            .trim()
        ) {
          console.warn(
            "⚠️ AI generated wrong topic:",
            generatedQuiz.topic
          );

          continue;
        }

        // ----------------------------------------
        // Local duplicate validation
        // ----------------------------------------

        const similarityCheck =
          isTooSimilarToPreviousQuestion(
            generatedQuiz.question
          );

        if (
          similarityCheck.duplicate
        ) {
          console.warn(
            "⚠️ Duplicate/similar question detected:",
            {
              attempt,
              reason:
                similarityCheck.reason,
              generatedQuestion:
                generatedQuiz.question,
              previousQuestion:
                similarityCheck.previousQuestion,
              similarity:
                similarityCheck.similarity,
            }
          );

          continue;
        }

        // ----------------------------------------
        // Question is valid and new
        // ----------------------------------------

        quiz = {
          topic:
            generatedQuiz.topic,
          question:
            generatedQuiz.question,
          correctAnswer:
            generatedQuiz.correctAnswer,
        };

        console.log(
          "✅ New unique quiz question generated:",
          {
            attempt,
            topic:
              quiz.topic,
            difficulty,
            question:
              quiz.question,
          }
        );

        break;
      } catch (generationError) {
        console.error(
          `❌ Quiz generation attempt ${attempt} failed:`,
          generationError
        );
      }
    }

    // ----------------------------------------
    // 12. No unique question generated
    // ----------------------------------------

    if (!quiz) {
      return NextResponse.json(
        {
          error:
            "Unable to generate a new unique quiz question. Please try again.",
        },
        {
          status: 500,
        }
      );
    }

    // ----------------------------------------
    // 13. Save generated question
    // ----------------------------------------

    const {
      error: saveQuestionError,
    } = await adminSupabase
      .from("quiz_questions")
      .insert({
        user_id: user.id,

        topic:
          selectedMemory.topic,

        question:
          quiz.question,

        correct_answer:
          quiz.correctAnswer,

        difficulty,
      });

    if (saveQuestionError) {
      console.error(
        "Failed to save quiz question:",
        saveQuestionError
      );

      return NextResponse.json(
        {
          error:
            "Failed to save quiz question",
        },
        {
          status: 500,
        }
      );
    }

    // ----------------------------------------
    // 14. Return adaptive quiz
    // ----------------------------------------

    console.log(
      "🎯 Final Adaptive Quiz:",
      {
        topic:
          selectedMemory.topic,

        difficulty,

        accuracy,

        masteryLevel,

        questionsAsked,

        previousQuestionCount:
          allPreviousQuestions.length,

        question:
          quiz.question,
      }
    );

    return NextResponse.json({
      success: true,

      quiz: {
        ...quiz,

        difficulty,
      },

      learningMemory: {
        topic:
          selectedMemory.topic,

        masteryLevel,

        accuracy,

        questionsAsked,
      },

      difficulty,
    });
  } catch (error) {
    console.error(
      "Quiz generation error:",
      error
    );

    return NextResponse.json(
      {
        error:
          "Failed to generate quiz",
      },
      {
        status: 500,
      }
    );
  }
}