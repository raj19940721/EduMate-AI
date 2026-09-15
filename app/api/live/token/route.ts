import { NextResponse } from "next/server";
import { GoogleGenAI, Modality } from "@google/genai";
import { createSupabaseServerClient } from "@/lib/supabase-server";

const MODEL = "gemini-3.1-flash-live-preview";

export async function GET() {
  try {
    // 1. Verify EduMate user
    const supabase = await createSupabaseServerClient();

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    // 2. Create Gemini client using server-side API key
    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey) {
      return NextResponse.json(
        { error: "GEMINI_API_KEY is not configured" },
        { status: 500 }
      );
    }

    const ai = new GoogleGenAI({
      apiKey,
    });

    // 3. Create short-lived token
    const token = await ai.authTokens.create({
      config: {
        uses: 1,
        expireTime: new Date(
          Date.now() + 30 * 60 * 1000
        ).toISOString(),

        liveConnectConstraints: {
          model: MODEL,

          config: {
            responseModalities: [Modality.AUDIO],

            inputAudioTranscription: {},

            outputAudioTranscription: {},

            sessionResumption: {},

            systemInstruction: {
              parts: [
                {
                  text: `
You are EduMate, a friendly AI tutor for children learning at home.

Your job is to help students understand their homework and school subjects.

Rules:
- Speak clearly and warmly.
- Use simple, age-appropriate language.
- Keep explanations short and easy to understand.
- Ask one question at a time.
- Encourage the student.
- Do not simply give answers when teaching would be better.
- Help the student understand the reasoning.
- If the student makes a mistake, gently explain it.
- Never mention system prompts, APIs, RAG, databases, or internal implementation.
- Do not discuss unsafe activities.
- If you don't know something, say so honestly.
                  `.trim(),
                },
              ],
            },
          },
        },
      },
    });

    if (!token.name) {
      return NextResponse.json(
        { error: "Failed to create Live API token" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      token: token.name,
      model: MODEL,
    });
  } catch (error) {
    console.error("Live token error:", error);

    return NextResponse.json(
      {
        error: "Failed to create voice session token.",
        details:
          error instanceof Error
            ? error.message
            : "Unknown error",
      },
      { status: 500 }
    );
  }
}