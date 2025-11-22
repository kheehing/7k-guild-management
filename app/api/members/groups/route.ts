import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabaseClient";

// Returns members that have a non-null, non-empty `groups` field.
export async function GET() {
  try {
    // Query for rows where groups is not null and not an empty string
    const { data, error } = await supabase
      .from("members")
      .select("id,name,groups")
      .not("groups", "is", null)
      .neq("groups", "");

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const count = Array.isArray(data) ? data.length : 0;
    return NextResponse.json({ count, members: data ?? [] });
  } catch (err: any) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
