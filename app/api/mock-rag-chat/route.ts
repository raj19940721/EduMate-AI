import { NextResponse } from "next/server";
import { supabase as adminSupabase } from "@/lib/supabase";
import { generateEmbedding } from "@/lib/embeddings";
import { evaluateRetrieval } from "@/lib/rag-evaluation";
import { checkGuardrails } from "@/lib/guardrails";
import { generateMockResponse } from "@/lib/mock-ai";
import { logRagObservability } from "@/lib/observability";

export async function POST(request: Request) {
  try {
    // 1. Read request
    const body = await request.json();

    const question = body.question;
    const grade = body.grade;
    const subject = body.subject;

    // Start measuring total request time
    const requestStart = Date.now();

    // 2. Validate question
    if (typeof question !== "string" || !question.trim()) {
      return NextResponse.json(
        {
          error: "Question is required",
        },
        {
          status: 400,
        },
      );
    }

    // 3. Guardrails
    const guardrailResult = checkGuardrails(question);

    if (!guardrailResult.allowed) {
      return NextResponse.json(
        {
          error: guardrailResult.message ?? "Question blocked by guardrails.",
        },
        {
          status: 400,
        },
      );
    }

    // 4. Generate query embedding
    const embeddingStart = Date.now();

    const queryEmbedding = await generateEmbedding(question);

    const embeddingTimeMs = Date.now() - embeddingStart;

    console.log("Mock RAG embedding dimensions:", queryEmbedding.length);

    // 5. Vector search with metadata filters
    const retrievalStart = Date.now();

    const { data: results, error } = await adminSupabase.rpc(
      "match_knowledge_chunks",
      {
        query_embedding: queryEmbedding,
        match_threshold: 0.3,
        match_count: 5,
        match_grade: typeof grade === "number" ? grade : null,
        match_subject:
          typeof subject === "string" && subject.trim() ? subject : null,
      },
    );

    const retrievalTimeMs = Date.now() - retrievalStart;

    if (error) {
      console.error("Mock RAG RPC error:", error);

      return NextResponse.json(
        {
          error: "Failed to search knowledge.",
        },
        {
          status: 500,
        },
      );
    }

    console.log("Mock RAG results:", results?.length ?? 0);

    // 6. Evaluate retrieval results
    const evaluatedResults = (results ?? []).map((result: any) => ({
      ...result,
      evaluation: evaluateRetrieval(result.similarity),
    }));

    console.log(
      "Mock RAG evaluation:",
      evaluatedResults.map((result: any) => ({
        similarity: result.similarity,
        relevance: result.evaluation.relevance,
      })),
    );

    // 7. Accept HIGH + MEDIUM results
    // 7. Accept only HIGH-confidence results for answering
    const relevantResults = evaluatedResults.filter(
      (result: any) => result.evaluation.relevance === "high",
    );

    console.log("Mock RAG usable results:", relevantResults.length);

    // 8. Build knowledge context
    const knowledgeContext =
      relevantResults.length > 0
        ? relevantResults
            .map(
              (result: any, index: number) => `
Knowledge ${index + 1}:
${result.content}

Metadata:
${JSON.stringify(result.metadata)}

Similarity:
${result.similarity}

Relevance:
${result.evaluation.relevance}
`,
            )
            .join("\n")
        : "No relevant knowledge was found.";

    // 9. Generate local mock answer
    const response = generateMockResponse(question, knowledgeContext);

    // 10. Observability
    const totalTimeMs = Date.now() - requestStart;

    const topResult = evaluatedResults[0];

    await logRagObservability({
      question,

      grade: typeof grade === "number" ? grade : null,

      subject: typeof subject === "string" ? subject : null,

      guardrailAllowed: true,

      embeddingTimeMs,
      retrievalTimeMs,
      totalTimeMs,

      resultCount: evaluatedResults.length,

      usableResultCount: relevantResults.length,

      topSimilarity: topResult?.similarity ?? null,

      topRelevance: topResult?.evaluation.relevance ?? null,

      aiMode: "mock",
    });

    // 11. Return response
    return NextResponse.json({
      response,

      rag: {
        resultCount: evaluatedResults.length,

        usableResultCount: relevantResults.length,

        results: evaluatedResults,
      },
    });
  } catch (error) {
    console.error("Mock RAG chat error:", error);

    return NextResponse.json(
      {
        error: "Failed to process mock RAG chat.",
      },
      {
        status: 500,
      },
    );
  }
}
