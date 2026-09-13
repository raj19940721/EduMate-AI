import { ai } from "@/lib/gemini";
import { generateEmbedding } from "@/lib/embeddings";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { supabase as adminSupabase } from "@/lib/supabase";
import { evaluateRetrieval } from "@/lib/rag-evaluation";
import { checkGuardrails } from "@/lib/guardrails";
import { generateMockResponse } from "@/lib/mock-ai";

export async function POST(request: Request) {
  try {
    const body = await request.json();

    const messages = body.messages;
    const student = body.student;
    const conversationId = body.conversationId;

    // --------------------------------
    // Validate student
    // --------------------------------
    if (
      !student ||
      typeof student.name !== "string" ||
      typeof student.grade !== "number"
    ) {
      return new Response(
        JSON.stringify({
          error: "Valid student profile is required",
        }),
        {
          status: 400,
          headers: {
            "Content-Type": "application/json",
          },
        },
      );
    }

    // --------------------------------
    // Validate messages
    // --------------------------------
    if (!Array.isArray(messages) || messages.length === 0) {
      return new Response(
        JSON.stringify({
          error: "Messages are required",
        }),
        {
          status: 400,
          headers: {
            "Content-Type": "application/json",
          },
        },
      );
    }

    // --------------------------------
    // Validate conversation
    // --------------------------------
    if (!conversationId) {
      return new Response(
        JSON.stringify({
          error: "Conversation ID is required",
        }),
        {
          status: 400,
          headers: {
            "Content-Type": "application/json",
          },
        },
      );
    }

    // --------------------------------
    // Create authenticated Supabase client
    // --------------------------------
    const supabase = await createSupabaseServerClient();

    // --------------------------------
    // Get authenticated user
    // --------------------------------
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
        },
      );
    }

    // --------------------------------
    // Get latest message
    // --------------------------------
    const latestMessage = messages[messages.length - 1];

    const guardrailResult = checkGuardrails(
  latestMessage.content,
);

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
    },
  );
}

    if (latestMessage?.role !== "user") {
      return new Response(
        JSON.stringify({
          error: "Latest message must be from user",
        }),
        {
          status: 400,
          headers: {
            "Content-Type": "application/json",
          },
        },
      );
    }

    // --------------------------------
    // Save user message
    // --------------------------------
    const { error: messageError } = await supabase.from("messages").insert({
      conversation_id: conversationId,
      user_id: user.id,
      role: "user",
      content: latestMessage.content,
    });

    if (messageError) {
      console.error("Failed to save user message:", messageError);

      return new Response(
        JSON.stringify({
          error: "Failed to save user message",
        }),
        {
          status: 500,
          headers: {
            "Content-Type": "application/json",
          },
        },
      );
    }

    // --------------------------------
    // Generate conversation title
    // --------------------------------
    if (messages.length === 1) {
      const title = latestMessage.content.trim().slice(0, 50) || "New Chat";

      const { error: titleError } = await supabase
        .from("conversations")
        .update({
          title,
        })
        .eq("id", conversationId)
        .eq("user_id", user.id);

      if (titleError) {
        console.error("Failed to update conversation title:", titleError);
      }
    }

    // --------------------------------
    // Generate embedding for question
    // --------------------------------
    const queryEmbedding = await generateEmbedding(latestMessage.content);

    console.log("RAG query embedding dimensions:", queryEmbedding.length);

    // --------------------------------
    // RAG filters
    // --------------------------------
    console.log("RAG filters:", {
      grade: student.grade,
      subject: student.subject ?? null,
    });

    console.log("RAG question:", latestMessage.content);

    // --------------------------------
    // Search knowledge base
    // --------------------------------
    const { data: knowledgeResults, error: searchError } =
      await adminSupabase.rpc("match_knowledge_chunks", {
        query_embedding: queryEmbedding,
        match_threshold: 0.3,
        match_count: 5,
        match_grade: student.grade,
        match_subject: student.subject ?? null,
      });

    // IMPORTANT DEBUG LOGS
    console.log("RAG RPC error:", searchError);

    console.log("RAG RPC data:", knowledgeResults);

    if (searchError) {
      console.error("Knowledge search error:", searchError);
    }

    const results = knowledgeResults ?? [];

    console.log("RAG results:", results.length);

    const evaluatedResults = results.map(
      (result: {
        content: string;
        metadata: Record<string, unknown>;
        similarity: number;
      }) => {
        const evaluation = evaluateRetrieval(result.similarity);

        return {
          ...result,
          evaluation,
        };
      },
    );

    console.log(
      "RAG evaluation:",
      evaluatedResults.map((result: any) => ({
        similarity: result.similarity,
        relevance: result.evaluation.relevance,
      })),
    );

    const relevantResults = evaluatedResults.filter(
  (result: { evaluation: { relevance: string } }) =>
    result.evaluation.relevance === "high" ||
    result.evaluation.relevance === "medium",
);

console.log(
  "Usable RAG results:",
  relevantResults.length,
);

    // --------------------------------
// Save RAG evaluation
// --------------------------------
const topResult = evaluatedResults[0];

const { error: evaluationError } =
  await adminSupabase
    .from("rag_evaluations")
    .insert({
      user_id: user.id,
      conversation_id: conversationId,
      question: latestMessage.content,
      grade: student.grade,
      subject: student.subject ?? null,
      result_count: results.length,
      top_similarity:
        topResult?.similarity ?? null,
      relevance:
        topResult?.evaluation.relevance ?? null,
    });

if (evaluationError) {
  console.error(
    "Failed to save RAG evaluation:",
    evaluationError,
  );
}
    // --------------------------------
    // Build retrieved context
    // --------------------------------
    const knowledgeContext =
  relevantResults.length > 0
    ? relevantResults
        .map(
          (
            result: {
              content: string;
              metadata: Record<string, unknown>;
              similarity: number;
              evaluation: {
                score: number;
                relevance: "high" | "medium" | "low";
              };
            },
            index: number,
          ) => {
            return `
Knowledge ${index + 1}:
${result.content}

Metadata:
${JSON.stringify(result.metadata)}

Similarity:
${result.similarity}

Relevance:
${result.evaluation.relevance}
`;
          },
        )
        .join("\n")
    : "No relevant knowledge was found.";
    // --------------------------------
    // Build conversation
    // --------------------------------
    const conversation = messages
      .map((message: { role: string; content: string }) => {
        const speaker = message.role === "user" ? "Student" : "EduMate";

        return `${speaker}: ${message.content}`;
      })
      .join("\n\n");

    // --------------------------------
    // Build RAG prompt
    // --------------------------------
    const prompt = `
You are EduMate, a friendly AI tutor.

Student Profile:
Name: ${student.name}
Grade: ${student.grade}

Rules:
- Explain in simple language.
- Be friendly and encouraging.
- Give age-appropriate explanations.
- Give examples when helpful.
- Keep answers concise.
- Maintain context from the conversation.
- If the student asks a follow-up question, use previous conversation to understand what they mean.
- Use the provided educational knowledge when it is relevant.
- Do not invent facts that contradict the provided knowledge.
- If the provided knowledge does not contain the answer, use your general knowledge and clearly explain the answer.
- Never mention "RAG", "vector search", "embeddings", or internal systems to the student.
- Retrieved knowledge may have different confidence levels.
- Use high-relevance knowledge confidently.
- Use medium-relevance knowledge cautiously and do not present uncertain information as a confirmed fact.
- Ignore low-relevance knowledge.
- If retrieved knowledge is insufficient, use general knowledge and clearly explain uncertainty when appropriate.

Retrieved Educational Knowledge:

${knowledgeContext}

Conversation:

${conversation}

Respond as EduMate.
`;

    console.log("Retrieved knowledge:", knowledgeContext);

    if (process.env.MOCK_AI === "true") {
  const mockResponse = generateMockResponse(
    latestMessage.content,
    knowledgeContext,
  );

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    start(controller) {
      controller.enqueue(
        encoder.encode(mockResponse),
      );

      controller.close();
    },
  });

  // Save assistant message
  const { error: mockSaveError } =
    await adminSupabase
      .from("messages")
      .insert({
        conversation_id: conversationId,
        user_id: user.id,
        role: "assistant",
        content: mockResponse,
      });

  if (mockSaveError) {
    console.error(
      "Failed to save mock assistant message:",
      mockSaveError,
    );
  }

  await adminSupabase
    .from("conversations")
    .update({
      updated_at: new Date().toISOString(),
    })
    .eq("id", conversationId)
    .eq("user_id", user.id);

  return new Response(stream, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Transfer-Encoding": "chunked",
    },
  });
}

    // --------------------------------
    // Generate Gemini streaming response
    // --------------------------------
    const stream = await ai.models.generateContentStream({
      model: "gemini-3.6-flash",
      contents: prompt,
    });

    // --------------------------------
    // Stream + save assistant response
    // --------------------------------
    const readableStream = new ReadableStream({
      async start(controller) {
        let assistantResponse = "";

        try {
          for await (const chunk of stream) {
            const text = chunk.text;

            if (text) {
              assistantResponse += text;

              controller.enqueue(new TextEncoder().encode(text));
            }
          }

          // --------------------------------
          // Save assistant message
          // --------------------------------
          if (assistantResponse) {
            const { error: assistantError } = await supabase
              .from("messages")
              .insert({
                conversation_id: conversationId,
                user_id: user.id,
                role: "assistant",
                content: assistantResponse,
              });

            if (assistantError) {
              console.error(
                "Failed to save assistant message:",
                assistantError,
              );
            }
          }

          // --------------------------------
          // Update conversation timestamp
          // --------------------------------
          const { error: conversationError } = await supabase
            .from("conversations")
            .update({
              updated_at: new Date().toISOString(),
            })
            .eq("id", conversationId)
            .eq("user_id", user.id);

          if (conversationError) {
            console.error("Failed to update conversation:", conversationError);
          }

          controller.close();
        } catch (error) {
          console.error("Streaming error:", error);

          controller.error(error);
        }
      },
    });

    return new Response(readableStream, {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Cache-Control": "no-cache",
      },
    });
  } catch (error) {
    console.error("Gemini API error:", error);

    // --------------------------------
    // Handle Gemini quota errors
    // --------------------------------
    if (
      error &&
      typeof error === "object" &&
      "status" in error &&
      error.status === 429
    ) {
      return new Response(
        JSON.stringify({
          error:
            "EduMate is temporarily unavailable because the AI usage limit has been reached. Please try again later.",
        }),
        {
          status: 429,
          headers: {
            "Content-Type": "application/json",
          },
        },
      );
    }

    // --------------------------------
    // Handle other errors
    // --------------------------------
    return new Response(
      JSON.stringify({
        error:
          error instanceof Error
            ? error.message
            : "Failed to get response from EduMate",
      }),
      {
        status: 500,
        headers: {
          "Content-Type": "application/json",
        },
      },
    );
  }
}
