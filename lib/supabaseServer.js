import { createClient } from "@supabase/supabase-js";

export function supabaseServer() {
  return createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SECRET_KEY,
    {
      auth: {
        persistSession: false,
      }
    }
  );
}
