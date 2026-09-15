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

export async function evaluateAnswer({
  question,
  studentAnswer,
  correctAnswer,
}: {
  question: string;
  studentAnswer: string;
  correctAnswer: string;
}): Promise<AnswerEvaluationResult> {
  const prompt = `
You are an educational answer evaluator for EduMate.

Evaluate the student's answer against the expected answer.

Question:
${question}

Expected Answer:
${correctAnswer}

Student Answer:
${studentAnswer}

Rules:
- Evaluate the meaning of the student's answer, not exact wording.
- Accept different wording when the meaning is correct.
- "correct" means the answer demonstrates the required understanding.
- "partially_correct" means the answer contains some correct understanding but is incomplete.
- "incorrect" means the answer does not demonstrate the required understanding.
- Do not require the student to use the exact wording of the expected answer.
- Be fair to a school student.
- Keep feedback short, friendly, and educational.
- Do not reveal unnecessary information.
- Return JSON only.

Return exactly:

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

    return JSON.parse(
      text,
    ) as AnswerEvaluationResult;
  } catch (error) {
    console.error(
      "Answer evaluation failed:",
      error,
    );

    // Safe fallback
    const isExactMatch =
      studentAnswer.trim().toLowerCase() ===
      correctAnswer.trim().toLowerCase();

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