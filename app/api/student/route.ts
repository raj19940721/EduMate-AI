import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase-server";

export async function GET() {
  try {
    const supabase = await createSupabaseServerClient();

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError) {
      console.error("Auth user error:", userError);

      return NextResponse.json(
        {
          error: "Authentication failed",
        },
        { status: 401 },
      );
    }

    if (!user) {
      return NextResponse.json(
        {
          error: "User is not authenticated",
        },
        { status: 401 },
      );
    }

    console.log("Authenticated user:", user.id);

    const { data, error } = await supabase
      .from("students")
      .select("id, name, grade, age, subject")
      .eq("user_id", user.id)
      .single();

    if (error) {
      console.error("Student query error:", error);

      return NextResponse.json(
        {
          error: error.message,
        },
        { status: 404 },
      );
    }

    return NextResponse.json({
      student: data,
    });
  } catch (error) {
    console.error("Student API error:", error);

    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Failed to fetch student",
      },
      {
        status: 500,
      },
    );
  }
}
