import { NextResponse } from "next/server";
import { supabaseAdmin } from "../../../../lib/supabaseClient";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const date = searchParams.get('date');

    if (!date) {
      return NextResponse.json({ error: "Date parameter required" }, { status: 400 });
    }

    // Get castle rush for the specified date
    const { data: castleRush, error: crError } = await supabaseAdmin
      .from('castle_rush')
      .select('id, castle, date')
      .eq('date', date)
      .single();

    if (crError) {
      if (crError.code === 'PGRST116') {
        return NextResponse.json({ entries: [], message: "No castle rush found for this date" });
      }
      throw crError;
    }

    // Get all entries for this castle rush with member information
    const { data: entries, error: entriesError } = await supabaseAdmin
      .from('castle_rush_entry')
      .select(`
        id,
        member_id,
        score,
        attendance,
        castle_rush_id,
        created_at,
        members (
          name
        )
      `)
      .eq('castle_rush_id', castleRush.id)
      .order('score', { ascending: false });

    if (entriesError) throw entriesError;

    // Format the response
    const formattedEntries = entries?.map((entry: any) => ({
      id: entry.id,
      member_id: entry.member_id,
      member_name: entry.members?.name,
      score: entry.score,
      attendance: entry.attendance,
      castle_rush_id: entry.castle_rush_id,
      castle: castleRush.castle,
      created_at: entry.created_at,
    })) || [];

    return NextResponse.json({
      entries: formattedEntries,
      castle_rush: castleRush,
      total_count: formattedEntries.length
    });

  } catch (error) {
    console.error("Error fetching castle rush entries:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}
