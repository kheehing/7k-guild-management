import { createClient } from "@supabase/supabase-js";

export function supabaseServer() {
  return createClient(
    process.env.SUPABASE_URL as string,
    process.env.SUPABASE_SECRET_KEY as string,
    {
      auth: {
        persistSession: false,
      },
    }
  );
}

