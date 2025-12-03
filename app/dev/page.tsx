"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../lib/supabaseClient";

export default function DevPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);

  // Check authentication on mount and set up auth listener
  useEffect(() => {
    let mounted = true;

    const checkAuth = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (mounted) {
        if (!user) {
          router.push("/");
        } else {
          setLoading(false);
        }
      }
    };

    checkAuth();

    // Listen for auth state changes (including session expiry)
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_OUT' || event === 'TOKEN_REFRESHED' && !session) {
        router.push("/");
      } else if (!session) {
        router.push("/");
      }
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [router]);

  // Show loading state while checking auth
  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center" style={{ backgroundColor: "var(--color-background)" }}>
        <div className="text-sm" style={{ color: "var(--color-muted)" }}>Loading...</div>
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
