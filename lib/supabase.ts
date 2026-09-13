import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseSecret = process.env.SUPABASE_SECRET_KEY;

if (!supabaseUrl) {
  throw new Error(
    "NEXT_PUBLIC_SUPABASE_URL is not configured"
  );
}

if (!supabaseSecret) {
  throw new Error(
    "SUPABASE_SECRET_KEY is not configured"
  );
}

export const supabase = createClient(
  supabaseUrl,
  supabaseSecret
);