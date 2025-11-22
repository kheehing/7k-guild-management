"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../lib/supabaseClient";

export default function Page() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const emailhandler = "@ap0theosis.abc";
  const [password, setPassword] = useState("");
  const [user, setUser] = useState<any | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;

    // check current user/session and redirect if found
    (async () => {
      const { data } = await supabase.auth.getUser();
      const currentUser = data.user ?? null;
      if (mounted && currentUser) {
        router.push("/dashboard");
      }
      if (mounted) setUser(currentUser);
    })();

    // listen for auth changes and redirect on sign in
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      const u = session?.user ?? null;
      setUser(u);
      if (u) router.push("/dashboard");
    });

    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, [router]);

  function buildEmail(front: string) {
    const trimmed = front.trim();
    return trimmed.includes("@") || trimmed === "" ? trimmed : `${trimmed}${emailhandler}`;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const emailToUse = buildEmail(email);

      let res;
      res = await supabase.auth.signInWithPassword({ email: emailToUse, password });
      if ((res as any).error) {
        console.error("Supabase auth error:", res);
        throw (res as any).error;
      }
      // on success, the onAuthStateChange handler will redirect
    } catch (err: any) {
      console.error("Auth failed:", err);
      setError(err.message || String(err));
    } finally {
      setLoading(false);
      setPassword("");
    }
  }

  const preview = buildEmail(email) || "(enter username)";

  return (
    <div
      className="min-h-screen flex items-center justify-center p-6"
      style={{
        background: "var(--color-bg)",
        color: "#383B39",
      }}
    >
      <div className="w-full max-w-md p-6 rounded-md surface">

        <form onSubmit={handleSubmit} className="space-y-4">
          {error && <div className="text-sm text-red-500">{error}</div>}

          <div>
            <label className="block text-sm mb-1">User</label>
            <div className="flex items-center">
              <input
                type="text"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-3 py-2 rounded border"
                required
                style={{
                  background: "transparent",
                  borderColor: "var(--color-border)",
                  color: "var(--color-foreground)",
                }}
              />
            </div>
          </div>

          <div>
            <label className="block text-sm mb-1">Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-3 py-2 rounded border"
              style={{
                background: "transparent",
                borderColor: "var(--color-border)",
                color: "var(--color-foreground)",
              }}
            />
          </div>

          <div className="flex items-center justify-between">
            <div className="text-sm"></div>

            <button
              type="submit"
              className="px-4 py-2 rounded"
              style={{
                backgroundColor: "var(--color-primary)",
                color: "white",
              }}
              disabled={loading}
            >
              {loading ? "Working…" : "Sign in"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
