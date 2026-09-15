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
 *
 * This avoids unnecessary AI calls for answers such as:
 * "Water"
 * "water."
 * " WATER "
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
  // 1. Deterministic exact/normalized match
  // --------------------------------------------------

  if (
    normalizedStudentAnswer &&
    normalizedStudentAnswer === normalizedCorrectAnswer
  ) {
    return {
      evaluation: "correct",
      score: 100,
      feedback: "Correct! Great job!",
    };
  }

  // --------------------------------------------------
  // 2. AI semantic evaluation
  // --------------------------------------------------

  const prompt = `
You are an educational answer evaluator for EduMate.

Evaluate the student's answer against the expected answer.

Question:
${question}

Expected Answer:
${correctAnswer}

Student Answer:
${studentAnswer}

Important evaluation guidance:

1. Evaluate the meaning of the student's answer, not exact wording.
2. Accept different wording when the meaning is correct.
3. Accept simple answers from school students when they correctly answer what was asked.
4. Do not mark an answer incorrect only because it is shorter than the expected answer.
5. If the question asks for ONE example, ONE item, or ONE thing, a single correct example is enough.
6. If the expected answer contains several valid possibilities, accept any one of those possibilities when the question asks for one.
7. Accept common student-friendly wording when it clearly represents the same idea.
8. Do not require the student to use technical terminology if their answer clearly demonstrates the required understanding.
9. "correct" means the answer demonstrates the required understanding.
10. "partially_correct" means the answer contains some correct understanding but is incomplete or missing an important part.
11. "incorrect" means the answer does not demonstrate the required understanding.
12. Do not invent correctness when the student's answer is factually wrong.
13. Be fair to a school student.
14. Keep feedback short, friendly, and educational.
15. Do not reveal unnecessary information.
16. Return JSON only.

Examples of acceptable semantic matching:

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

Return exactly this JSON structure:

{
  "evaluation": "correct",
  "score": 100,
  "feedback": "Great job! Your answer shows the correct idea."
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
    // 3. Validate AI result
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

    const score = Math.max(
      0,
      Math.min(100, Number(result.score) || 0),
    );

    return {
      evaluation: result.evaluation,
      score,
      feedback:
        result.feedback?.trim() ||
        "Let's keep learning and try again!",
    };
  } catch (error) {
    console.error(
      "Answer evaluation failed:",
      error,
    );

    // --------------------------------------------------
    // 4. Safe fallback
    // --------------------------------------------------

    const isExactMatch =
      isNormalizedExactMatch(
        studentAnswer,
        correctAnswer,
      );

    return {
      evaluation: isExactMatch
        ? "correct"
        : "incorrect",

      score: isExactMatch ? 100 : 0,

      feedback: isExactMatch
        ? "Correct! Great job!"
        : "Let's review this answer and try again.",
    };
  }
}