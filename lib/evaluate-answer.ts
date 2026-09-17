import { ai } from "@/lib/gemini";

export type AnswerEvaluation =
  | "correct"
  | "partially_correct"
  | "incorrect";

export interface AnswerEvaluationResult {
  evaluation: AnswerEvaluation;
  score: number;
  feedback: string;
}

/**
 * Normalize text for simple deterministic comparisons.
 */
function normalizeAnswer(text: string): string {
  return text
    .trim()
    .toLowerCase()
    .replace(/[.,!?;:'"()[\]{}]/g, "")
    .replace(/\s+/g, " ");
}

/**
 * Check whether the student's answer is an obvious exact/normalized match.
 */
function isNormalizedExactMatch(
  studentAnswer: string,
  correctAnswer: string,
): boolean {
  return (
    normalizeAnswer(studentAnswer) ===
    normalizeAnswer(correctAnswer)
  );
}

/**
 * Create safe deterministic feedback for a correct answer.
 *
 * We intentionally do not ask AI to generate feedback for a correct
 * answer because the feedback must stay aligned with the saved
 * correctAnswer.
 */
function createCorrectFeedback(
  correctAnswer: string,
): string {
  return `Correct! ${correctAnswer.trim()} is the expected answer. Great job!`;
}

/**
 * Create safe deterministic feedback for an exact match.
 */
function createExactMatchFeedback(
  correctAnswer: string,
): string {
  return `Correct! ${correctAnswer.trim()} is the expected answer. Great job!`;
}

export async function evaluateAnswer({
  question,
  studentAnswer,
  correctAnswer,
}: {
  question: string;
  studentAnswer: string;
  correctAnswer: string;
}): Promise<AnswerEvaluationResult> {
  const normalizedStudentAnswer =
    normalizeAnswer(studentAnswer);

  const normalizedCorrectAnswer =
    normalizeAnswer(correctAnswer);

  // --------------------------------------------------
  // 1. Validate input
  // --------------------------------------------------

  if (
    !normalizedStudentAnswer ||
    !normalizedCorrectAnswer
  ) {
    return {
      evaluation: "incorrect",
      score: 0,
      feedback:
        "Please provide an answer and try again.",
    };
  }

  // --------------------------------------------------
  // 2. Deterministic exact/normalized match
  // --------------------------------------------------

  if (
    normalizedStudentAnswer ===
    normalizedCorrectAnswer
  ) {
    return {
      evaluation: "correct",
      score: 100,
      feedback:
        createExactMatchFeedback(correctAnswer),
    };
  }

  // --------------------------------------------------
  // 3. AI semantic evaluation
  // --------------------------------------------------

  const prompt = `
You are an educational answer evaluator for EduMate.

Evaluate the student's answer against the expected answer.

You MUST evaluate ONLY the information provided below.

Question:
${question}

Expected Answer:
${correctAnswer}

Student Answer:
${studentAnswer}

IMPORTANT FEEDBACK RULES:

1. Evaluate the meaning of the student's answer, not exact wording.

2. Accept different wording when the meaning is correct.

3. Accept simple answers from school students when they correctly
   answer what was asked.

4. Do not mark an answer incorrect only because it is shorter
   than the expected answer.

5. If the question asks for ONE example, ONE item, or ONE thing,
   a single correct example is enough.

6. Accept common student-friendly wording when it clearly
   represents the same idea.

7. Do not require technical terminology when the student's
   answer clearly demonstrates the required understanding.

8. "correct" means the student's answer demonstrates the
   required understanding.

9. "partially_correct" means the student's answer contains
   some correct understanding but is incomplete.

10. "incorrect" means the student's answer does not demonstrate
    the required understanding.

11. Do not invent correctness when the student's answer is
    factually wrong.

12. Be fair to a school student.

13. Keep feedback short, friendly, and educational.

14. VERY IMPORTANT:
    Feedback MUST remain strictly about the Question,
    Expected Answer, and Student Answer.

15. NEVER introduce a different answer, concept, fact, example,
    scientific term, object, process, or explanation that is
    not necessary to evaluate the student's answer.

16. If the evaluation is "correct", the feedback must confirm
    the student's answer using ONLY the expected answer.

17. If the evaluation is "correct", DO NOT replace the expected
    answer with another concept from your general knowledge.

18. The Expected Answer is the authoritative answer for this
    evaluation.

19. Do not correct, reinterpret, or replace the Expected Answer.

20. Return JSON only.

Examples:

Expected Answer:
water

Student Answer:
Plants need water.

Evaluation:
correct

Expected Answer:
sunlight

Student Answer:
They need sunlight from the Sun.

Evaluation:
correct

Expected Answer:
stomata

Student Answer:
The tiny holes in leaves are stomata.

Evaluation:
correct

Expected Answer:
Plants need sunlight, water, and carbon dioxide.

Student Answer:
They need sunlight.

Evaluation:
partially_correct

Return exactly:

{
  "evaluation": "correct",
  "score": 100,
  "feedback": "Your answer matches the expected answer."
}
`;

  try {
    const response =
      await ai.models.generateContent({
        model: "gemini-3.5-flash-lite",
        contents: prompt,
        config: {
          responseMimeType: "application/json",

          responseSchema: {
            type: "object",

            properties: {
              evaluation: {
                type: "string",
                enum: [
                  "correct",
                  "partially_correct",
                  "incorrect",
                ],
              },

              score: {
                type: "number",
              },

              feedback: {
                type: "string",
              },
            },

            required: [
              "evaluation",
              "score",
              "feedback",
            ],
          },
        },
      });

    const text = response.text?.trim();

    if (!text) {
      throw new Error(
        "Empty answer evaluation response",
      );
    }

    const result =
      JSON.parse(text) as AnswerEvaluationResult;

    // --------------------------------------------------
    // 4. Validate AI evaluation
    // --------------------------------------------------

    const validEvaluations: AnswerEvaluation[] = [
      "correct",
      "partially_correct",
      "incorrect",
    ];

    if (
      !validEvaluations.includes(
        result.evaluation,
      )
    ) {
      throw new Error(
        "Invalid evaluation returned by AI",
      );
    }

    // --------------------------------------------------
    // 5. Normalize score
    // --------------------------------------------------

    let score = Math.max(
      0,
      Math.min(
        100,
        Number(result.score) || 0,
      ),
    );

    // Keep score consistent with evaluation.
    if (result.evaluation === "correct") {
      score = 100;
    } else if (
      result.evaluation === "incorrect"
    ) {
      score = 0;
    } else {
      // Keep AI partial score between 1 and 99.
      score = Math.max(
        1,
        Math.min(99, score),
      );
    }

    // --------------------------------------------------
    // 6. SAFE feedback handling
    // --------------------------------------------------

    /**
     * For correct answers, do NOT use Gemini's feedback.
     *
     * This prevents exactly the problem seen in the UI:
     *
     * Expected Answer: Energy
     * AI feedback: Glucose...
     *
     * Instead, the expected answer stored by EduMate
     * becomes the source of truth.
     */
    if (
      result.evaluation === "correct"
    ) {
      return {
        evaluation: "correct",
        score: 100,
        feedback:
          createCorrectFeedback(
            correctAnswer,
          ),
      };
    }

    // --------------------------------------------------
    // 7. Partial / incorrect feedback
    // --------------------------------------------------

    const feedback =
      result.feedback?.trim();

    return {
      evaluation: result.evaluation,
      score,
      feedback:
        feedback ||
        (
          result.evaluation ===
          "partially_correct"
            ? `You're on the right track. The expected answer is ${correctAnswer.trim()}.`
            : `Let's review this topic. The expected answer is ${correctAnswer.trim()}.`
        ),
    };
  } catch (error) {
    console.error(
      "Answer evaluation failed:",
      error,
    );

    // --------------------------------------------------
    // 8. Safe deterministic fallback
    // --------------------------------------------------

    const isExactMatch =
      isNormalizedExactMatch(
        studentAnswer,
        correctAnswer,
      );

    if (isExactMatch) {
      return {
        evaluation: "correct",
        score: 100,
        feedback:
          createExactMatchFeedback(
            correctAnswer,
          ),
      };
    }

    return {
      evaluation: "incorrect",
      score: 0,
      feedback:
        `Let's review this answer. The expected answer is ${correctAnswer.trim()}.`,
    };
  }
}