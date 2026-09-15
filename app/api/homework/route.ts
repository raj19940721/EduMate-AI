import { NextResponse } from "next/server";
import { ai } from "@/lib/gemini";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { generateEmbedding } from "@/lib/embeddings";
import { supabase as adminSupabase } from "@/lib/supabase";
import { checkGuardrails } from "@/lib/guardrails";

export async function POST(request: Request) {
  try {
    // ----------------------------------------
    // 1. Read request body
    // ----------------------------------------
    const body = await request.json().catch(() => null);

    const question =
      typeof body?.question === "string"
        ? body.question.trim()
        : "";

    const requestedSubject =
      typeof body?.subject === "string"
        ? body.subject.trim()
        : null;

    const requestedGrade =
      typeof body?.grade === "number"
        ? body.grade
        : null;

    const mode =
      body?.mode === "hint" ||
      body?.mode === "check"
        ? body.mode
        : "explain";

    // ----------------------------------------
    // 2. Validate question
    // ----------------------------------------
    if (!question) {
      return NextResponse.json(
        {
          error:
            "Please provide a homework question.",
        },
        { status: 400 },
      );
    }

    // ----------------------------------------
    // 3. Authenticate student
    // ----------------------------------------
    const supabase =
      await createSupabaseServerClient();

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
    // 4. Run guardrails
    // ----------------------------------------
    const guardrailResult =
      checkGuardrails(question);

    if (!guardrailResult.allowed) {
      return NextResponse.json(
        {
          success: false,
          blocked: true,
          message:
            guardrailResult.message ??
            "I can't help with that request.",
        },
        { status: 400 },
      );
    }

    // ----------------------------------------
    // 5. Generate embedding
    // ----------------------------------------
    let context = "";

    try {
      const embedding =
        await generateEmbedding(question);

      // ----------------------------------------
      // 6. Search relevant knowledge
      // ----------------------------------------
      const { data: knowledgeChunks, error: searchError } =
        await adminSupabase.rpc(
          "match_knowledge_chunks",
          {
            query_embedding: embedding,
            match_threshold: 0.7,
            match_count: 5,
            match_grade: requestedGrade,
            match_subject: requestedSubject,
          },
        );

      if (searchError) {
        console.error(
          "Homework knowledge search error:",
          searchError,
        );
      }

      if (
        knowledgeChunks &&
        knowledgeChunks.length > 0
      ) {
        context = knowledgeChunks
          .map(
            (
              chunk: {
                content: string;
                metadata?: Record<
                  string,
                  unknown
                >;
                similarity?: number;
              },
              index: number,
            ) =>
              `Knowledge ${index + 1}:
${chunk.content}`,
          )
          .join("\n\n");
      }
    } catch (error) {
      console.error(
        "Homework RAG error:",
        error,
      );

      // Homework should still work even if
      // knowledge retrieval is unavailable.
      context = "";
    }

    // ----------------------------------------
    // 7. Build mode instructions
    // ----------------------------------------
    let modeInstruction = "";

    if (mode === "hint") {
      modeInstruction = `
The student wants a HINT.

Do NOT give the final answer immediately.

Give one useful, answer-neutral hint that helps
the student identify the next step.

Do not reveal the complete solution.
`;
    } else if (mode === "check") {
      modeInstruction = `
The student wants their work checked.

Explain whether their answer or reasoning is correct.

If it is incorrect:
- Explain what needs to be corrected.
- Do not simply give the final answer.
- Help the student understand the mistake.

If the student has not provided enough work to check,
tell them what information is missing.
`;
    } else {
      modeInstruction = `
The student wants help understanding the homework.

Teach the concept step-by-step.

Do not simply provide a final answer without explanation.

For calculation problems:
- Show the steps clearly.
- Explain why each step is performed.
- Give the final answer only after the explanation.

For conceptual questions:
- Explain the idea simply.
- Give a relevant example when useful.
`;
    }

    // ----------------------------------------
    // 8. Build homework prompt
    // ----------------------------------------
    const prompt = `
You are EduMate, an AI personal homework tutor.

The student is doing homework at home.

HOMEWORK QUESTION:
${question}

SUBJECT:
${requestedSubject ?? "Not specified"}

GRADE:
${requestedGrade ?? "Not specified"}

${modeInstruction}

KNOWLEDGE CONTEXT:
${
  context ||
  "No matching study material was found. Use your general educational knowledge."
}

IMPORTANT RULES:
- Help the student learn.
- Use age-appropriate language.
- Be clear and encouraging.
- Do not mention RAG.
- Do not mention embeddings.
- Do not mention databases.
- Do not mention internal systems.
- Do not invent information from the knowledge context.
- If knowledge context is relevant, use it.
- If knowledge context is not relevant, answer using reliable general knowledge.
- Stay focused on the homework question.
- Do not introduce unrelated topics.
- If the question is ambiguous, explain what information is missing.
- Never pretend that an answer is correct when it is not.

Return JSON only.

Return exactly this structure:

{
  "subject": "Detected subject",
  "topic": "Detected homework topic",
  "explanation": "Clear explanation for the student",
  "steps": [
    "Step 1",
    "Step 2"
  ],
  "finalAnswer": "Final answer when appropriate",
  "hint": "A short useful hint"
}
`;

    // ----------------------------------------
    // 9. Generate AI response
    // ----------------------------------------
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
              subject: {
                type: "string",
              },

              topic: {
                type: "string",
              },

              explanation: {
                type: "string",
              },

              steps: {
                type: "array",
                items: {
                  type: "string",
                },
              },

              finalAnswer: {
                type: "string",
              },

              hint: {
                type: "string",
              },
            },

            required: [
              "subject",
              "topic",
              "explanation",
              "steps",
              "finalAnswer",
              "hint",
            ],
          },
        },
      });

    // ----------------------------------------
    // 10. Parse AI response
    // ----------------------------------------
    const text =
      response.text?.trim();

    if (!text) {
      return NextResponse.json(
        {
          error:
            "Failed to generate homework help.",
        },
        { status: 500 },
      );
    }

    const result = JSON.parse(text);

    // ----------------------------------------
    // 11. Validate AI response
    // ----------------------------------------
    if (
      !result.explanation ||
      !result.topic ||
      !Array.isArray(result.steps)
    ) {
      return NextResponse.json(
        {
          error:
            "AI returned an incomplete homework response.",
        },
        { status: 500 },
      );
    }

    // ----------------------------------------
    // 12. Return homework help
    // ----------------------------------------
    return NextResponse.json({
      success: true,

      homework: {
        subject: result.subject,
        topic: result.topic,
        explanation: result.explanation,
        steps: result.steps,
        finalAnswer:
          result.finalAnswer ?? "",
        hint: result.hint ?? "",
      },

      metadata: {
        mode,
        usedKnowledge:
          context.length > 0,
      },
    });
  } catch (error) {
    console.error(
      "Homework API error:",
      error,
    );

    return NextResponse.json(
      {
        error:
          "Failed to process homework question.",
        details:
          error instanceof Error
            ? error.message
            : "Unknown error",
      },
      { status: 500 },
    );
  }
}