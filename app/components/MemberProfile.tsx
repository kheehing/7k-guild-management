"use client";

import { useEffect } from "react";
import { FaArrowLeft } from "react-icons/fa";

interface Member {
  id: string;
  name: string;
  role?: string;
  created_at?: string;
  kicked?: boolean;
}

interface MemberProfileProps {
  member: Member;
  onBack: () => void;
}

export default function MemberProfile({ member, onBack }: MemberProfileProps) {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Backspace" && (e.target as HTMLElement).tagName !== "INPUT" && (e.target as HTMLElement).tagName !== "TEXTAREA") {
        e.preventDefault();
        onBack();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onBack]);

  return (
    <div className="p-8">
      <button
        onClick={onBack}
        className="flex items-center gap-2 px-4 py-2 rounded mb-6 transition-all"
        style={{
          backgroundColor: "var(--color-primary)",
          color: "white",
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.backgroundColor = "#4b1575";
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.backgroundColor = "var(--color-primary)";
        }}
      >
        <FaArrowLeft />
        Back
      </button>

      <div
        className="p-6 rounded-lg max-w-2xl"
        style={{
          backgroundColor: "var(--color-surface)",
          border: "1px solid var(--color-border)",
        }}
      >
        <h1 className="text-3xl font-bold mb-4">{member.name}</h1>
        
        <div className="space-y-3">
          <div>
            <div className="text-xs mb-1" style={{ color: "var(--color-muted)" }}>
              Role
            </div>
            <div className="text-lg">{member.role || "Member"}</div>
          </div>

          <div>
            <div className="text-xs mb-1" style={{ color: "var(--color-muted)" }}>
              Status
            </div>
            <div className="text-lg">
              {member.kicked ? (
                <span style={{ color: "var(--color-alert)" }}>Kicked</span>
              ) : (
                <span style={{ color: "var(--color-primary)" }}>Active</span>
              )}
            </div>
          </div>

          {member.created_at && (
            <div>
              <div className="text-xs mb-1" style={{ color: "var(--color-muted)" }}>
                Joined
              </div>
              <div className="text-lg">
                {new Date(member.created_at).toLocaleDateString()}
              </div>
            </div>
          )}

          <div>
            <div className="text-xs mb-1" style={{ color: "var(--color-muted)" }}>
              Member ID
            </div>
            <div className="text-sm font-mono" style={{ color: "var(--color-muted)" }}>
              {member.id}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
