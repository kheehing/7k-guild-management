import { supabase } from "./supabaseClient";

export interface Member {
  id: string;
  name: string;
  role?: string | null;
  created_at?: string | null;
  logger_id?: string | null;
  [key: string]: any;
}

type FetchOptions = {
  limit?: number;
  offset?: number;
  orderBy?: { column: string; ascending?: boolean };
};

/**
 * Fetch members from the `members` table.
 * Returns an array of `Member` or throws an Error when the query fails.
 */
export async function fetchMembers(options: FetchOptions = {}): Promise<Member[]> {
  const { limit, offset, orderBy } = options;

  // Let the `select<T>()` generic infer the row type so TS types align with supabase-js
  let query = supabase.from("members").select("*");

  if (orderBy) {
    query = query.order(orderBy.column, { ascending: !!orderBy.ascending });
  } else {
    // default ordering
    query = query.order("created_at", { ascending: false });
  }

  // PostgREST / supabase client doesn't expose `offset` directly; use `range` when both
  // offset and limit are provided. Otherwise use `limit` when only limit is set.
  if (typeof limit === "number" && typeof offset === "number") {
    // range expects (from, to) inclusive
    query = query.range(offset, offset + limit - 1);
  } else {
    if (typeof limit === "number") query = query.limit(limit);
    if (typeof offset === "number") {
      // offset without limit - fetch from offset onward with a large cap
      query = query.range(offset, offset + 999999);
    }
  }

  const { data, error } = await query;

  if (error) {
    throw new Error(error.message || "Failed to fetch members");
  }

  return (data as Member[]) ?? [];
}

export default fetchMembers;
