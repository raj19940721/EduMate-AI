import { NextResponse } from "next/server";
import { ai } from "@/lib/gemini";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { checkGuardrails } from "@/lib/guardrails";

export async function POST(request: Request) {
  try {
    // --------------------------------
    // 1. Authentication
    // --------------------------------
    const supabase = await createSupabaseServerClient();

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        {
          error: "Unauthorized",
        },
        {
          status: 401,
        }
      );
    }

    // --------------------------------
    // 2. Read uploaded file
    // --------------------------------
    const formData = await request.formData();

    const file = formData.get("image");

    if (!(file instanceof File)) {
      return NextResponse.json(
        {
          error: "Please upload a homework image.",
        },
        {
          status: 400,
        }
      );
    }

    // --------------------------------
    // 3. Validate file type
    // --------------------------------
    if (!file.type.startsWith("image/")) {
      return NextResponse.json(
        {
          error: "Only image files are supported.",
        },
        {
          status: 400,
        }
      );
    }

    // --------------------------------
    // 4. Validate file size
    // --------------------------------
    const maxSize = 10 * 1024 * 1024;

    if (file.size > maxSize) {
      return NextResponse.json(
        {
          error: "Image is too large. Please upload an image smaller than 10 MB.",
        },
        {
          status: 400,
        }
      );
    }

    // --------------------------------
    // 5. Convert image to Base64
    // --------------------------------
    const arrayBuffer = await file.arrayBuffer();

    const base64Image = Buffer.from(arrayBuffer).toString("base64");

    // --------------------------------
    // 6. Guardrails
    // --------------------------------
    const guardrailResult = checkGuardrails(
      "Read and extract the homework question from this uploaded image."
    );

    if (!guardrailResult.allowed) {
      return NextResponse.json(
        {
          success: false,
          blocked: true,
          message:
            guardrailResult.message ??
            "I can't help with that request.",
        },
        {
          status: 400,
        }
      );
    }

    // --------------------------------
    // 7. Ask Gemini to read the image
    // --------------------------------
    const prompt = `
You are EduMate, an AI personal homework tutor.

Look carefully at the uploaded homework image.

Your job is to identify the homework question or questions visible in the image.

IMPORTANT:
- Read the image carefully.
- Preserve the meaning of the original question.
- Do not solve the homework yet.
- Do not invent missing text.
- If the image is unclear, say that the image is unclear.
- If there are multiple questions, list each question separately.
- Ignore decorative text that is not part of the homework.
- Identify the likely subject when possible.

Return JSON only.

Return exactly this structure:

{
  "subject": "Science",
  "questions": [
    "Question 1"
  ],
  "imageClear": true,
  "message": "Short message about what was detected"
}
`;

    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash-lite",
      contents: [
        {
          inlineData: {
            mimeType: file.type,
            data: base64Image,
          },
        },
        {
          text: prompt,
        },
      ],
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: "object",
          properties: {
            subject: {
              type: "string",
            },
            questions: {
              type: "array",
              items: {
                type: "string",
              },
            },
            imageClear: {
              type: "boolean",
            },
            message: {
              type: "string",
            },
          },
          required: [
            "subject",
            "questions",
            "imageClear",
            "message",
          ],
        },
      },
    });

    // --------------------------------
    // 8. Parse Gemini response
    // --------------------------------
    const text = response.text?.trim();

    if (!text) {
      return NextResponse.json(
        {
          error: "Gemini did not return a response.",
        },
        {
          status: 500,
        }
      );
    }

    const result = JSON.parse(text);

    // --------------------------------
    // 9. Validate result
    // --------------------------------
    if (
      !Array.isArray(result.questions) ||
      typeof result.imageClear !== "boolean"
    ) {
      return NextResponse.json(
        {
          error: "AI returned an invalid image extraction response.",
        },
        {
          status: 500,
        }
      );
    }

    return NextResponse.json({
      success: true,
      homework: {
        subject: result.subject ?? "Unknown",
        questions: result.questions,
        imageClear: result.imageClear,
        message: result.message ?? "",
      },
    });
  } catch (error) {
    console.error("Homework image API error:", error);

    return NextResponse.json(
      {
        error: "Failed to read the homework image.",
        details:
          error instanceof Error
            ? error.message
            : "Unknown error",
      },
      {
        status: 500,
      }
    );
  }
}