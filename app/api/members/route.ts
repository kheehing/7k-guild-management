import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseClient";
import { fetchMembers } from "@/lib/members";

const ALLOWED_ROLES = ["Member", "DPS", "Healer", "Tank", "Leader"];

function isGroupsError(message?: string) {
  return typeof message === "string" && /groups/i.test(message);
}

function isSchemaMissingColumnError(message?: string) {
  return typeof message === "string" && /(groups|logged_by)/i.test(message);
}

export async function GET() {
  try {
    // Select only known safe columns to avoid schema errors
    // Try with all fields first
    let { data, error, count } = await supabaseAdmin
      .from("members")
      .select("*", { count: 'exact' })
      .order("created_at", { ascending: false })
      .limit(1000);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ members: data ?? [] });
  } catch (err: any) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const name = (body?.name ?? "").trim();
    const role = (body?.role ?? "Member").trim();
    const userIdentifier = body?.log_by; // email or user ID

    if (!name) {
      return NextResponse.json({ error: "Name is required" }, { status: 400 });
    }

    const normalizedRole = ALLOWED_ROLES.includes(role) ? role : "Member";

    // Duplicate check — select explicit columns to avoid referencing removed columns like `groups`
    const { data: found, error: findErr } = await supabaseAdmin
      .from("members")
      .select("id,name")
      .ilike("name", name);

    if (findErr) {
      if (isGroupsError(findErr.message)) {
        return NextResponse.json(
          { error: "Database schema changed: 'groups' column not found. Please run migrations or update server code." },
          { status: 500 }
        );
      }
      return NextResponse.json({ error: findErr.message }, { status: 500 });
    }

    if (found && found.length > 0) {
      return NextResponse.json({ error: "Member with that name already exists" }, { status: 409 });
    }

    // Create a new logger record for each new member
    let logger_id = null;
    const loggerPayload: any = {};
    
    // Include logged_by if provided
    if (userIdentifier) {
      loggerPayload.logged_by = userIdentifier;
    }

    const { data: newLogger, error: loggerErr } = await supabaseAdmin
      .from("logger")
      .insert([loggerPayload])
      .select("id")
      .single();

    if (loggerErr) {
      return NextResponse.json(
        { error: `Failed to create logger: ${loggerErr.message}` },
        { status: 500 }
      );
    }

    logger_id = newLogger?.id;

    // Build insert payload
    const insertPayload: any = { name, role: normalizedRole };
    if (logger_id) {
      insertPayload.logger_id = logger_id;
    }

    // helper to perform insert and return result or error
    async function tryInsert(payload: any, selectCols: string) {
      return await supabaseAdmin.from("members").insert([payload]).select(selectCols).limit(1);
    }

    // Select only safe columns that exist in the current schema
    const preferredSelect = "id,name,role,created_at,logger_id,kicked";

    let data: any = null;
    let insertErr: any = null;

    // first attempt
    try {
      const res = await tryInsert(insertPayload, preferredSelect);
      data = res.data;
      insertErr = res.error;
    } catch (e: any) {
      insertErr = e;
    }

    // If insert failed due to missing schema column, retry without logged_by
    if (insertErr && isSchemaMissingColumnError(insertErr.message)) {
      // remove potentially offending keys and retry
      const fallbackPayload = { name, role: normalizedRole };
      try {
        const res2 = await tryInsert(fallbackPayload, "id,name,role,created_at");
        data = res2.data;
        insertErr = res2.error;
      } catch (e: any) {
        insertErr = e;
      }
      if (insertErr) {
        return NextResponse.json({ error: String(insertErr.message ?? insertErr) }, { status: 500 });
      }
      // success with fallback; return created row
      return NextResponse.json(data?.[0] ?? null, { status: 201 });
    }

    if (insertErr) {
      return NextResponse.json({ error: String(insertErr.message ?? insertErr) }, { status: 500 });
    }

    return NextResponse.json(data?.[0] ?? null, { status: 201 });
  } catch (err: any) {
    return NextResponse.json({ error: String(err?.message ?? err) }, { status: 500 });
  }
}
