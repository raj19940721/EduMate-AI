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
    // 2. Read uploaded PDF
    // --------------------------------
    const formData = await request.formData();

    const file = formData.get("pdf");

    if (!(file instanceof File)) {
      return NextResponse.json(
        {
          error: "Please upload a homework PDF.",
        },
        {
          status: 400,
        }
      );
    }

    // --------------------------------
    // 3. Validate file type
    // --------------------------------
    if (file.type !== "application/pdf") {
      return NextResponse.json(
        {
          error: "Only PDF files are supported.",
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
          error:
            "PDF is too large. Please upload a PDF smaller than 10 MB.",
        },
        {
          status: 400,
        }
      );
    }

    // --------------------------------
    // 5. Guardrails
    // --------------------------------
    const guardrailResult = checkGuardrails(
      "Read and extract the homework questions from this uploaded PDF."
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
    // 6. Convert PDF to Base64
    // --------------------------------
    const arrayBuffer = await file.arrayBuffer();

    const base64Pdf = Buffer.from(arrayBuffer).toString(
      "base64"
    );

    // --------------------------------
    // 7. Ask Gemini to read PDF
    // --------------------------------
    const prompt = `
You are EduMate, an AI personal homework tutor.

Carefully read the uploaded PDF.

Your job is to identify the homework question or questions
contained in the PDF.

IMPORTANT:
- Read the PDF carefully.
- Preserve the meaning of the original questions.
- Do NOT solve the questions yet.
- Do NOT invent missing text.
- If the PDF is unclear or unreadable, say so.
- If there are multiple questions, list each question separately.
- Ignore decorative text that is not part of the homework.
- Identify the likely subject when possible.
- Keep each question complete enough for a student to understand it.

Return JSON only.

Return exactly this structure:

{
  "subject": "Science",
  "questions": [
    "Question 1",
    "Question 2"
  ],
  "pdfClear": true,
  "message": "Short message about what was detected"
}
`;

    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash-lite",
      contents: [
        {
          inlineData: {
            mimeType: "application/pdf",
            data: base64Pdf,
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
            pdfClear: {
              type: "boolean",
            },
            message: {
              type: "string",
            },
          },
          required: [
            "subject",
            "questions",
            "pdfClear",
            "message",
          ],
        },
      },
    });

    // --------------------------------
    // 8. Parse response
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
    // 9. Validate response
    // --------------------------------
    if (
      !Array.isArray(result.questions) ||
      typeof result.pdfClear !== "boolean"
    ) {
      return NextResponse.json(
        {
          error:
            "AI returned an invalid PDF extraction response.",
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
        pdfClear: result.pdfClear,
        message: result.message ?? "",
      },
    });
  } catch (error) {
    console.error("Homework PDF API error:", error);

    return NextResponse.json(
      {
        error: "Failed to read the homework PDF.",
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