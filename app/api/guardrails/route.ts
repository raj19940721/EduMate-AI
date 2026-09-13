import { NextResponse } from "next/server";
import { checkGuardrails } from "@/lib/guardrails";

export async function POST(request: Request) {
  try {
    const body = await request.json();

    const question = body.question;

    const result = checkGuardrails(question);

    return NextResponse.json(result);
  } catch {
    return NextResponse.json(
      {
        allowed: false,
        message: "Invalid request.",
      },
      { status: 400 },
    );
  }
}