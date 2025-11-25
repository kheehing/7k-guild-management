import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseClient";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { date, entries, loggedBy } = body;

    if (!date || !entries || !loggedBy) {
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
      return NextResponse.json(
        { error: "Failed to create logger entry" },
        { status: 500 }
      );
    }

    const loggerId = loggerData.id;

    // 2. Create advent_expedition entry
    const { data: adventData, error: adventError } = await supabaseAdmin
      .from("advent_expedition")
      .insert({
        date,
        logger_id: loggerId,
      })
      .select()
      .single();

    if (adventError) {
      return NextResponse.json(
        { error: "Failed to create advent expedition entry" },
        { status: 500 }
      );
    }

    const adventId = adventData.id;

    // 3. Create advent_expedition_entry records for each member x boss combination
    const entryRecords = entries.map((entry: any) => ({
      member_id: entry.member_id,
      advent_expedition_id: adventId,
      date: entry.date,
      boss: entry.boss,
      attendance: entry.attendance,
      total_score: entry.total_score,
      logger_id: loggerId,
    }));

    const { error: entriesError } = await supabaseAdmin
      .from("advent_expedition_entry")
      .insert(entryRecords);

    if (entriesError) {
      return NextResponse.json(
        { error: "Failed to create advent expedition entries" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      adventId,
      loggerId,
    });
  } catch (err: any) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

export async function PUT(req: Request) {
  try {
    const body = await req.json();
    const { adventId, entries, loggedBy } = body;

    if (!adventId || !entries || !loggedBy) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    // 1. Create logger entry for the update
    const { data: loggerData, error: loggerError } = await supabaseAdmin
      .from("logger")
      .insert({ logged_by: loggedBy })
      .select()
      .single();

    if (loggerError) {
      return NextResponse.json(
        { error: "Failed to create logger entry" },
        { status: 500 }
      );
    }

    const loggerId = loggerData.id;

    // 2. Delete existing entries for this advent expedition
    const { error: deleteError } = await supabaseAdmin
      .from("advent_expedition_entry")
      .delete()
      .eq('advent_expedition_id', adventId);

    if (deleteError) {
      return NextResponse.json(
        { error: "Failed to delete existing entries" },
        { status: 500 }
      );
    }

    // 3. Insert new entries
    const entryRecords = entries.map((entry: any) => ({
      member_id: entry.member_id,
      advent_expedition_id: adventId,
      date: entry.date,
      boss: entry.boss,
      attendance: entry.attendance,
      total_score: entry.total_score,
      logger_id: loggerId,
    }));

    const { error: insertError } = await supabaseAdmin
      .from("advent_expedition_entry")
      .insert(entryRecords);

    if (insertError) {
      return NextResponse.json(
        { error: "Failed to insert new entries" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      adventId,
      loggerId,
    });
  } catch (err: any) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
