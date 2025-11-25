"use client";

import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import { FaArrowLeft, FaTrophy, FaChartLine, FaCalendarAlt, FaExclamationTriangle, FaCheckCircle } from "react-icons/fa";
import Sidebar from "../../../components/Sidebar";
import { supabase } from "../../../../lib/supabaseClient";

interface Member {
  id: string;
  name: string;
  role?: string;
  created_at?: string;
  kicked?: boolean;
}

interface PerformanceData {
  totalEvents: number;
  attendanceRate: number;
  averageScore: number;
  highestScore: number;
  lowestScore: number;
  recentAverage: number; // last 7 days
  previousAverage: number; // 7-14 days ago
  improvement: number; // percentage change
  castleRushAttendance: number;
  adventAttendance: number;
  castleRushEvents: number;
  adventEvents: number;
  daysSinceLastActive: number | null;
  scoreHistory: { date: string; score: number; type: string }[];
  weeklyActivity: number[];
}

export default function MemberProfilePage() {
  const router = useRouter();
  const params = useParams();
  const memberId = params.id as string;

  const [member, setMember] = useState<Member | null>(null);
  const [performance, setPerformance] = useState<PerformanceData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (memberId) {
      loadMember();
    }
  }, [memberId]);

  async function loadMember() {
    setLoading(true);
    try {
      // Fetch member and performance data in parallel
      const [memberRes, perfData] = await Promise.all([
        supabase.from('members').select('id, name, role, created_at, kicked').eq('id', memberId).single(),
        loadPerformanceData(memberId)
      ]);

      if (memberRes.error && memberRes.error.code !== 'PGRST116') throw memberRes.error;
      setMember(memberRes.data || null);
      setPerformance(perfData);
    } catch (err) {
      // Error loading member
    } finally {
      setLoading(false);
    }
  }

  async function loadPerformanceData(id: string): Promise<PerformanceData> {
    try {
      // Fetch both entry types in parallel
      const [crRes, aeRes] = await Promise.all([
        supabase
          .from('castle_rush_entry')
          .select('attendance, score, castle_rush!inner(date)')
          .eq('member_id', id)
          .order('castle_rush(date)', { ascending: false })
          .limit(100),
        supabase
          .from('advent_expedition_entry')
          .select('attendance, total_score, date')
          .eq('member_id', id)
          .order('date', { ascending: false })
          .limit(100)
      ]);

      const crEntries = (crRes.data || []).map((e: any) => ({
        attendance: e.attendance,
        score: e.score,
        date: e.castle_rush.date,
        type: 'Castle Rush'
      }));

      const aeEntries = (aeRes.data || []).map((e: any) => ({
        attendance: e.attendance,
        score: e.total_score,
        date: e.date,
        type: 'Advent'
      }));

      const allEntries = [...crEntries, ...aeEntries];
      const attendedEntries = allEntries.filter(e => e.attendance);

      // Calculate metrics
      const totalEvents = allEntries.length;
      const attendanceRate = totalEvents > 0 ? (attendedEntries.length / totalEvents) * 100 : 0;
      const scores = attendedEntries.map(e => e.score);
      const averageScore = scores.length > 0 ? scores.reduce((a, b) => a + b, 0) / scores.length : 0;
      const highestScore = scores.length > 0 ? Math.max(...scores) : 0;
      const lowestScore = scores.length > 0 ? Math.min(...scores) : 0;

      // Recent performance (last 7 days)
      const now = new Date();
      const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      const fourteenDaysAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);

      const recentEntries = attendedEntries.filter(e => new Date(e.date) >= sevenDaysAgo);
      const previousEntries = attendedEntries.filter(e => {
        const d = new Date(e.date);
        return d >= fourteenDaysAgo && d < sevenDaysAgo;
      });

      const recentScores = recentEntries.map(e => e.score);
      const previousScores = previousEntries.map(e => e.score);

      const recentAverage = recentScores.length > 0 ? recentScores.reduce((a, b) => a + b, 0) / recentScores.length : 0;
      const previousAverage = previousScores.length > 0 ? previousScores.reduce((a, b) => a + b, 0) / previousScores.length : 0;

      const improvement = previousAverage > 0 ? ((recentAverage - previousAverage) / previousAverage) * 100 : 0;

      // Event type breakdown
      const crAttended = crEntries.filter((e: any) => e.attendance).length;
      const aeAttended = aeEntries.filter((e: any) => e.attendance).length;
      const crAttendanceRate = crEntries.length > 0 ? (crAttended / crEntries.length) * 100 : 0;
      const aeAttendanceRate = aeEntries.length > 0 ? (aeAttended / aeEntries.length) * 100 : 0;

      // Last active
      const sortedEntries = attendedEntries.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      const lastEntry = sortedEntries[0];
      const daysSinceLastActive = lastEntry ? Math.floor((now.getTime() - new Date(lastEntry.date).getTime()) / (1000 * 60 * 60 * 24)) : null;

      // Score history (last 30 entries)
      const scoreHistory = attendedEntries
        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
        .slice(0, 30)
        .reverse()
        .map(e => ({ date: e.date, score: e.score, type: e.type }));

      // Weekly activity (last 7 days)
      const weeklyActivity = Array(7).fill(0);
      for (let i = 0; i < 7; i++) {
        const dayStart = new Date(now.getTime() - (6 - i) * 24 * 60 * 60 * 1000);
        dayStart.setHours(0, 0, 0, 0);
        const dayEnd = new Date(dayStart);
        dayEnd.setHours(23, 59, 59, 999);
        
        const dayEntries = attendedEntries.filter(e => {
          const entryDate = new Date(e.date);
          return entryDate >= dayStart && entryDate <= dayEnd;
        });
        weeklyActivity[i] = dayEntries.length;
      }

      return {
        totalEvents,
        attendanceRate,
        averageScore,
        highestScore,
        lowestScore,
        recentAverage,
        previousAverage,
        improvement,
        castleRushAttendance: crAttendanceRate,
        adventAttendance: aeAttendanceRate,
        castleRushEvents: crEntries.length,
        adventEvents: aeEntries.length,
        daysSinceLastActive,
        scoreHistory,
        weeklyActivity
      };
    } catch (err) {
      return {
        totalEvents: 0,
        attendanceRate: 0,
        averageScore: 0,
        highestScore: 0,
        lowestScore: 0,
        recentAverage: 0,
        previousAverage: 0,
        improvement: 0,
        castleRushAttendance: 0,
        adventAttendance: 0,
        castleRushEvents: 0,
        adventEvents: 0,
        daysSinceLastActive: null,
        scoreHistory: [],
        weeklyActivity: []
      };
    }
  }

  const handleBack = () => {
    router.push('/dashboard');
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Backspace" && (e.target as HTMLElement).tagName !== "INPUT" && (e.target as HTMLElement).tagName !== "TEXTAREA") {
        e.preventDefault();
        handleBack();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  if (loading) {
    return (
      <Sidebar>
        <div className="p-8">
          <div className="text-sm" style={{ color: "var(--color-muted)" }}>
            Loading member profile...
          </div>
        </div>
      </Sidebar>
    );
  }

  if (!member) {
    return (
      <Sidebar>
        <div className="p-8">
          <button
            onClick={handleBack}
            className="flex items-center gap-2 px-4 py-2 rounded mb-4"
            style={{
              backgroundColor: "var(--color-primary)",
              color: "white",
            }}
          >
            <FaArrowLeft />
            Back
          </button>
          <div className="text-sm" style={{ color: "var(--color-alert)" }}>
            Member not found
          </div>
        </div>
      </Sidebar>
    );
  }

  const formatScore = (score: number) => {
    if (score >= 1000000) return `${(score / 1000000).toFixed(1)}M`;
    if (score >= 1000) return `${(score / 1000).toFixed(1)}K`;
    return score.toFixed(0);
  };

  const getImprovementColor = (improvement: number) => {
    if (improvement > 10) return "#10b981"; // green
    if (improvement > 0) return "#3b82f6"; // blue
    if (improvement > -10) return "#f59e0b"; // orange
    return "#ef4444"; // red
  };

  const getImprovementIcon = (improvement: number) => {
    if (improvement > 0) return "↗";
    if (improvement < 0) return "↘";
    return "→";
  };

  return (
    <Sidebar>
      <div className="p-8">
        <button
          onClick={handleBack}
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

        {/* Header Section */}
        <div
          className="p-6 rounded-lg mb-6"
          style={{
            backgroundColor: "var(--color-surface)",
            border: "1px solid var(--color-border)",
          }}
        >
          <div className="flex items-start justify-between mb-4">
            <div>
              <h1 className="text-3xl font-bold mb-2">{member.name}</h1>
              <div className="flex items-center gap-4 text-sm">
                <span style={{ color: "var(--color-muted)" }}>
                  {member.role || "Member"}
                </span>
                <span>
                  {member.kicked ? (
                    <span className="flex items-center gap-1" style={{ color: "var(--color-alert)" }}>
                      <FaExclamationTriangle size={12} />
                      Kicked
                    </span>
                  ) : (
                    <span className="flex items-center gap-1" style={{ color: "#10b981" }}>
                      <FaCheckCircle size={12} />
                      Active
                    </span>
                  )}
                </span>
                {member.created_at && (
                  <span style={{ color: "var(--color-muted)" }}>
                    <FaCalendarAlt size={12} className="inline mr-1" />
                    Joined {new Date(member.created_at).toLocaleDateString()}
                  </span>
                )}
              </div>
            </div>

            {/* Performance Indicator */}
            {performance && performance.totalEvents > 0 && (
              <div
                className="px-6 py-4 rounded-lg text-center"
                style={{
                  backgroundColor: "rgba(var(--color-primary-rgb, 59, 130, 246), 0.1)",
                  border: `2px solid ${getImprovementColor(performance.improvement)}`,
                }}
              >
                <div className="text-xs mb-1" style={{ color: "var(--color-muted)" }}>
                  7-Day Trend
                </div>
                <div
                  className="text-3xl font-bold flex items-center gap-2"
                  style={{ color: getImprovementColor(performance.improvement) }}
                >
                  <span>{getImprovementIcon(performance.improvement)}</span>
                  <span>{Math.abs(performance.improvement).toFixed(1)}%</span>
                </div>
                <div className="text-xs mt-1" style={{ color: "var(--color-muted)" }}>
                  {performance.improvement > 0 ? "Improving" : performance.improvement < 0 ? "Declining" : "Stable"}
                </div>
              </div>
            )}
          </div>

          {/* Last Active Alert */}
          {performance && performance.daysSinceLastActive !== null && performance.daysSinceLastActive > 3 && (
            <div
              className="p-3 rounded flex items-center gap-2 text-sm"
              style={{
                backgroundColor: "rgba(239, 68, 68, 0.1)",
                border: "1px solid #ef4444",
                color: "#ef4444",
              }}
            >
              <FaExclamationTriangle />
              <span>Inactive for {performance.daysSinceLastActive} days</span>
            </div>
          )}
        </div>

        {/* Performance Stats Grid */}
        {performance && performance.totalEvents > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            {/* Attendance Card */}
            <div
              className="p-4 rounded-lg"
              style={{
                backgroundColor: "var(--color-surface)",
                border: "1px solid var(--color-border)",
              }}
            >
              <div className="flex items-center gap-2 mb-3">
                <FaCalendarAlt style={{ color: "#3b82f6" }} />
                <span className="text-sm font-medium">Attendance</span>
              </div>
              <div className="text-3xl font-bold mb-2">
                {performance.attendanceRate.toFixed(1)}%
              </div>
              <div className="text-xs mb-2" style={{ color: "var(--color-muted)" }}>
                {performance.totalEvents} total events
              </div>
              <div className="space-y-1">
                <div className="flex justify-between text-xs">
                  <span style={{ color: "var(--color-muted)" }}>Castle Rush</span>
                  <span>{performance.castleRushAttendance.toFixed(0)}%</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span style={{ color: "var(--color-muted)" }}>Advent</span>
                  <span>{performance.adventAttendance.toFixed(0)}%</span>
                </div>
              </div>
            </div>

            {/* Average Score Card */}
            <div
              className="p-4 rounded-lg"
              style={{
                backgroundColor: "var(--color-surface)",
                border: "1px solid var(--color-border)",
              }}
            >
              <div className="flex items-center gap-2 mb-3">
                <FaChartLine style={{ color: "#8b5cf6" }} />
                <span className="text-sm font-medium">Average Score</span>
              </div>
              <div className="text-3xl font-bold mb-2">
                {formatScore(performance.averageScore)}
              </div>
              <div className="text-xs mb-2" style={{ color: "var(--color-muted)" }}>
                All-time average
              </div>
              <div className="space-y-1">
                <div className="flex justify-between text-xs">
                  <span style={{ color: "var(--color-muted)" }}>Recent (7d)</span>
                  <span style={{ color: getImprovementColor(performance.improvement) }}>
                    {formatScore(performance.recentAverage)}
                  </span>
                </div>
                <div className="flex justify-between text-xs">
                  <span style={{ color: "var(--color-muted)" }}>Previous (7d)</span>
                  <span>{formatScore(performance.previousAverage)}</span>
                </div>
              </div>
            </div>

            {/* Peak Performance Card */}
            <div
              className="p-4 rounded-lg"
              style={{
                backgroundColor: "var(--color-surface)",
                border: "1px solid var(--color-border)",
              }}
            >
              <div className="flex items-center gap-2 mb-3">
                <FaTrophy style={{ color: "#f59e0b" }} />
                <span className="text-sm font-medium">Peak Performance</span>
              </div>
              <div className="text-3xl font-bold mb-2">
                {formatScore(performance.highestScore)}
              </div>
              <div className="text-xs mb-2" style={{ color: "var(--color-muted)" }}>
                Personal best
              </div>
              <div className="space-y-1">
                <div className="flex justify-between text-xs">
                  <span style={{ color: "var(--color-muted)" }}>Lowest</span>
                  <span>{formatScore(performance.lowestScore)}</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span style={{ color: "var(--color-muted)" }}>Range</span>
                  <span>{formatScore(performance.highestScore - performance.lowestScore)}</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Weekly Activity Heatmap */}
        {performance && performance.weeklyActivity.length > 0 && (
          <div
            className="p-4 rounded-lg mb-6"
            style={{
              backgroundColor: "var(--color-surface)",
              border: "1px solid var(--color-border)",
            }}
          >
            <h3 className="text-sm font-medium mb-3">Weekly Activity</h3>
            <div className="flex gap-2">
              {performance.weeklyActivity.map((count, idx) => {
                const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
                const today = new Date().getDay();
                const dayIdx = (today - 6 + idx + 7) % 7;
                
                return (
                  <div key={idx} className="flex-1 text-center">
                    <div className="text-xs mb-1" style={{ color: "var(--color-muted)" }}>
                      {dayNames[dayIdx]}
                    </div>
                    <div
                      className="h-12 rounded flex items-center justify-center font-bold"
                      style={{
                        backgroundColor: count === 0 ? "rgba(100, 100, 100, 0.1)" : 
                                       count === 1 ? "rgba(59, 130, 246, 0.3)" : 
                                       count === 2 ? "rgba(59, 130, 246, 0.6)" : 
                                       "rgba(59, 130, 246, 0.9)",
                        color: count > 0 ? "white" : "var(--color-muted)",
                      }}
                    >
                      {count}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Score History Chart */}
        {performance && performance.scoreHistory.length > 0 && (
          <div
            className="p-4 rounded-lg mb-6"
            style={{
              backgroundColor: "var(--color-surface)",
              border: "1px solid var(--color-border)",
            }}
          >
            <h3 className="text-sm font-medium mb-3">Score History (Last 30 Events)</h3>
            <div className="relative h-48">
              <div className="absolute inset-0 flex items-end gap-1">
                {performance.scoreHistory.map((entry, idx) => {
                  const maxScore = Math.max(...performance.scoreHistory.map(e => e.score));
                  const height = maxScore > 0 ? (entry.score / maxScore) * 100 : 0;
                  const isCR = entry.type === 'Castle Rush';
                  
                  return (
                    <div
                      key={idx}
                      className="flex-1 rounded-t transition-all hover:opacity-80 cursor-pointer group relative"
                      style={{
                        height: `${height}%`,
                        backgroundColor: isCR ? "#3b82f6" : "#8b5cf6",
                        minHeight: height > 0 ? "4px" : "0",
                      }}
                      title={`${entry.type} - ${new Date(entry.date).toLocaleDateString()}: ${formatScore(entry.score)}`}
                    >
                      <div
                        className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-2 py-1 rounded text-xs whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10"
                        style={{
                          backgroundColor: "rgba(0, 0, 0, 0.9)",
                          color: "white",
                        }}
                      >
                        <div>{entry.type}</div>
                        <div>{new Date(entry.date).toLocaleDateString()}</div>
                        <div className="font-bold">{formatScore(entry.score)}</div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
            <div className="flex gap-4 mt-4 text-xs">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded" style={{ backgroundColor: "#3b82f6" }} />
                <span style={{ color: "var(--color-muted)" }}>Castle Rush</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded" style={{ backgroundColor: "#8b5cf6" }} />
                <span style={{ color: "var(--color-muted)" }}>Advent Expedition</span>
              </div>
            </div>
          </div>
        )}

        {/* No Data State */}
        {performance && performance.totalEvents === 0 && (
          <div
            className="p-6 rounded-lg text-center"
            style={{
              backgroundColor: "var(--color-surface)",
              border: "1px solid var(--color-border)",
            }}
          >
            <FaChartLine size={48} style={{ color: "var(--color-muted)", margin: "0 auto 16px" }} />
            <div className="text-lg font-medium mb-2">No Performance Data</div>
            <div className="text-sm" style={{ color: "var(--color-muted)" }}>
              This member hasn't participated in any events yet.
            </div>
          </div>
        )}
      </div>
    </Sidebar>
  );
}
