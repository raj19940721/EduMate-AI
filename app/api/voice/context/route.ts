import { generateEmbedding } from "@/lib/embeddings";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { supabase as adminSupabase } from "@/lib/supabase";
import { evaluateRetrieval } from "@/lib/rag-evaluation";
import { checkGuardrails } from "@/lib/guardrails";

export async function POST(request: Request) {
  try {
    // --------------------------------
    // 1. Validate request
    // --------------------------------

    const body = await request.json();

    const question = body.question;

    if (
      typeof question !== "string" ||
      !question.trim()
    ) {
      return new Response(
        JSON.stringify({
          error: "Voice question is required",
        }),
        {
          status: 400,
          headers: {
            "Content-Type": "application/json",
          },
        }
      );
    }

    const cleanQuestion = question.trim();

    // --------------------------------
    // 2. Guardrails
    // --------------------------------

    const guardrailResult =
      checkGuardrails(cleanQuestion);

    if (!guardrailResult.allowed) {
      return new Response(
        JSON.stringify({
          error:
            guardrailResult.message ??
            "This question cannot be processed.",
        }),
        {
          status: 400,
          headers: {
            "Content-Type": "application/json",
          },
        }
      );
    }

    // --------------------------------
    // 3. Authenticate user
    // --------------------------------

    const supabase =
      await createSupabaseServerClient();

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return new Response(
        JSON.stringify({
          error: "User is not authenticated",
        }),
        {
          status: 401,
          headers: {
            "Content-Type": "application/json",
          },
        }
      );
    }

    // --------------------------------
    // 4. Load student profile
    // --------------------------------

    const { data: student, error: studentError } =
      await adminSupabase
        .from("students")
        .select("name, grade, subject")
        .eq("user_id", user.id)
        .maybeSingle();

    if (studentError) {
      console.error(
        "Failed to load student profile:",
        studentError
      );

      return new Response(
        JSON.stringify({
          error: "Failed to load student profile",
        }),
        {
          status: 500,
          headers: {
            "Content-Type": "application/json",
          },
        }
      );
    }

    if (!student) {
      return new Response(
        JSON.stringify({
          error: "Student profile not found",
        }),
        {
          status: 404,
          headers: {
            "Content-Type": "application/json",
          },
        }
      );
    }

    // --------------------------------
    // 5. Load learning memory
    // --------------------------------

    const {
      data: learningMemories,
      error: learningMemoryError,
    } = await adminSupabase
      .from("student_learning_memory")
      .select(
        "topic, subject, grade, mastery_level, notes, updated_at"
      )
      .eq("user_id", user.id)
      .order("updated_at", {
        ascending: false,
      })
      .limit(20);

    if (learningMemoryError) {
      console.error(
        "Failed to load learning memory:",
        learningMemoryError
      );
    }

    // --------------------------------
    // 6. Generate embedding
    // --------------------------------

    const queryEmbedding =
      await generateEmbedding(
        cleanQuestion
      );

    console.log(
      "Voice RAG embedding dimensions:",
      queryEmbedding.length
    );

    // --------------------------------
    // 7. Search knowledge base
    // --------------------------------

    const {
      data: knowledgeResults,
      error: searchError,
    } = await adminSupabase.rpc(
      "match_knowledge_chunks",
      {
        query_embedding:
          queryEmbedding,

        match_threshold: 0.3,

        match_count: 5,

        match_grade:
          student.grade,

        match_subject:
          student.subject ?? null,
      }
    );

    if (searchError) {
      console.error(
        "Voice knowledge search error:",
        searchError
      );
    }

    const results =
      knowledgeResults ?? [];

    // --------------------------------
    // 8. Evaluate RAG results
    // --------------------------------

    const evaluatedResults =
      results.map(
        (result: {
          content: string;
          metadata: Record<
            string,
            unknown
          >;
          similarity: number;
        }) => {
          const evaluation =
            evaluateRetrieval(
              result.similarity
            );

          return {
            ...result,
            evaluation,
          };
        }
      );

    // --------------------------------
    // 9. Only use HIGH relevance
    // --------------------------------

    const relevantResults =
      evaluatedResults.filter(
        (result: {
          evaluation: {
            relevance: string;
          };
        }) =>
          result.evaluation
            .relevance === "high"
      );

    // --------------------------------
    // 10. Build knowledge context
    // --------------------------------

    const knowledgeContext =
      relevantResults.length > 0
        ? relevantResults
            .map(
              (
                result: {
                  content: string;
                  metadata: Record<
                    string,
                    unknown
                  >;
                  similarity: number;
                  evaluation: {
                    score: number;
                    relevance:
                      | "high"
                      | "medium"
                      | "low";
                  };
                },
                index: number
              ) => `
Knowledge ${index + 1}:
${result.content}

Metadata:
${JSON.stringify(
  result.metadata
)}

Similarity:
${result.similarity}

Relevance:
${result.evaluation.relevance}
`
            )
            .join("\n")
        : "No relevant knowledge was found.";

    // --------------------------------
    // 11. Build learning memory
    // --------------------------------

    const learningMemoryContext =
      learningMemories &&
      learningMemories.length > 0
        ? learningMemories
            .map(
              (memory, index) => `
Learning Memory ${index + 1}:
Topic: ${memory.topic}
Subject: ${
                memory.subject ??
                "Unknown"
              }
Grade: ${
                memory.grade ??
                student.grade
              }
Mastery Level: ${
                memory.mastery_level
              }
Notes: ${
                memory.notes ??
                "No notes"
              }
`
            )
            .join("\n")
        : "No previous learning memory available.";

    // --------------------------------
    // 12. Build voice context
    // --------------------------------

    const voiceContext = `
Student Profile:
Name: ${student.name}
Grade: ${student.grade}
Subject: ${student.subject ?? "Unknown"}

Retrieved Educational Knowledge:
${knowledgeContext}

Long-Term Learning Memory:
${learningMemoryContext}
`;

    console.log(
      "Voice context created:",
      {
        question: cleanQuestion,
        grade: student.grade,
        subject:
          student.subject ?? null,
        ragResults:
          relevantResults.length,
        learningMemories:
          learningMemories?.length ?? 0,
      }
    );

    // --------------------------------
    // 13. Return context
    // --------------------------------

    return new Response(
      JSON.stringify({
        success: true,

        question: cleanQuestion,

        context: voiceContext,

        student: {
          name: student.name,
          grade: student.grade,
          subject:
            student.subject ?? null,
        },

        rag: {
          usedKnowledge:
            relevantResults.length > 0,

          resultCount:
            results.length,

          highRelevanceCount:
            relevantResults.length,

          topSimilarity:
            evaluatedResults[0]
              ?.similarity ?? null,
        },

        learningMemory: {
          count:
            learningMemories?.length ??
            0,
        },
      }),
      {
        status: 200,

        headers: {
          "Content-Type":
            "application/json",
        },
      }
    );
  } catch (error) {
    console.error(
      "Voice context error:",
      error
    );

    return new Response(
      JSON.stringify({
        error:
          error instanceof Error
            ? error.message
            : "Failed to create voice context",
      }),
      {
        status: 500,
        headers: {
          "Content-Type":
            "application/json",
        },
      }
    );
  }
}