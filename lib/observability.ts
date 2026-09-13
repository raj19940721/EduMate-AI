import { supabase as adminSupabase } from "@/lib/supabase";

export interface RagObservability {
  question: string;
  grade: number | null;
  subject: string | null;

  guardrailAllowed: boolean;

  embeddingTimeMs: number;
  retrievalTimeMs: number;
  totalTimeMs: number;

  resultCount: number;
  usableResultCount: number;

  topSimilarity: number | null;
  topRelevance: "high" | "medium" | "low" | null;

  aiMode: "mock" | "gemini";
}

export async function logRagObservability(
  data: RagObservability,
) {
  // Console logging
  console.log(
    "========== EDU-MATE OBSERVABILITY ==========",
  );

  console.log("Question:", data.question);
  console.log("Grade:", data.grade);
  console.log("Subject:", data.subject);

  console.log(
    "Guardrail allowed:",
    data.guardrailAllowed,
  );

  console.log(
    "Embedding time:",
    `${data.embeddingTimeMs} ms`,
  );

  console.log(
    "Retrieval time:",
    `${data.retrievalTimeMs} ms`,
  );

  console.log(
    "Total time:",
    `${data.totalTimeMs} ms`,
  );

  console.log(
    "RAG results:",
    data.resultCount,
  );

  console.log(
    "Usable results:",
    data.usableResultCount,
  );

  console.log(
    "Top similarity:",
    data.topSimilarity,
  );

  console.log(
    "Top relevance:",
    data.topRelevance,
  );

  console.log(
    "AI mode:",
    data.aiMode,
  );

  console.log(
    "============================================",
  );

  // Save to Supabase
  const { error } =
    await adminSupabase
      .from("observability_logs")
      .insert({
        question: data.question,

        grade: data.grade,

        subject: data.subject,

        guardrail_allowed:
          data.guardrailAllowed,

        embedding_time_ms:
          data.embeddingTimeMs,

        retrieval_time_ms:
          data.retrievalTimeMs,

        total_time_ms:
          data.totalTimeMs,

        result_count:
          data.resultCount,

        usable_result_count:
          data.usableResultCount,

        top_similarity:
          data.topSimilarity,

        top_relevance:
          data.topRelevance,

        ai_mode:
          data.aiMode,
      });

  if (error) {
    console.error(
      "Failed to save observability log:",
      error,
    );
  } else {
    console.log(
      "Observability log saved to Supabase ✅",
    );
  }
}