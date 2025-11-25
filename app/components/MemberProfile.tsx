"use client";

import { useEffect, useState } from "react";
import { FaArrowLeft, FaEdit, FaTrash, FaSave, FaTimes } from "react-icons/fa";
import { supabase } from "../../lib/supabaseClient";

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
  onUpdate?: (member: Member) => void;
}

interface DayScore {
  day: string;
  castle: string;
  bestScore: number | null;
  totalEntries: number;
}

const DAYS_OF_WEEK = [
  { day: "Monday", castle: "Guardian's Castle" },
  { day: "Tuesday", castle: "Fodina Castle" },
  { day: "Wednesday", castle: "Immortal Castle" },
  { day: "Thursday", castle: "Death Castle" },
  { day: "Friday", castle: "Ancient Dragon's Castle" },
  { day: "Saturday", castle: "Blizzard Castle" },
  { day: "Sunday", castle: "Hell Castle" },
];

export default function MemberProfile({ member, onBack, onUpdate }: MemberProfileProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editedName, setEditedName] = useState(member.name);
  const [editedRole, setEditedRole] = useState(member.role || "Member");
  const [saving, setSaving] = useState(false);
  const [dayScores, setDayScores] = useState<DayScore[]>([]);
  const [loadingScores, setLoadingScores] = useState(true);
  const [initialLoad, setInitialLoad] = useState(true);

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

  useEffect(() => {
    loadMemberScores();
  }, [member.id]);

  async function loadMemberScores() {
    setLoadingScores(true);
    try {
      // Single optimized query with join - fetch only what we need for this member
      const { data: entriesData } = await supabase
        .from('castle_rush_entry')
        .select('score, castle_rush!inner(castle)')
        .eq('member_id', member.id)
        .not('score', 'is', null);

      if (!entriesData) {
        setDayScores(DAYS_OF_WEEK.map(({ day, castle }) => ({
          day,
          castle,
          bestScore: null,
          totalEntries: 0,
        })));
        return;
      }

      // Group entries by castle - single pass
      const scoresByCastle = new Map<string, { scores: number[]; count: number }>();

      entriesData.forEach(entry => {
        const castle = (entry.castle_rush as any)?.castle;
        if (castle && entry.score !== null) {
          if (!scoresByCastle.has(castle)) {
            scoresByCastle.set(castle, { scores: [], count: 0 });
          }
          const castleData = scoresByCastle.get(castle)!;
          castleData.scores.push(entry.score);
          castleData.count++;
        }
      });

      // Build the day scores array
      const scores: DayScore[] = DAYS_OF_WEEK.map(({ day, castle }) => {
        const data = scoresByCastle.get(castle);
        return {
          day,
          castle,
          bestScore: data ? Math.max(...data.scores) : null,
          totalEntries: data ? data.count : 0,
        };
      });

      setDayScores(scores);
    } catch (error) {
    } finally {
      setLoadingScores(false);
      setInitialLoad(false);
    }
  }

  const handleSave = async () => {
    setSaving(true);
    try {
      const response = await fetch(`/api/members/${member.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: editedName,
          role: editedRole,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to update member');
      }

      const updatedMember = { ...member, name: editedName, role: editedRole };
      onUpdate?.(updatedMember);
      setIsEditing(false);
    } catch (error) {
      alert(`Failed to update member: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setSaving(false);
    }
  };

  const handleToggleKick = async () => {
    setSaving(true);
    try {
      const response = await fetch(`/api/members/${member.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          kicked: !member.kicked,
        }),
      });

      if (!response.ok) throw new Error('Failed to update member status');

      const updatedMember = { ...member, kicked: !member.kicked };
      onUpdate?.(updatedMember);
    } catch (error) {
      alert('Failed to update member status');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm(`Are you sure you want to permanently delete ${member.name}?`)) {
      return;
    }

    setSaving(true);
    try {
      const response = await fetch(`/api/members/${member.id}`, {
        method: 'DELETE',
      });

      if (!response.ok) throw new Error('Failed to delete member');

      alert('Member deleted successfully');
      onBack();
    } catch (error) {
      alert('Failed to delete member');
    } finally {
      setSaving(false);
    }
  };

  const handleCancelEdit = () => {
    setEditedName(member.name);
    setEditedRole(member.role || "Member");
    setIsEditing(false);
  };

  if (initialLoad) {
    return (
      <div className="p-8 flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="text-lg font-medium mb-2">Loading member profile...</div>
          <div className="text-sm" style={{ color: "var(--color-muted)" }}>
            Fetching {member.name}'s data
          </div>
        </div>
      </div>
    );
  }

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
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-3xl font-bold">{member.name}</h1>
          <div className="flex gap-2">
            {!isEditing ? (
              <>
                <button
                  onClick={() => setIsEditing(true)}
                  className="flex items-center gap-2 px-3 py-2 rounded text-sm"
                  style={{
                    backgroundColor: "var(--color-primary)",
                    color: "white",
                  }}
                  disabled={saving}
                >
                  <FaEdit size={14} />
                  Edit
                </button>
                <button
                  onClick={handleToggleKick}
                  className="flex items-center gap-2 px-3 py-2 rounded text-sm"
                  style={{
                    backgroundColor: member.kicked ? "#10b981" : "#f59e0b",
                    color: "white",
                  }}
                  disabled={saving}
                >
                  {member.kicked ? "Restore" : "Kick"}
                </button>
                <button
                  onClick={handleDelete}
                  className="flex items-center gap-2 px-3 py-2 rounded text-sm"
                  style={{
                    backgroundColor: "#ef4444",
                    color: "white",
                  }}
                  disabled={saving}
                >
                  <FaTrash size={14} />
                  Delete
                </button>
              </>
            ) : (
              <>
                <button
                  onClick={handleSave}
                  className="flex items-center gap-2 px-3 py-2 rounded text-sm"
                  style={{
                    backgroundColor: "#10b981",
                    color: "white",
                  }}
                  disabled={saving}
                >
                  <FaSave size={14} />
                  {saving ? "Saving..." : "Save"}
                </button>
                <button
                  onClick={handleCancelEdit}
                  className="flex items-center gap-2 px-3 py-2 rounded text-sm"
                  style={{
                    backgroundColor: "rgba(128, 128, 128, 0.6)",
                    color: "white",
                  }}
                  disabled={saving}
                >
                  <FaTimes size={14} />
                  Cancel
                </button>
              </>
            )}
          </div>
        </div>
        
        <div className="space-y-4">
          <div>
            <div className="text-xs mb-1" style={{ color: "var(--color-muted)" }}>
              Name
            </div>
            {isEditing ? (
              <input
                type="text"
                value={editedName}
                onChange={(e) => setEditedName(e.target.value)}
                className="w-full px-3 py-2 rounded border text-lg"
                style={{
                  backgroundColor: "rgba(128, 128, 128, 0.1)",
                  borderColor: "var(--color-border)",
                  color: "var(--color-foreground)",
                }}
              />
            ) : (
              <div className="text-lg">{member.name}</div>
            )}
          </div>

          <div>
            <div className="text-xs mb-1" style={{ color: "var(--color-muted)" }}>
              Role
            </div>
            {isEditing ? (
              <input
                type="text"
                value={editedRole}
                onChange={(e) => setEditedRole(e.target.value)}
                className="w-full px-3 py-2 rounded border text-lg"
                style={{
                  backgroundColor: "rgba(128, 128, 128, 0.1)",
                  borderColor: "var(--color-border)",
                  color: "var(--color-foreground)",
                }}
              />
            ) : (
              <div className="text-lg">{member.role || "Member"}</div>
            )}
          </div>

          <div>
            <div className="text-xs mb-1" style={{ color: "var(--color-muted)" }}>
              Status
            </div>
            <div className="text-lg">
              {member.kicked ? (
                <span style={{ color: "#ef4444" }}>Kicked</span>
              ) : (
                <span style={{ color: "#10b981" }}>Active</span>
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

        {/* Best Scores by Day */}
        <div className="mt-8 pt-6 border-t" style={{ borderColor: "var(--color-border)" }}>
          <h2 className="text-xl font-semibold mb-4">Best Scores by Day</h2>
          <div className="space-y-2">
            {dayScores.map((dayScore) => (
              <div 
                key={dayScore.day}
                className="flex items-center justify-between p-3 rounded"
                style={{ backgroundColor: "rgba(128, 128, 128, 0.05)" }}
              >
                <div>
                  <div className="font-medium">{dayScore.day}</div>
                  <div className="text-xs" style={{ color: "var(--color-muted)" }}>
                    {dayScore.castle}
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-2xl font-bold">
                    {dayScore.bestScore !== null ? dayScore.bestScore.toLocaleString() : '-'}
                  </div>
                  <div className="text-xs" style={{ color: "var(--color-muted)" }}>
                    {dayScore.totalEntries} {dayScore.totalEntries === 1 ? 'entry' : 'entries'}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
