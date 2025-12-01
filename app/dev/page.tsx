"use client";

import { useState, useEffect } from "react";
import { supabase } from "../../lib/supabaseClient";
import { useRouter } from "next/navigation";

export default function DevPage() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    checkAuth();
  }, []);

  async function checkAuth() {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      router.push("/");
    } else {
      setIsAuthenticated(true);
    }
    setLoading(false);
  }

  if (loading || !isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: "var(--color-bg)" }}>
        <div style={{ color: "var(--color-muted)" }}>Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen p-8" style={{ backgroundColor: "var(--color-bg)" }}>
      <div className="max-w-7xl mx-auto">
        <h1 className="text-3xl font-bold mb-6" style={{ color: "var(--color-foreground)" }}>Developer Tools</h1>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Castle Rush Card */}
          <div
            className="p-6 rounded-lg border cursor-pointer hover:opacity-80 transition-opacity"
            onClick={() => router.push("/dev/castle-rush")}
            style={{
              backgroundColor: "var(--color-surface)",
              borderColor: "var(--color-border)",
            }}
          >
            <h2 className="text-2xl font-bold mb-2" style={{ color: "var(--color-foreground)" }}>
              Castle Rush Entries
            </h2>
            <p style={{ color: "var(--color-muted)" }}>
              View and manage castle rush entries, scores, and attendance in a calendar view.
            </p>
          </div>

          {/* Members Card */}
          <div
            className="p-6 rounded-lg border cursor-pointer hover:opacity-80 transition-opacity"
            onClick={() => router.push("/dev/members")}
            style={{
              backgroundColor: "var(--color-surface)",
              borderColor: "var(--color-border)",
            }}
          >
            <h2 className="text-2xl font-bold mb-2" style={{ color: "var(--color-foreground)" }}>
              Members Admin
            </h2>
            <p style={{ color: "var(--color-muted)" }}>
              Edit member information, roles, kicked status, and timestamps.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
