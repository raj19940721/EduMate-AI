import { NextResponse } from "next/server";
import { generateMockResponse } from "@/lib/mock-ai";

export async function POST(request: Request) {
  try {
    const body = await request.json();

    const question = body.question;
    const knowledgeContext =
      body.knowledgeContext ??
      "No relevant knowledge was found.";

    if (
      typeof question !== "string" ||
      !question.trim()
    ) {
      return NextResponse.json(
        {
          error: "Question is required",
        },
        { status: 400 },
      );
    }

    const response = generateMockResponse(
      question,
      knowledgeContext,
    );

    return NextResponse.json({
      response,
    });
  } catch {
    return NextResponse.json(
      {
        error: "Failed to generate mock response.",
      },
      { status: 500 },
    );
  }
}