import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { supabase } from "@/lib/supabase";

const SUPPORTED_LANGUAGES = ["en", "te", "hi"] as const;

type SupportedLanguage = (typeof SUPPORTED_LANGUAGES)[number];

export async function PATCH(request: Request) {
  try {
    const authClient = await createSupabaseServerClient();

    const {
      data: { user },
      error: authError,
    } = await authClient.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const language = body?.language as SupportedLanguage;

    if (!SUPPORTED_LANGUAGES.includes(language)) {
      return NextResponse.json(
        {
          error: "Unsupported language",
          supportedLanguages: SUPPORTED_LANGUAGES,
        },
        { status: 400 },
      );
    }

    const { data: student, error: updateError } = await supabase
      .from("students")
      .update({
        preferred_language: language,
      })
      .eq("user_id", user.id)
      .select("id, name, grade, age, preferred_language")
      .single();

    if (updateError) {
      console.error("Update student language error:", updateError);

      return NextResponse.json(
        { error: "Failed to update language" },
        { status: 500 },
      );
    }

    return NextResponse.json({
      success: true,
      student,
    });
  } catch (error) {
    console.error("Student language API error:", error);

    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
