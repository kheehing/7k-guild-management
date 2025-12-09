"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { FaTrophy, FaUsers, FaCalendarAlt, FaStar } from "react-icons/fa";

interface Member {
  id: string;
  name: string;
  role: string;
  kicked: boolean;
}

interface CastleRushEntry {
  id: string;
  score: number;
  attendance: boolean;
  members: {
    name: string;
    role: string;
  }[];
}

interface CastleRush {
  id: string;
  date: string;
  castle: string;
  castle_rush_entry: CastleRushEntry[];
}

export default function PublicPage() {
  const [members, setMembers] = useState<Member[]>([]);
  const [latestCastleRush, setLatestCastleRush] = useState<CastleRush | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchPublicData();
  }, []);

  const fetchPublicData = async () => {
    try {
      // Fetch active members
      const { data: membersData, error: membersError } = await supabase
        .from("members")
        .select("*")
        .eq("kicked", false)
        .order("name");

      if (membersError) throw membersError;

      // Fetch latest castle rush
      const { data: castleRushData, error: castleRushError } = await supabase
        .from("castle_rush")
        .select(`
          id,
          date,
          castle,
          castle_rush_entry (
            id,
            score,
            attendance,
            members (
              name,
              role
            )
          )
        `)
        .order("date", { ascending: false })
        .limit(1)
        .single();

      if (castleRushError && castleRushError.code !== "PGRST116") {
        throw castleRushError;
      }

      setMembers(membersData || []);
      setLatestCastleRush(castleRushData);
    } catch (error) {
      console.error("Error fetching public data:", error);
    } finally {
      setLoading(false);
    }
  };

  const activeMemberCount = members.length;
  const totalScore = latestCastleRush?.castle_rush_entry
    ?.filter((entry) => entry.attendance)
    .reduce((sum, entry) => sum + (entry.score || 0), 0) || 0;
  const participationRate = latestCastleRush?.castle_rush_entry
    ? ((latestCastleRush.castle_rush_entry.filter((e) => e.attendance).length /
        latestCastleRush.castle_rush_entry.length) *
        100).toFixed(1)
    : 0;

  if (loading) {
    return (
      <div
        className="min-h-screen flex items-center justify-center"
        style={{ backgroundColor: "var(--color-bg)" }}
      >
        <div className="text-center space-y-4">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 mx-auto"
            style={{ borderColor: "var(--color-primary)" }}
          ></div>
          <p style={{ color: "var(--color-foreground)" }}>Loading guild data...</p>
        </div>
      </div>
    );
  }

  return (
    <div
      className="min-h-screen p-6"
      style={{
        backgroundColor: "var(--color-bg)",
        color: "var(--color-foreground)",
      }}
    >
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="text-center space-y-2 py-8">
          <h1 className="text-4xl font-bold" style={{ color: "var(--color-primary)" }}>
            7K Guild Management
          </h1>
          <p style={{ color: "var(--color-muted)" }}>
            Public Guild Statistics & Performance
          </p>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div
            className="p-6 rounded-lg space-y-2"
            style={{
              backgroundColor: "var(--color-surface)",
              border: "1px solid var(--color-border)",
            }}
          >
            <div className="flex items-center gap-3">
              <FaUsers className="text-2xl" style={{ color: "var(--color-primary)" }} />
              <div>
                <p className="text-sm" style={{ color: "var(--color-muted)" }}>
                  Active Members
                </p>
                <p className="text-3xl font-bold">{activeMemberCount}</p>
              </div>
            </div>
          </div>

          <div
            className="p-6 rounded-lg space-y-2"
            style={{
              backgroundColor: "var(--color-surface)",
              border: "1px solid var(--color-border)",
            }}
          >
            <div className="flex items-center gap-3">
              <FaTrophy className="text-2xl" style={{ color: "var(--color-primary)" }} />
              <div>
                <p className="text-sm" style={{ color: "var(--color-muted)" }}>
                  Latest Total Score
                </p>
                <p className="text-3xl font-bold">{totalScore.toLocaleString()}</p>
              </div>
            </div>
          </div>

          <div
            className="p-6 rounded-lg space-y-2"
            style={{
              backgroundColor: "var(--color-surface)",
              border: "1px solid var(--color-border)",
            }}
          >
            <div className="flex items-center gap-3">
              <FaStar className="text-2xl" style={{ color: "var(--color-primary)" }} />
              <div>
                <p className="text-sm" style={{ color: "var(--color-muted)" }}>
                  Participation Rate
                </p>
                <p className="text-3xl font-bold">{participationRate}%</p>
              </div>
            </div>
          </div>

          <div
            className="p-6 rounded-lg space-y-2"
            style={{
              backgroundColor: "var(--color-surface)",
              border: "1px solid var(--color-border)",
            }}
          >
            <div className="flex items-center gap-3">
              <FaCalendarAlt className="text-2xl" style={{ color: "var(--color-primary)" }} />
              <div>
                <p className="text-sm" style={{ color: "var(--color-muted)" }}>
                  Last Event
                </p>
                <p className="text-lg font-bold">
                  {latestCastleRush
                    ? new Date(latestCastleRush.date).toLocaleDateString()
                    : "N/A"}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Latest Castle Rush Results */}
        {latestCastleRush && (
          <div
            className="p-6 rounded-lg space-y-4"
            style={{
              backgroundColor: "var(--color-surface)",
              border: "1px solid var(--color-border)",
            }}
          >
            <h2 className="text-2xl font-bold">
              Latest Castle Rush - {latestCastleRush.castle}
            </h2>
            <p style={{ color: "var(--color-muted)" }}>
              {new Date(latestCastleRush.date).toLocaleDateString("en-US", {
                month: "long",
                day: "numeric",
                year: "numeric",
              })}
            </p>

            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr
                    style={{
                      borderBottom: "1px solid var(--color-border)",
                    }}
                  >
                    <th className="text-left p-3">Rank</th>
                    <th className="text-left p-3">Member</th>
                    <th className="text-left p-3">Role</th>
                    <th className="text-right p-3">Score</th>
                  </tr>
                </thead>
                <tbody>
                  {latestCastleRush.castle_rush_entry
                    ?.filter((entry) => entry.attendance)
                    .sort((a, b) => (b.score || 0) - (a.score || 0))
                    .map((entry, index) => (
                      <tr
                        key={entry.id}
                        style={{
                          borderBottom: "1px solid var(--color-border)",
                        }}
                      >
                        <td className="p-3">
                          <div
                            className="w-10 h-10 flex items-center justify-center rounded font-bold"
                            style={{
                              backgroundColor:
                                index === 0
                                  ? "#FFD700"
                                  : index === 1
                                  ? "#C0C0C0"
                                  : index === 2
                                  ? "#CD7F32"
                                  : "var(--color-bg)",
                              color:
                                index < 3 ? "#000" : "var(--color-foreground)",
                            }}
                          >
                            {index + 1}
                          </div>
                        </td>
                        <td className="p-3 font-semibold">{entry.members[0]?.name}</td>
                        <td className="p-3" style={{ color: "var(--color-muted)" }}>
                          {entry.members[0]?.role}
                        </td>
                        <td className="p-3 text-right font-bold">
                          {entry.score?.toLocaleString() || 0}
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="text-center py-8" style={{ color: "var(--color-muted)" }}>
          <p>7K Guild Management System</p>
        </div>
      </div>
    </div>
  );
}
