import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseClient";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { castle, date, entries, loggedBy } = body;

    if (!castle || !date || !entries || !loggedBy) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    // 1. Create logger entry
    const { data: loggerData, error: loggerError } = await supabaseAdmin
      .from("logger")
      .insert({ logged_by: loggedBy })
      .select()
      .single();

    if (loggerError) {
      console.error("Error creating logger:", loggerError);
      return NextResponse.json(
        { error: "Failed to create logger entry" },
        { status: 500 }
      );
    }

    const loggerId = loggerData.id;

    // 2. Create castle_rush entry
    const { data: castleRushData, error: castleRushError } = await supabaseAdmin
      .from("castle_rush")
      .insert({
        castle,
        date,
        logger_id: loggerId,
      })
      .select()
      .single();

    if (castleRushError) {
      console.error("Error creating castle rush:", castleRushError);
      return NextResponse.json(
        { error: "Failed to create castle rush entry" },
        { status: 500 }
      );
    }

    const castleRushId = castleRushData.id;

    // 3. Create castle_rush_entry records for each member
    const entryRecords = entries.map((entry: any) => ({
      member_id: entry.member_id,
      castle_rush_id: castleRushId,
      attendance: entry.attendance,
      score: entry.score,
      logger_id: loggerId,
    }));

    const { error: entriesError } = await supabaseAdmin
      .from("castle_rush_entry")
      .insert(entryRecords);

    if (entriesError) {
      console.error("Error creating castle rush entries:", entriesError);
      return NextResponse.json(
        { error: "Failed to create castle rush entries" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      castleRushId,
      loggerId,
    });
  } catch (err: any) {
    console.error("API error:", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
