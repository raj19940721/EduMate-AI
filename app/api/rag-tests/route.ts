import { NextResponse } from "next/server";
import { supabase as adminSupabase } from "@/lib/supabase";
import { generateEmbedding } from "@/lib/embeddings";
import { evaluateRetrieval } from "@/lib/rag-evaluation";
import { ragTestCases } from "@/lib/rag-tests";

export async function POST() {
  try {
    const results = [];

    for (const testCase of ragTestCases) {
      console.log(
        `Running RAG test: ${testCase.id}`,
      );

      // 1. Generate embedding
      const queryEmbedding =
        await generateEmbedding(
          testCase.question,
        );

      // 2. Search knowledge base
      const { data, error } =
        await adminSupabase.rpc(
          "match_knowledge_chunks",
          {
            query_embedding: queryEmbedding,
            match_threshold: 0.3,
            match_count: 5,
            match_grade:
              testCase.grade,
            match_subject:
              testCase.subject,
          },
        );

      if (error) {
        console.error(
          `RAG test failed: ${testCase.id}`,
          error,
        );

        results.push({
          ...testCase,
          passed: false,
          error:
            "Knowledge search failed.",
        });

        continue;
      }

      const evaluatedResults = (
        data ?? []
      ).map((result: any) => ({
        ...result,
        evaluation:
          evaluateRetrieval(
            result.similarity,
          ),
      }));

      const topResult =
        evaluatedResults[0];

      const actualRelevance =
        topResult?.evaluation
          .relevance ?? "low";

      const hasUsableResult =
  evaluatedResults.some(
    (result: any) =>
      result.evaluation.relevance ===
        "high" ||
      result.evaluation.relevance ===
        "medium",
  );

      // 3. Compare actual vs expected
      const relevanceMatches =
        actualRelevance ===
        testCase.expectedRelevance;

      const resultMatches =
        hasUsableResult ===
        testCase.expectedResult;

      const passed =
        relevanceMatches &&
        resultMatches;

      results.push({
        id: testCase.id,
        question: testCase.question,
        grade: testCase.grade,
        subject: testCase.subject,

        expectedRelevance:
          testCase.expectedRelevance,

        actualRelevance,

        expectedResult:
          testCase.expectedResult,

        actualResult:
          hasUsableResult,

        similarity:
          topResult?.similarity ??
          null,

        resultCount:
          evaluatedResults.length,

        passed,
      });
    }

    // 4. Calculate summary
    const totalTests =
      results.length;

    const passedTests =
      results.filter(
        (result) => result.passed,
      ).length;

    const failedTests =
      totalTests - passedTests;

    const passRate =
      totalTests > 0
        ? (passedTests /
            totalTests) *
          100
        : 0;

    return NextResponse.json({
      summary: {
        totalTests,
        passedTests,
        failedTests,
        passRate,
      },

      results,
    });
  } catch (error) {
    console.error(
      "RAG test runner error:",
      error,
    );

    return NextResponse.json(
      {
        error:
          "Failed to run RAG tests.",
      },
      {
        status: 500,
      },
    );
  }
}