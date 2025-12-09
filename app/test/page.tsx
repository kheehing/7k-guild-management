"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import GameCapture from "../components/GameCapture";

export default function TestPage() {
  const router = useRouter();
  const [isLocalhost, setIsLocalhost] = useState(false);
  const [captureType, setCaptureType] = useState<"castle-rush" | "advent">("castle-rush");

  useEffect(() => {
    // Check if running on localhost
    const hostname = window.location.hostname;
    const isLocal = hostname === "localhost" || hostname === "127.0.0.1" || hostname === "";
    
    if (!isLocal) {
      // Redirect to home if not localhost
      router.push("/");
    } else {
      setIsLocalhost(true);
    }
  }, [router]);

  const handleDataExtracted = (data: any[]) => {
    console.log("Extracted data:", data);
    // TODO: Submit to database
  };

  if (!isLocalhost) {
    return null;
  }

  return (
    <div className="min-h-screen p-8" style={{ backgroundColor: "var(--color-bg)" }}>
      <div className="max-w-7xl mx-auto">
        <h1 className="text-3xl font-bold mb-6" style={{ color: "var(--color-foreground)" }}>
          Test Page (Local Only)
        </h1>
        
        <div
          className="p-6 rounded-lg border mb-6"
          style={{
            backgroundColor: "var(--color-surface)",
            borderColor: "var(--color-border)",
          }}
        >
          <h2 className="text-xl font-bold mb-4" style={{ color: "var(--color-foreground)" }}>
            Environment Info
          </h2>
          <div className="space-y-2 text-sm" style={{ color: "var(--color-muted)" }}>
            <div>Hostname: {typeof window !== "undefined" ? window.location.hostname : "unknown"}</div>
            <div>Environment: {process.env.NODE_ENV}</div>
            <div>Vercel ENV: {process.env.NEXT_PUBLIC_VERCEL_ENV || "not set"}</div>
          </div>
        </div>

        <div
          className="p-6 rounded-lg border"
          style={{
            backgroundColor: "var(--color-surface)",
            borderColor: "var(--color-border)",
          }}
        >
          <h2 className="text-xl font-bold mb-4" style={{ color: "var(--color-foreground)" }}>
            Game Capture & Auto Data Entry
          </h2>
          <p className="mb-4" style={{ color: "var(--color-muted)" }}>
            Upload a screenshot from your game to automatically extract and enter data.
          </p>
          
          {/* Capture Type Selection */}
          <div className="mb-4">
            <label className="block text-sm mb-2" style={{ color: "var(--color-foreground)" }}>
              Capture Type
            </label>
            <select
              value={captureType}
              onChange={(e) => setCaptureType(e.target.value as "castle-rush" | "advent")}
              className="w-full px-3 py-2 rounded border"
              style={{
                backgroundColor: "rgba(128, 128, 128, 0.1)",
                borderColor: "var(--color-border)",
                color: "var(--color-foreground)",
              }}
            >
              <option value="castle-rush">Castle Rush</option>
              <option value="advent">Advent Expedition</option>
            </select>
          </div>

          <GameCapture 
            captureType={captureType}
            onDataExtracted={handleDataExtracted}
          />
        </div>
      </div>
    </div>
  );
}
