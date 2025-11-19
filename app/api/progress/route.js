import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabaseServer";

export async function POST(request) {
  const supabase = supabaseServer();
  const data = await request.json();

  const { error } = await supabase
    .from("daily_progress")
    .insert(data);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ success: true });
}
