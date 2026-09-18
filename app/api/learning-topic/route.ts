import { NextResponse } from "next/server";
import { extractLearningTopic } from "@/lib/learning-topic";

export async function POST(request: Request) {
  try {
    const body = await request.json();

    const currentQuestion = body.currentQuestion;
    const conversation = body.conversation ?? "";

    if (typeof currentQuestion !== "string" || !currentQuestion.trim()) {
      return NextResponse.json(
        { error: "Current question is required." },
        { status: 400 },
      );
    }

    const topic = await extractLearningTopic(currentQuestion, conversation);

    return NextResponse.json({
      topic,
    });
  } catch (error) {
    console.error("Learning topic API error:", error);

    return NextResponse.json(
      { error: "Failed to extract learning topic." },
      { status: 500 },
    );
  }
}
