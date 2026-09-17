import { ai } from "@/lib/gemini";
import { generateEmbedding } from "@/lib/embeddings";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { supabase as adminSupabase } from "@/lib/supabase";
import { evaluateRetrieval } from "@/lib/rag-evaluation";
import { checkGuardrails } from "@/lib/guardrails";
import { generateMockResponse } from "@/lib/mock-ai";
import { extractLearningTopic } from "@/lib/learning-topic";
import { saveLearningMemory } from "@/lib/learning-memory";

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
    // Verify conversation belongs to current user
    // --------------------------------
    const {
      data: conversationOwner,
      error: conversationOwnerError,
    } = await supabase
      .from("conversations")
      .select("id")
      .eq("id", conversationId)
      .eq("user_id", user.id)
      .maybeSingle();

    if (conversationOwnerError) {
      console.error(
        "Failed to verify conversation ownership:",
        conversationOwnerError,
      );

      return new Response(
        JSON.stringify({
          error: "Failed to verify conversation.",
        }),
        {
          status: 500,
          headers: {
            "Content-Type": "application/json",
          },
        },
      );
    }

    if (!conversationOwner) {
      return new Response(
        JSON.stringify({
          error: "Conversation not found.",
        }),
        {
          status: 404,
          headers: {
            "Content-Type": "application/json",
          },
        },
      );
    }

    // --------------------------------
    // Get student's long-term learning memory
    // --------------------------------
    const { data: learningMemories, error: learningMemoryError } =
      await adminSupabase
        .from("student_learning_memory")
        .select("topic, subject, grade, mastery_level, notes, updated_at")
        .eq("user_id", user.id)
        .order("updated_at", {
          ascending: false,
        })
        .limit(20);

    if (learningMemoryError) {
      console.error("Failed to load learning memory:", learningMemoryError);
    }

    console.log("Student learning memories:", learningMemories);
    // --------------------------------
    // Get latest message
    // --------------------------------
    const latestMessage = messages[messages.length - 1];

    const guardrailResult = checkGuardrails(latestMessage.content);

    if (!guardrailResult.allowed) {
      return new Response(
        JSON.stringify({
          error:
            guardrailResult.message ?? "This question cannot be processed.",
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
    // Get conversation history
    // --------------------------------
    const { data: conversationHistory, error: historyError } = await supabase
      .from("messages")
      .select("role, content, created_at")
      .eq("conversation_id", conversationId)
      .eq("user_id", user.id)
      .order("created_at", { ascending: true })
      .limit(20);

    if (historyError) {
      console.error("Failed to load conversation history:", historyError);
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
    // Build context-aware RAG question
    // --------------------------------
    const previousUserMessages = (conversationHistory ?? []).filter(
      (message) => message.role === "user",
    );

    const previousUserQuestion =
      previousUserMessages.length > 0
        ? previousUserMessages[previousUserMessages.length - 1].content
        : null;

    const ragQuestion = previousUserQuestion
      ? `Previous question: ${previousUserQuestion}

Current question: ${latestMessage.content}`
      : latestMessage.content;

    console.log("RAG search question:", ragQuestion);

    // --------------------------------
    // Generate embedding for RAG question
    // --------------------------------
    const queryEmbedding = await generateEmbedding(ragQuestion);

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

    console.log("RAG RPC error:", searchError);
    console.log("RAG RPC data:", knowledgeResults);

    if (searchError) {
      console.error("Knowledge search error:", searchError);
    }

    const results = knowledgeResults ?? [];

    console.log("RAG results:", results.length);

    // --------------------------------
    // Evaluate RAG results
    // --------------------------------
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

    // --------------------------------
    // Only use high relevance results
    // --------------------------------
    const relevantResults = evaluatedResults.filter(
      (result: {
        evaluation: {
          relevance: string;
        };
      }) => result.evaluation.relevance === "high",
    );

    console.log("Usable RAG results:", relevantResults.length);

    // --------------------------------
    // Save RAG evaluation
    // --------------------------------
    const topResult = evaluatedResults[0];

    const { error: evaluationError } = await adminSupabase
      .from("rag_evaluations")
      .insert({
        user_id: user.id,
        conversation_id: conversationId,
        question: latestMessage.content,
        grade: student.grade,
        subject: student.subject ?? null,
        result_count: results.length,
        top_similarity: topResult?.similarity ?? null,
        relevance: topResult?.evaluation.relevance ?? null,
      });

    if (evaluationError) {
      console.error("Failed to save RAG evaluation:", evaluationError);
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
    const conversation = (conversationHistory ?? [])
      .map((message) => {
        const speaker = message.role === "user" ? "Student" : "EduMate";

        return `${speaker}: ${message.content}`;
      })
      .join("\n\n");

    console.log("Conversation history:", conversation);

    console.log("Retrieved knowledge:", knowledgeContext);

    // --------------------------------
    // Build long-term learning memory
    // --------------------------------
    const learningMemoryContext =
      learningMemories && learningMemories.length > 0
        ? learningMemories
            .map(
              (memory, index) => `
Learning Memory ${index + 1}:
Topic: ${memory.topic}
Subject: ${memory.subject ?? "Unknown"}
Grade: ${memory.grade ?? student.grade}
Mastery Level: ${memory.mastery_level}
Notes: ${memory.notes ?? "No notes"}
`,
            )
            .join("\n")
        : "No previous learning memory available.";

    console.log("Learning memory context:", learningMemoryContext);

    // --------------------------------
    // Build RAG prompt
    // --------------------------------
    const prompt = `
You are EduMate, a friendly AI tutor.

Student Profile:
Name: ${student.name}
Grade: ${student.grade}

Rules:
- Always answer the student's current question directly.
- Never respond with only a greeting when the student has asked a question.
- A greeting must never replace an answer.
- If the student asks an educational question, answer the question directly first.
- Do not introduce yourself as EduMate unless the student explicitly asks who you are.
- Do not say "Hello", "Hi", or "Welcome" instead of answering the question.
- Be friendly, encouraging, and natural.
- Explain in simple, age-appropriate language.
- Give examples when helpful.
- Keep answers concise and focused on the student's question.
- Maintain context from the conversation.
- If the student asks a follow-up question, use the previous conversation to understand what they mean.
- Answer follow-up questions directly without asking the student to repeat the topic.
- Do not repeatedly ask "What else would you like to know?"
- Do not end every response with a question.
- Use the provided educational knowledge when it is relevant.
- Do not invent facts that contradict the provided knowledge.
- If the provided knowledge does not contain the answer, use general knowledge.
- Never mention RAG, vector search, embeddings, or internal systems.
- Use long-term learning memory when it is relevant to the student's current question.
- Long-term learning memory represents topics the student has previously learned or practiced.
- If the student asks about something they learned before, use the stored learning memory to personalize the response.
- Do not claim the student learned something unless it appears in the provided learning memory or conversation history.
- Do not mention "long-term memory", database, Supabase, or internal memory systems to the student.

Retrieved Educational Knowledge:
${knowledgeContext}

Long-Term Learning Memory:
${learningMemoryContext}

Conversation History:
${conversation || "No previous conversation."}

Current Student Question:
${latestMessage.content}

Respond as EduMate.
Answer the Current Student Question directly.
`;

    console.log("Retrieved knowledge:", knowledgeContext);

    // --------------------------------
    // Mock AI mode
    // --------------------------------
    if (process.env.MOCK_AI === "true") {
      const mockResponse = generateMockResponse(
        latestMessage.content,
        knowledgeContext,
      );

      const encoder = new TextEncoder();

      const stream = new ReadableStream({
        start(controller) {
          controller.enqueue(encoder.encode(mockResponse));

          controller.close();
        },
      });

      // Save assistant message
      const { error: mockSaveError } = await adminSupabase
        .from("messages")
        .insert({
          conversation_id: conversationId,
          user_id: user.id,
          role: "assistant",
          content: mockResponse,
        });

      if (mockSaveError) {
        console.error("Failed to save mock assistant message:", mockSaveError);
      }

      await adminSupabase
        .from("conversations")
        .update({
          updated_at: new Date().toISOString(),
        })
        .eq("id", conversationId)
        .eq("user_id", user.id);

      // --------------------------------
      // Save learning memory in mock mode
      // --------------------------------
      try {
        const learningTopic = await extractLearningTopic(
          latestMessage.content,
          conversation,
        );

        if (learningTopic) {
          await saveLearningMemory({
            userId: user.id,
            topic: learningTopic.topic,
            subject: learningTopic.subject,
            grade: student.grade,
            masteryLevel: learningTopic.masteryLevel,
            notes: learningTopic.notes,
          });

          console.log("Learning memory saved:", learningTopic);
        }
      } catch (memoryError) {
        console.error("Learning memory processing failed:", memoryError);
      }

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
      model: "gemini-3.5-flash-lite",
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

          // --------------------------------
          // Save learning memory
          // --------------------------------
          try {
            const learningTopic = await extractLearningTopic(
              latestMessage.content,
              conversation,
            );

            if (learningTopic) {
              await saveLearningMemory({
                userId: user.id,
                topic: learningTopic.topic,
                subject: learningTopic.subject,
                grade: student.grade,
                masteryLevel: learningTopic.masteryLevel,
                notes: learningTopic.notes,
              });

              console.log("Learning memory saved:", learningTopic);
            }
          } catch (memoryError) {
            console.error("Learning memory processing failed:", memoryError);
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
    // Handle temporary Gemini errors
    // --------------------------------
    if (error && typeof error === "object" && "status" in error) {
      const status = error.status;

      if (status === 429) {
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

      if (status === 503) {
        return new Response(
          JSON.stringify({
            error:
              "EduMate is temporarily unavailable because the AI service is busy. Please try again in a moment.",
          }),
          {
            status: 503,
            headers: {
              "Content-Type": "application/json",
            },
          },
        );
      }
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
