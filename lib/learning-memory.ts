import { supabase } from "@/lib/supabase";

interface SaveLearningMemoryParams {
  userId: string;
  topic: string;
  subject?: string | null;
  grade?: number | null;
  masteryLevel?: "learning" | "practicing" | "mastered";
  notes?: string | null;
}

export async function saveLearningMemory({
  userId,
  topic,
  subject,
  grade,
  masteryLevel = "learning",
  notes,
}: SaveLearningMemoryParams) {
  // --------------------------------
  // Check if this topic already exists
  // for this student
  // --------------------------------
  const { data: existingMemory, error: findError } = await supabase
    .from("student_learning_memory")
    .select("id")
    .eq("user_id", userId)
    .eq("topic", topic)
    .maybeSingle();

  if (findError) {
    console.error("Failed to find existing learning memory:", findError);

    throw findError;
  }

  // --------------------------------
  // Update existing topic
  // --------------------------------
  if (existingMemory) {
    const { data, error } = await supabase
      .from("student_learning_memory")
      .update({
        subject: subject ?? null,
        grade: grade ?? null,
        mastery_level: masteryLevel,
        notes: notes ?? null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", existingMemory.id)
      .eq("user_id", userId)
      .select()
      .single();

    if (error) {
      console.error("Failed to update learning memory:", error);

      throw error;
    }

    console.log("Learning memory updated:", data);

    return data;
  }

  // --------------------------------
  // Create new topic
  // --------------------------------
  const { data, error } = await supabase
    .from("student_learning_memory")
    .insert({
      user_id: userId,
      topic,
      subject: subject ?? null,
      grade: grade ?? null,
      mastery_level: masteryLevel,
      notes: notes ?? null,
    })
    .select()
    .single();

  if (error) {
    console.error("Failed to save learning memory:", error);

    throw error;
  }

  console.log("New learning memory created:", data);

  return data;
}
