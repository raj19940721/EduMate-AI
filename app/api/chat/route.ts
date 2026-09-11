import { ai } from "@/lib/gemini";

export async function POST(request: Request) {
  try {
    const body = await request.json();

    const messages = body.messages;
    const student = body.student;

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

    const conversation = messages
      .map((message: { role: string; content: string }) => {
        const speaker = message.role === "user" ? "Student" : "EduMate";

        return `${speaker}: ${message.content}`;
      })
      .join("\n\n");

    const prompt = `
You are EduMate, a friendly AI tutor.

Student Profile:
Name: ${student.name}
Grade: ${student.grade}

Rules:
- Explain in simple language.
- Be friendly and encouraging.
- Give age-appropriate explanations.
- Use examples when helpful.
- Keep answers concise.
- Maintain context from the conversation.
- If the student asks a follow-up question, use previous conversation to understand what they mean.

Conversation:

${conversation}

Respond as EduMate.
`;

    const stream = await ai.models.generateContentStream({
      model: "gemini-3.6-flash",
      contents: prompt,
    });

    const readableStream = new ReadableStream({
      async start(controller) {
        try {
          for await (const chunk of stream) {
            const text = chunk.text;

            if (text) {
              controller.enqueue(new TextEncoder().encode(text));
            }
          }

          controller.close();
        } catch (error) {
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
