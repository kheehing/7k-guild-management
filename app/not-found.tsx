"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function NotFound() {
  const router = useRouter();

  useEffect(() => {
    // Redirect to /public after 3 seconds
    const timer = setTimeout(() => {
      router.push("/public");
    }, 3000);

    return () => clearTimeout(timer);
  }, [router]);

  const handleRedirectNow = () => {
    router.push("/public");
  };

  return (
    <div
      className="min-h-screen flex items-center justify-center p-4"
      style={{
        backgroundColor: "var(--color-bg)",
        color: "var(--color-foreground)",
      }}
    >
      <div
        className="max-w-md w-full p-8 rounded-lg text-center space-y-6"
        style={{
          backgroundColor: "var(--color-surface)",
          border: "1px solid var(--color-border)",
        }}
      >
        <div className="space-y-2">
          <h1 className="text-6xl font-bold" style={{ color: "var(--color-primary)" }}>
            404
          </h1>
          <h2 className="text-2xl font-semibold">Page Not Found</h2>
          <p style={{ color: "var(--color-muted)" }}>
            The page you're looking for doesn't exist or has been moved.
          </p>
        </div>

        <div className="space-y-4">
          <p style={{ color: "var(--color-muted)" }}>
            Redirecting to public view in 3 seconds...
          </p>

          <button
            onClick={handleRedirectNow}
            className="w-full px-6 py-3 rounded-lg font-semibold transition-all"
            style={{
              backgroundColor: "var(--color-primary)",
              color: "white",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.opacity = "0.9";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.opacity = "1";
            }}
          >
            Go to Public View Now
          </button>

          <button
            onClick={() => router.push("/dashboard")}
            className="w-full px-6 py-3 rounded-lg font-semibold transition-all"
            style={{
              backgroundColor: "var(--color-surface)",
              color: "var(--color-foreground)",
              border: "1px solid var(--color-border)",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = "var(--color-bg)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = "var(--color-surface)";
            }}
          >
            Back to Dashboard
          </button>
        </div>
      </div>
    </div>
  );
}
