"use client";

import { useState, useEffect, useMemo } from "react";
import { supabase } from "../../../lib/supabaseClient";

interface Member {
  id: string;
  name: string;
  role?: string;
  kicked?: boolean;
}

interface MemberStats {
  memberId: string;
  memberName: string;
  role: string;
  kicked: boolean;
  totalEntries: number;
  attendanceRate: number;
  averageScore: number;
  bestScore: number;
  lastEntry: string | null;
  daysSinceLastEntry: number | null;
  weeklyActivity: number[];
}

export default function AnalysisTab() {
  const [stats, setStats] = useState<MemberStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [sortBy, setSortBy] = useState<'attendance' | 'average' | 'activity'>('attendance');

  useEffect(() => {
    loadMemberStats();
  }, []);

  async function loadMemberStats() {
    try {
      // Optimized parallel queries
      const [membersRes, entriesRes] = await Promise.all([
        supabase.from('members').select('*').order('name'),
        supabase.from('castle_rush_entry').select('member_id, attendance, score, castle_rush!inner(date)')
      ]);

      if (membersRes.error) throw membersRes.error;
      if (entriesRes.error) throw entriesRes.error;

      const members = membersRes.data || [];
      const entries = entriesRes.data || [];

      const now = new Date();

      const memberStats: MemberStats[] = members.map((member: Member) => {
        const memberEntries = entries.filter((e: any) => e.member_id === member.id);
        const attended = memberEntries.filter((e: any) => e.attendance);
        const scores = attended.map((e: any) => e.score || 0);

        const lastEntryDate = memberEntries.length > 0
          ? Math.max(...memberEntries.map((e: any) => new Date(e.castle_rush.date).getTime()))
          : null;

        const daysSinceLastEntry = lastEntryDate
          ? Math.floor((now.getTime() - lastEntryDate) / (1000 * 60 * 60 * 24))
          : null;

        const weeklyActivity = Array(7).fill(0);
        for (let i = 0; i < 7; i++) {
          const dayDate = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
          const dayStr = dayDate.toISOString().split('T')[0];
          const dayEntry = memberEntries.find((e: any) => 
            e.castle_rush.date === dayStr && e.attendance
          );
          weeklyActivity[6 - i] = dayEntry?.score || 0;
        }

        // Get unique castle rush events this member participated in
        const uniqueEvents = new Set(memberEntries.map((e: any) => e.castle_rush.date));
        const totalEntries = uniqueEvents.size;

        return {
          memberId: member.id,
          memberName: member.name,
          role: member.role || "Member",
          kicked: member.kicked || false,
          totalEntries,
          attendanceRate: totalEntries > 0
            ? (attended.length / totalEntries) * 100
            : 0,
          averageScore: scores.length > 0
            ? scores.reduce((a, b) => a + b, 0) / scores.length
            : 0,
          bestScore: scores.length > 0 ? Math.max(...scores) : 0,
          lastEntry: lastEntryDate ? new Date(lastEntryDate).toISOString().split('T')[0] : null,
          daysSinceLastEntry,
          weeklyActivity,
        };
      });

      setStats(memberStats);
    } catch (err) {
      console.error("Error loading stats:", err);
    } finally {
      setLoading(false);
    }
  }

  const openMemberProfile = (memberId: string) => {
    const member = stats.find(s => s.memberId === memberId);
    if (member) {
      window.dispatchEvent(new CustomEvent("openProfile", { 
        detail: { 
          id: member.memberId, 
          name: member.memberName,
          role: member.role,
          kicked: member.kicked
        } 
      }));
    }
  };

  const kickSuggestions = useMemo(() => {
    return stats.filter(stat => 
      !stat.kicked && (
        stat.totalEntries === 0 ||
        stat.attendanceRate < 50 ||
        (stat.daysSinceLastEntry !== null && stat.daysSinceLastEntry > 14)
      )
    );
  }, [stats]);

  const sortedStats = useMemo(() => {
    const sorted = [...stats];
    switch (sortBy) {
      case 'attendance':
        return sorted.sort((a, b) => b.attendanceRate - a.attendanceRate);
      case 'average':
        return sorted.sort((a, b) => b.averageScore - a.averageScore);
      case 'activity':
        return sorted.sort((a, b) => {
          const aLastActive = a.daysSinceLastEntry ?? 9999;
          const bLastActive = b.daysSinceLastEntry ?? 9999;
          return aLastActive - bLastActive;
        });
      default:
        return sorted;
    }
  }, [stats, sortBy]);

  if (loading) {
    return (
      <div className="p-8">
        <div className="text-lg">Loading member analysis...</div>
      </div>
    );
  }

  return (
    <div className="p-4">
      <div className="mb-4">
        <h1 className="text-2xl font-bold mb-1">Members Analysis</h1>
        <p className="text-sm" style={{ color: "var(--color-muted)" }}>
          Detailed performance metrics and attendance tracking
        </p>
      </div>

      {/* Kick Suggestions */}
      {kickSuggestions.length > 0 && (
        <div 
          className="mb-6 p-4 rounded-lg"
          style={{
            backgroundColor: "rgba(239, 68, 68, 0.1)",
            border: "1px solid rgba(239, 68, 68, 0.3)",
          }}
        >
          <h2 className="text-lg font-semibold mb-3" style={{ color: "#ef4444" }}>
            ⚠️ Suggested Members to Review ({kickSuggestions.length})
          </h2>
          <div className="space-y-2">
            {kickSuggestions.map((member) => (
              <div
                key={member.memberId}
                className="flex items-center justify-between p-3 rounded cursor-pointer hover:opacity-80"
                style={{ backgroundColor: "rgba(0, 0, 0, 0.2)" }}
                onClick={() => openMemberProfile(member.memberId)}
              >
                <div>
                  <div className="font-medium">{member.memberName}</div>
                  <div className="text-xs" style={{ color: "var(--color-muted)" }}>
                    {member.totalEntries === 0 && "No entries recorded"}
                    {member.totalEntries > 0 && member.attendanceRate < 50 && 
                      `Low attendance: ${member.attendanceRate.toFixed(0)}%`}
                    {member.daysSinceLastEntry !== null && member.daysSinceLastEntry > 14 && 
                      ` • Inactive for ${member.daysSinceLastEntry} days`}
                  </div>
                </div>
                <div className="text-sm" style={{ color: "#ef4444" }}>Click to review</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Filters and Sort */}
      <div className="mb-4 flex items-center gap-4">
        <div className="flex gap-2">
          <button
            onClick={() => setSortBy('attendance')}
            className="px-3 py-2 rounded text-sm"
            style={{
              backgroundColor: sortBy === 'attendance' ? 'var(--color-primary)' : 'rgba(128, 128, 128, 0.2)',
              color: sortBy === 'attendance' ? 'white' : 'var(--color-foreground)',
            }}
          >
            Sort by Attendance
          </button>
          <button
            onClick={() => setSortBy('average')}
            className="px-3 py-2 rounded text-sm"
            style={{
              backgroundColor: sortBy === 'average' ? 'var(--color-primary)' : 'rgba(128, 128, 128, 0.2)',
              color: sortBy === 'average' ? 'white' : 'var(--color-foreground)',
            }}
          >
            Sort by Avg Score
          </button>
          <button
            onClick={() => setSortBy('activity')}
            className="px-3 py-2 rounded text-sm"
            style={{
              backgroundColor: sortBy === 'activity' ? 'var(--color-primary)' : 'rgba(128, 128, 128, 0.2)',
              color: sortBy === 'activity' ? 'white' : 'var(--color-foreground)',
            }}
          >
            Sort by Recent Activity
          </button>
        </div>
      </div>

      {/* Analysis Table */}
      <div 
        className="rounded-lg overflow-hidden"
        style={{ 
          border: "1px solid var(--color-border)",
          backgroundColor: "var(--color-surface)"
        }}
      >
        <table className="w-full">
          <thead>
            <tr 
              className="border-b"
              style={{ 
                borderColor: "var(--color-border)",
                backgroundColor: "rgba(128, 128, 128, 0.1)"
              }}
            >
              <th className="text-left px-4 py-3 text-sm font-medium">Member</th>
              <th className="text-center px-4 py-3 text-sm font-medium">Role</th>
              <th className="text-center px-4 py-3 text-sm font-medium">Entries</th>
              <th className="text-center px-4 py-3 text-sm font-medium">Attendance</th>
              <th className="text-center px-4 py-3 text-sm font-medium">Avg Score</th>
              <th className="text-center px-4 py-3 text-sm font-medium">Best Score</th>
              <th className="text-center px-4 py-3 text-sm font-medium">Last Active</th>
              <th className="text-center px-4 py-3 text-sm font-medium">Recent Activity</th>
            </tr>
          </thead>
          <tbody>
            {sortedStats.map((stat) => {
              return (
                <tr
                  key={stat.memberId}
                  className="border-b cursor-pointer hover:bg-opacity-50"
                  style={{
                    borderColor: "var(--color-border)",
                    backgroundColor: "transparent",
                    opacity: stat.kicked ? 0.5 : 1,
                  }}
                  onClick={() => openMemberProfile(stat.memberId)}
                >
                  <td className="px-4 py-3">
                    <div className="font-medium">{stat.memberName}</div>
                    {stat.kicked && (
                      <div className="text-xs" style={{ color: "#ef4444" }}>Kicked</div>
                    )}
                  </td>
                  <td className="px-4 py-3 text-center text-sm">{stat.role}</td>
                  <td className="px-4 py-3 text-center">{stat.totalEntries}</td>
                  <td className="px-4 py-3 text-center">
                    <span
                      className="px-2 py-1 rounded text-sm"
                      style={{
                        backgroundColor: 
                          stat.attendanceRate >= 80 ? "rgba(16, 185, 129, 0.2)" :
                          stat.attendanceRate >= 50 ? "rgba(245, 158, 11, 0.2)" :
                          "rgba(239, 68, 68, 0.2)",
                        color:
                          stat.attendanceRate >= 80 ? "#10b981" :
                          stat.attendanceRate >= 50 ? "#f59e0b" :
                          "#ef4444",
                      }}
                    >
                      {stat.attendanceRate.toFixed(0)}%
                    </span>
                  </td>
                  <td className="px-4 py-3 text-center font-mono">
                    {stat.averageScore > 0 ? stat.averageScore.toFixed(0) : '-'}
                  </td>
                  <td className="px-4 py-3 text-center font-mono font-bold">
                    {stat.bestScore > 0 ? stat.bestScore.toLocaleString() : '-'}
                  </td>
                  <td className="px-4 py-3 text-center text-sm">
                    {stat.daysSinceLastEntry !== null ? (
                      <span
                        style={{
                          color: stat.daysSinceLastEntry > 14 ? "#ef4444" : 
                                 stat.daysSinceLastEntry > 7 ? "#f59e0b" : 
                                 "#10b981"
                        }}
                      >
                        {stat.daysSinceLastEntry}d ago
                      </span>
                    ) : (
                      <span style={{ color: "var(--color-muted)" }}>Never</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-center gap-1">
                      {stat.weeklyActivity.map((score, i) => (
                        <div
                          key={i}
                          className="w-6 h-6 rounded"
                          style={{
                            backgroundColor: 
                              score > 0 ? "rgba(16, 185, 129, 0.5)" : "rgba(128, 128, 128, 0.2)",
                          }}
                          title={score > 0 ? `Score: ${score}` : 'No entry'}
                        />
                      ))}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {sortedStats.length === 0 && (
        <div className="text-center py-8" style={{ color: "var(--color-muted)" }}>
          No members found
        </div>
      )}
    </div>
  );
}
