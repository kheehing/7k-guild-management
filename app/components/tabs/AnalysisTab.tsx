"use client";

import React, { useEffect, useState, useMemo } from "react";
import { supabase } from "../../../lib/supabaseClient";
import { FaChartLine, FaUsers, FaTrophy, FaExclamationTriangle, FaCheckCircle, FaTimesCircle } from "react-icons/fa";

interface Member {
  id: string;
  name: string;
  role?: string;
  kicked?: boolean;
  created_at?: string;
}

interface MemberStats {
  memberId: string;
  memberName: string;
  role: string;
  kicked: boolean;
  totalEntries: number;
  attendanceRate: number;
  averageScore: number;
  scoreBreakdown: string;
  lastEntry: string | null;
  daysSinceLastEntry: number | null;
  weeklyActivity: number[];
  castleRushEntries: number;
  adventEntries: number;
  castleRushAttendance: number;
  adventAttendance: number;
  highestScore: number;
  lowestScore: number;
  consistency: number; // score variance
}

interface GuildMetrics {
  totalActiveMembers: number;
  averageAttendanceRate: number;
  topPerformers: MemberStats[];
  atRiskMembers: MemberStats[];
  recentInactiveMembers: MemberStats[];
  consistentPerformers: MemberStats[];
  guildAverageScore: number;
  totalEvents: number;
  overallParticipationRate: number;
}

export default function AnalysisTab() {
  const [stats, setStats] = useState<MemberStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [sortBy, setSortBy] = useState<'attendance' | 'average' | 'activity' | 'consistency'>('attendance');
  const [viewMode, setViewMode] = useState<'table' | 'insights'>('insights');
  const [filterCategory, setFilterCategory] = useState<'all' | 'top' | 'atrisk' | 'inactive'>('all');

  useEffect(() => {
    loadAnalysis();
  }, []);

  async function loadAnalysis() {
    setLoading(true);
    try {
      // Fetch all data in parallel
      const [membersRes, crRes, aeRes] = await Promise.all([
        supabase.from('members').select('id, name, role, kicked, created_at').order('created_at', { ascending: false }),
        supabase.from('castle_rush_entry').select('member_id, attendance, score, castle_rush!inner(date)'),
        supabase.from('advent_expedition_entry').select('member_id, attendance, total_score, date')
      ]);
      
      if (membersRes.error) throw membersRes.error;
      const members: Member[] = membersRes.data || [];

      if (crRes.error) throw crRes.error;
      if (aeRes.error) throw aeRes.error;

      // Separate entries by type
      const crEntries = (crRes.data || []).map((e: any) => ({
        member_id: e.member_id,
        attendance: e.attendance,
        score: e.score,
        date: e.castle_rush.date,
        type: 'castle_rush'
      }));

      const aeEntries = (aeRes.data || []).map((e: any) => ({
        member_id: e.member_id,
        attendance: e.attendance,
        score: e.total_score,
        date: e.date,
        type: 'advent'
      }));

      const allEntries = [...crEntries, ...aeEntries];

      // Compute comprehensive stats per member
      const computed: MemberStats[] = members
        .filter((m) => !m.kicked)
        .map((m) => {
          const memberEntries = allEntries.filter((e: any) => e.member_id === m.id);
          const crMemberEntries = crEntries.filter((e: any) => e.member_id === m.id);
          const aeMemberEntries = aeEntries.filter((e: any) => e.member_id === m.id);

          // Sort by date descending
          const sorted = memberEntries.sort((a: any, b: any) => {
            const dateA = new Date(a.date).getTime();
            const dateB = new Date(b.date).getTime();
            return dateB - dateA;
          });

          // Last 7 days for average score
          const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
          const last7DaysEntries = sorted.filter((e: any) => {
            const entryDate = new Date(e.date).getTime();
            return entryDate >= sevenDaysAgo;
          });

          const scoresLast7Days = last7DaysEntries.map((e: any) => e.score ?? 0);
          const averageScore =
            scoresLast7Days.length > 0
              ? scoresLast7Days.reduce((sum, s) => sum + s, 0) / scoresLast7Days.length
              : 0;

          // Score statistics
          const allScores = memberEntries.map((e: any) => e.score ?? 0).filter(s => s > 0);
          const highestScore = allScores.length > 0 ? Math.max(...allScores) : 0;
          const lowestScore = allScores.length > 0 ? Math.min(...allScores) : 0;
          
          // Consistency (lower variance = more consistent)
          const variance = allScores.length > 1
            ? allScores.reduce((sum, score) => {
                const diff = score - (allScores.reduce((a, b) => a + b, 0) / allScores.length);
                return sum + diff * diff;
              }, 0) / allScores.length
            : 0;
          const consistency = allScores.length > 1 ? Math.max(0, 100 - Math.sqrt(variance) / 10) : 0;

          // Build breakdown tooltip text
          const scoreBreakdown =
            scoresLast7Days.length > 0
              ? `(${scoresLast7Days.join(' + ')}) / ${scoresLast7Days.length} = ${averageScore.toFixed(0)}`
              : "No entries in last 7 days";

          // Attendance rate
          const attendedCount = memberEntries.filter((e: any) => e.attendance).length;
          const attendanceRate =
            memberEntries.length > 0 ? (attendedCount / memberEntries.length) * 100 : 0;

          // Castle Rush vs Advent specific rates
          const crAttendedCount = crMemberEntries.filter((e: any) => e.attendance).length;
          const crAttendanceRate = crMemberEntries.length > 0 ? (crAttendedCount / crMemberEntries.length) * 100 : 0;
          
          const aeAttendedCount = aeMemberEntries.filter((e: any) => e.attendance).length;
          const aeAttendanceRate = aeMemberEntries.length > 0 ? (aeAttendedCount / aeMemberEntries.length) * 100 : 0;

          // Last entry date
          const lastEntry = sorted.length > 0 ? sorted[0].date : null;
          let daysSinceLastEntry: number | null = null;
          if (lastEntry) {
            const diffMs = Date.now() - new Date(lastEntry).getTime();
            daysSinceLastEntry = Math.floor(diffMs / (1000 * 60 * 60 * 24));
          }

          // Weekly activity (last 7 days, count attendance=true only)
          const now = Date.now();
          const weeklyActivity = Array(7).fill(0);
          memberEntries.forEach((e: any) => {
            if (!e.attendance) return;
            const entryDate = new Date(e.date).getTime();
            const dayDiff = Math.floor((now - entryDate) / (1000 * 60 * 60 * 24));
            if (dayDiff >= 0 && dayDiff < 7) {
              weeklyActivity[6 - dayDiff]++;
            }
          });

          return {
            memberId: m.id,
            memberName: m.name,
            role: m.role ?? "Member",
            kicked: m.kicked ?? false,
            totalEntries: memberEntries.length,
            attendanceRate,
            averageScore,
            scoreBreakdown,
            lastEntry,
            daysSinceLastEntry,
            weeklyActivity,
            castleRushEntries: crMemberEntries.length,
            adventEntries: aeMemberEntries.length,
            castleRushAttendance: crAttendanceRate,
            adventAttendance: aeAttendanceRate,
            highestScore,
            lowestScore,
            consistency,
          };
        });

      setStats(computed);
    } catch (err) {
      // Error loading analysis
    } finally {
      setLoading(false);
    }
  }

  // Guild-wide metrics
  const guildMetrics = useMemo<GuildMetrics>(() => {
    if (stats.length === 0) {
      return {
        totalActiveMembers: 0,
        averageAttendanceRate: 0,
        topPerformers: [],
        atRiskMembers: [],
        recentInactiveMembers: [],
        consistentPerformers: [],
        guildAverageScore: 0,
        totalEvents: 0,
        overallParticipationRate: 0,
      };
    }

    const totalActiveMembers = stats.length;
    const averageAttendanceRate = stats.reduce((sum, s) => sum + s.attendanceRate, 0) / totalActiveMembers;
    const guildAverageScore = stats.reduce((sum, s) => sum + s.averageScore, 0) / totalActiveMembers;
    
    // Top performers: High attendance (>80%) AND high average score
    const topPerformers = stats
      .filter(s => s.attendanceRate >= 80 && s.averageScore > guildAverageScore)
      .sort((a, b) => b.averageScore - a.averageScore)
      .slice(0, 5);

    // At-risk members: Low attendance (<60%) OR inactive for 3+ days
    const atRiskMembers = stats
      .filter(s => s.attendanceRate < 60 || (s.daysSinceLastEntry !== null && s.daysSinceLastEntry >= 3))
      .sort((a, b) => a.attendanceRate - b.attendanceRate)
      .slice(0, 5);

    // Recently inactive: Haven't participated in 2+ days but were previously active
    const recentInactiveMembers = stats
      .filter(s => s.daysSinceLastEntry !== null && s.daysSinceLastEntry >= 2 && s.totalEntries > 5)
      .sort((a, b) => (b.daysSinceLastEntry ?? 0) - (a.daysSinceLastEntry ?? 0))
      .slice(0, 5);

    // Consistent performers: High consistency score (low variance in scores)
    const consistentPerformers = stats
      .filter(s => s.totalEntries >= 5)
      .sort((a, b) => b.consistency - a.consistency)
      .slice(0, 5);

    const totalEvents = stats.reduce((sum, s) => sum + s.totalEntries, 0);
    const totalAttended = stats.reduce((sum, s) => sum + (s.totalEntries * s.attendanceRate / 100), 0);
    const overallParticipationRate = totalEvents > 0 ? (totalAttended / totalEvents) * 100 : 0;

    return {
      totalActiveMembers,
      averageAttendanceRate,
      topPerformers,
      atRiskMembers,
      recentInactiveMembers,
      consistentPerformers,
      guildAverageScore,
      totalEvents,
      overallParticipationRate,
    };
  }, [stats]);

  const sorted = [...stats].sort((a, b) => {
    if (sortBy === 'attendance') return b.attendanceRate - a.attendanceRate;
    if (sortBy === 'average') return b.averageScore - a.averageScore;
    if (sortBy === 'consistency') return b.consistency - a.consistency;
    const aActivity = a.weeklyActivity.reduce((s, v) => s + v, 0);
    const bActivity = b.weeklyActivity.reduce((s, v) => s + v, 0);
    return bActivity - aActivity;
  });

  // Filter based on category
  const filteredStats = useMemo(() => {
    if (filterCategory === 'all') return sorted;
    if (filterCategory === 'top') {
      return sorted.filter(s => s.attendanceRate >= 80 && s.averageScore > guildMetrics.guildAverageScore);
    }
    if (filterCategory === 'atrisk') {
      return sorted.filter(s => s.attendanceRate < 60 || (s.daysSinceLastEntry !== null && s.daysSinceLastEntry >= 3));
    }
    if (filterCategory === 'inactive') {
      return sorted.filter(s => s.daysSinceLastEntry !== null && s.daysSinceLastEntry >= 2);
    }
    return sorted;
  }, [sorted, filterCategory, guildMetrics.guildAverageScore]);

  function formatLastActive(days: number | null): string {
    if (days === null) return "-";
    if (days <= 1) return "Up to date";
    if (days < 7) return `${days}d ago`;
    const weeks = Math.floor(days / 7);
    return `${weeks}w ago`;
  }

  function getAttendanceColor(rate: number): string {
    if (rate >= 80) return "#10b981";
    if (rate >= 60) return "#f59e0b";
    return "#ef4444";
  }

  if (loading) {
    return (
      <div className="p-8 flex items-center justify-center" style={{ minHeight: "400px" }}>
        <div className="text-center">
          <div className="text-lg font-medium mb-2" style={{ color: "var(--color-foreground)" }}>
            Analyzing guild performance...
          </div>
          <div className="text-sm" style={{ color: "var(--color-muted)" }}>
            Computing individual and guild-wide metrics
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4">
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold mb-2" style={{ color: "var(--color-foreground)" }}>
            Performance Analysis
          </h1>
          <p className="text-sm" style={{ color: "var(--color-muted)" }}>
            Individual member metrics and guild-wide performance insights
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setViewMode('insights')}
            className="px-4 py-2 rounded-lg text-sm font-medium transition-all flex items-center gap-2"
            style={{
              backgroundColor: viewMode === 'insights' ? 'var(--color-primary)' : 'var(--color-surface)',
              color: viewMode === 'insights' ? 'white' : 'var(--color-foreground)',
              border: '1px solid var(--color-border)'
            }}
          >
            <FaChartLine />
            Insights
          </button>
          <button
            onClick={() => setViewMode('table')}
            className="px-4 py-2 rounded-lg text-sm font-medium transition-all flex items-center gap-2"
            style={{
              backgroundColor: viewMode === 'table' ? 'var(--color-primary)' : 'var(--color-surface)',
              color: viewMode === 'table' ? 'white' : 'var(--color-foreground)',
              border: '1px solid var(--color-border)'
            }}
          >
            <FaUsers />
            All Members
          </button>
        </div>
      </div>

      {viewMode === 'insights' ? (
        <>
          {/* Guild-Wide Metrics */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
            <div
              className="p-4 rounded-lg"
              style={{
                backgroundColor: "var(--color-surface)",
                border: "1px solid var(--color-border)",
              }}
            >
              <div className="flex items-center gap-3 mb-2">
                <div
                  className="p-2 rounded"
                  style={{ backgroundColor: "rgba(59, 130, 246, 0.1)", color: "#3b82f6" }}
                >
                  <FaUsers size={20} />
                </div>
                <div className="text-sm font-medium" style={{ color: "var(--color-muted)" }}>
                  Active Members
                </div>
              </div>
              <div className="text-3xl font-bold" style={{ color: "var(--color-foreground)" }}>
                {guildMetrics.totalActiveMembers}
              </div>
            </div>

            <div
              className="p-4 rounded-lg"
              style={{
                backgroundColor: "var(--color-surface)",
                border: "1px solid var(--color-border)",
              }}
            >
              <div className="flex items-center gap-3 mb-2">
                <div
                  className="p-2 rounded"
                  style={{ backgroundColor: "rgba(16, 185, 129, 0.1)", color: "#10b981" }}
                >
                  <FaCheckCircle size={20} />
                </div>
                <div className="text-sm font-medium" style={{ color: "var(--color-muted)" }}>
                  Guild Attendance
                </div>
              </div>
              <div className="text-3xl font-bold" style={{ color: "#10b981" }}>
                {guildMetrics.averageAttendanceRate.toFixed(0)}%
              </div>
            </div>

            <div
              className="p-4 rounded-lg"
              style={{
                backgroundColor: "var(--color-surface)",
                border: "1px solid var(--color-border)",
              }}
            >
              <div className="flex items-center gap-3 mb-2">
                <div
                  className="p-2 rounded"
                  style={{ backgroundColor: "rgba(139, 92, 246, 0.1)", color: "#8b5cf6" }}
                >
                  <FaTrophy size={20} />
                </div>
                <div className="text-sm font-medium" style={{ color: "var(--color-muted)" }}>
                  Avg Guild Score
                </div>
              </div>
              <div className="text-3xl font-bold" style={{ color: "#8b5cf6" }}>
                {guildMetrics.guildAverageScore.toFixed(0)}
              </div>
            </div>

            <div
              className="p-4 rounded-lg"
              style={{
                backgroundColor: "var(--color-surface)",
                border: "1px solid var(--color-border)",
              }}
            >
              <div className="flex items-center gap-3 mb-2">
                <div
                  className="p-2 rounded"
                  style={{ backgroundColor: "rgba(239, 68, 68, 0.1)", color: "#ef4444" }}
                >
                  <FaExclamationTriangle size={20} />
                </div>
                <div className="text-sm font-medium" style={{ color: "var(--color-muted)" }}>
                  At-Risk Members
                </div>
              </div>
              <div className="text-3xl font-bold" style={{ color: "#ef4444" }}>
                {guildMetrics.atRiskMembers.length}
              </div>
            </div>
          </div>

          {/* Insight Cards Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Top Performers */}
            <div
              className="p-5 rounded-lg"
              style={{
                backgroundColor: "var(--color-surface)",
                border: "1px solid var(--color-border)",
              }}
            >
              <div className="flex items-center gap-2 mb-4">
                <FaTrophy size={18} style={{ color: "#f59e0b" }} />
                <h3 className="text-lg font-bold" style={{ color: "var(--color-foreground)" }}>
                  Top Performers
                </h3>
              </div>
              <div className="space-y-3">
                {guildMetrics.topPerformers.length > 0 ? (
                  guildMetrics.topPerformers.map((member, idx) => (
                    <div
                      key={member.memberId}
                      className="flex items-center justify-between p-3 rounded"
                      style={{ backgroundColor: "rgba(245, 158, 11, 0.05)" }}
                    >
                      <div className="flex items-center gap-3">
                        <div
                          className="h-8 w-8 rounded-full flex items-center justify-center text-xs font-bold"
                          style={{ backgroundColor: "#f59e0b", color: "white" }}
                        >
                          {idx + 1}
                        </div>
                        <div>
                          <div className="font-medium" style={{ color: "var(--color-foreground)" }}>
                            {member.memberName}
                          </div>
                          <div className="text-xs" style={{ color: "var(--color-muted)" }}>
                            {member.role}
                          </div>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="font-bold" style={{ color: "#f59e0b" }}>
                          {member.averageScore.toFixed(0)}
                        </div>
                        <div className="text-xs" style={{ color: "var(--color-muted)" }}>
                          {member.attendanceRate.toFixed(0)}% attend
                        </div>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="text-center py-4 text-sm" style={{ color: "var(--color-muted)" }}>
                    No top performers identified yet
                  </div>
                )}
              </div>
            </div>

            {/* At-Risk Members */}
            <div
              className="p-5 rounded-lg"
              style={{
                backgroundColor: "var(--color-surface)",
                border: "1px solid var(--color-border)",
              }}
            >
              <div className="flex items-center gap-2 mb-4">
                <FaExclamationTriangle size={18} style={{ color: "#ef4444" }} />
                <h3 className="text-lg font-bold" style={{ color: "var(--color-foreground)" }}>
                  At-Risk Members
                </h3>
              </div>
              <div className="space-y-3">
                {guildMetrics.atRiskMembers.length > 0 ? (
                  guildMetrics.atRiskMembers.map((member) => (
                    <div
                      key={member.memberId}
                      className="flex items-center justify-between p-3 rounded"
                      style={{ backgroundColor: "rgba(239, 68, 68, 0.05)" }}
                    >
                      <div>
                        <div className="font-medium" style={{ color: "var(--color-foreground)" }}>
                          {member.memberName}
                        </div>
                        <div className="text-xs" style={{ color: "var(--color-muted)" }}>
                          {member.daysSinceLastEntry !== null && member.daysSinceLastEntry >= 3
                            ? `Inactive ${member.daysSinceLastEntry}d`
                            : `Low attendance: ${member.attendanceRate.toFixed(0)}%`}
                        </div>
                      </div>
                      <div className="text-right">
                        <div
                          className="text-sm font-bold px-2 py-1 rounded"
                          style={{ backgroundColor: "#ef4444", color: "white" }}
                        >
                          {member.attendanceRate.toFixed(0)}%
                        </div>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="text-center py-4 text-sm" style={{ color: "var(--color-muted)" }}>
                    All members performing well! 🎉
                  </div>
                )}
              </div>
            </div>

            {/* Consistent Performers */}
            <div
              className="p-5 rounded-lg"
              style={{
                backgroundColor: "var(--color-surface)",
                border: "1px solid var(--color-border)",
              }}
            >
              <div className="flex items-center gap-2 mb-4">
                <FaCheckCircle size={18} style={{ color: "#10b981" }} />
                <h3 className="text-lg font-bold" style={{ color: "var(--color-foreground)" }}>
                  Most Consistent
                </h3>
              </div>
              <div className="space-y-3">
                {guildMetrics.consistentPerformers.length > 0 ? (
                  guildMetrics.consistentPerformers.map((member) => (
                    <div
                      key={member.memberId}
                      className="flex items-center justify-between p-3 rounded"
                      style={{ backgroundColor: "rgba(16, 185, 129, 0.05)" }}
                    >
                      <div>
                        <div className="font-medium" style={{ color: "var(--color-foreground)" }}>
                          {member.memberName}
                        </div>
                        <div className="text-xs" style={{ color: "var(--color-muted)" }}>
                          {member.totalEntries} entries • {member.attendanceRate.toFixed(0)}% attend
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-sm font-bold" style={{ color: "#10b981" }}>
                          {member.consistency.toFixed(0)}
                        </div>
                        <div className="text-xs" style={{ color: "var(--color-muted)" }}>
                          consistency
                        </div>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="text-center py-4 text-sm" style={{ color: "var(--color-muted)" }}>
                    Need more data to identify consistent performers
                  </div>
                )}
              </div>
            </div>

            {/* Recently Inactive */}
            <div
              className="p-5 rounded-lg"
              style={{
                backgroundColor: "var(--color-surface)",
                border: "1px solid var(--color-border)",
              }}
            >
              <div className="flex items-center gap-2 mb-4">
                <FaTimesCircle size={18} style={{ color: "#f59e0b" }} />
                <h3 className="text-lg font-bold" style={{ color: "var(--color-foreground)" }}>
                  Recently Inactive
                </h3>
              </div>
              <div className="space-y-3">
                {guildMetrics.recentInactiveMembers.length > 0 ? (
                  guildMetrics.recentInactiveMembers.map((member) => (
                    <div
                      key={member.memberId}
                      className="flex items-center justify-between p-3 rounded"
                      style={{ backgroundColor: "rgba(245, 158, 11, 0.05)" }}
                    >
                      <div>
                        <div className="font-medium" style={{ color: "var(--color-foreground)" }}>
                          {member.memberName}
                        </div>
                        <div className="text-xs" style={{ color: "var(--color-muted)" }}>
                          {member.totalEntries} total entries
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-sm font-bold" style={{ color: "#f59e0b" }}>
                          {member.daysSinceLastEntry}d
                        </div>
                        <div className="text-xs" style={{ color: "var(--color-muted)" }}>
                          since active
                        </div>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="text-center py-4 text-sm" style={{ color: "var(--color-muted)" }}>
                    All members are active! 🔥
                  </div>
                )}
              </div>
            </div>
          </div>
        </>
      ) : (
        <>
          {/* Table View Controls */}
          <div className="mb-4 flex items-center justify-between flex-wrap gap-4">
            <div className="flex gap-2">
              <button
                onClick={() => setFilterCategory('all')}
                className={`px-3 py-1.5 rounded text-sm font-medium transition-all`}
                style={{
                  backgroundColor: filterCategory === 'all' ? 'var(--color-primary)' : 'var(--color-surface)',
                  color: filterCategory === 'all' ? 'white' : 'var(--color-foreground)',
                  border: '1px solid var(--color-border)',
                }}
              >
                All ({stats.length})
              </button>
              <button
                onClick={() => setFilterCategory('top')}
                className="px-3 py-1.5 rounded text-sm font-medium transition-all"
                style={{
                  backgroundColor: filterCategory === 'top' ? '#f59e0b' : 'var(--color-surface)',
                  color: filterCategory === 'top' ? 'white' : 'var(--color-foreground)',
                  border: '1px solid var(--color-border)',
                }}
              >
                Top Performers
              </button>
              <button
                onClick={() => setFilterCategory('atrisk')}
                className="px-3 py-1.5 rounded text-sm font-medium transition-all"
                style={{
                  backgroundColor: filterCategory === 'atrisk' ? '#ef4444' : 'var(--color-surface)',
                  color: filterCategory === 'atrisk' ? 'white' : 'var(--color-foreground)',
                  border: '1px solid var(--color-border)',
                }}
              >
                At-Risk
              </button>
              <button
                onClick={() => setFilterCategory('inactive')}
                className="px-3 py-1.5 rounded text-sm font-medium transition-all"
                style={{
                  backgroundColor: filterCategory === 'inactive' ? '#f59e0b' : 'var(--color-surface)',
                  color: filterCategory === 'inactive' ? 'white' : 'var(--color-foreground)',
                  border: '1px solid var(--color-border)',
                }}
              >
                Inactive
              </button>
            </div>
            
            <div className="flex gap-2">
              <button
                onClick={() => setSortBy('attendance')}
                className="px-4 py-2 rounded-lg text-sm font-medium transition-all"
                style={{
                  backgroundColor: sortBy === 'attendance' ? 'var(--color-primary)' : 'var(--color-surface)',
                  color: sortBy === 'attendance' ? 'white' : 'var(--color-foreground)',
                  border: '1px solid var(--color-border)'
                }}
              >
                Attendance
              </button>
              <button
                onClick={() => setSortBy('average')}
                className="px-4 py-2 rounded-lg text-sm font-medium transition-all"
                style={{
                  backgroundColor: sortBy === 'average' ? 'var(--color-primary)' : 'var(--color-surface)',
                  color: sortBy === 'average' ? 'white' : 'var(--color-foreground)',
                  border: '1px solid var(--color-border)'
                }}
              >
                Avg Score
              </button>
              <button
                onClick={() => setSortBy('consistency')}
                className="px-4 py-2 rounded-lg text-sm font-medium transition-all"
                style={{
                  backgroundColor: sortBy === 'consistency' ? 'var(--color-primary)' : 'var(--color-surface)',
                  color: sortBy === 'consistency' ? 'white' : 'var(--color-foreground)',
                  border: '1px solid var(--color-border)'
                }}
              >
                Consistency
              </button>
              <button
                onClick={() => setSortBy('activity')}
                className="px-4 py-2 rounded-lg text-sm font-medium transition-all"
                style={{
                  backgroundColor: sortBy === 'activity' ? 'var(--color-primary)' : 'var(--color-surface)',
                  color: sortBy === 'activity' ? 'white' : 'var(--color-foreground)',
                  border: '1px solid var(--color-border)'
                }}
              >
                Activity
              </button>
            </div>
          </div>

          {/* Member Details Table */}
          <div
            className="rounded-lg overflow-hidden"
            style={{
              backgroundColor: "var(--color-surface)",
              border: "1px solid var(--color-border)",
            }}
          >
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr style={{ backgroundColor: "rgba(0,0,0,0.02)", borderBottom: "1px solid var(--color-border)" }}>
                    <th className="text-left p-4 font-semibold text-sm">Member</th>
                    <th className="text-left p-4 font-semibold text-sm">Role</th>
                    <th className="text-center p-4 font-semibold text-sm">Events</th>
                    <th className="text-center p-4 font-semibold text-sm">Attendance</th>
                    <th className="text-center p-4 font-semibold text-sm">Avg Score (7d)</th>
                    <th className="text-center p-4 font-semibold text-sm">CR / AE</th>
                    <th className="text-center p-4 font-semibold text-sm">Consistency</th>
                    <th className="text-center p-4 font-semibold text-sm">Last Active</th>
                    <th className="text-left p-4 font-semibold text-sm">Weekly Activity</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredStats.map((s, idx) => (
                    <tr
                      key={s.memberId}
                      className="transition-colors hover:bg-opacity-50"
                      style={{
                        borderBottom: idx < filteredStats.length - 1 ? "1px solid var(--color-border)" : "none",
                        backgroundColor: "transparent"
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.backgroundColor = "rgba(0,0,0,0.02)";
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.backgroundColor = "transparent";
                      }}
                    >
                      <td className="p-4">
                        <div className="flex items-center gap-3">
                          <div
                            className="h-10 w-10 rounded-full flex items-center justify-center text-sm font-medium"
                            style={{ backgroundColor: "var(--seed-4)", color: "var(--color-foreground)" }}
                          >
                            {s.memberName.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <div className="font-medium">{s.memberName}</div>
                          </div>
                        </div>
                      </td>
                      <td className="p-4">
                        <span
                          className="px-2 py-1 rounded text-xs font-medium"
                          style={{ backgroundColor: "rgba(0,0,0,0.03)", color: "var(--color-muted)" }}
                        >
                          {s.role}
                        </span>
                      </td>
                      <td className="p-4 text-center">
                        <div className="font-medium">{s.totalEntries}</div>
                        <div className="text-xs" style={{ color: "var(--color-muted)" }}>
                          CR:{s.castleRushEntries} AE:{s.adventEntries}
                        </div>
                      </td>
                      <td className="p-4 text-center">
                        <div className="flex items-center justify-center gap-2">
                          <div
                            className="h-2 w-16 rounded-full overflow-hidden"
                            style={{ backgroundColor: "rgba(0,0,0,0.06)" }}
                          >
                            <div
                              className="h-full"
                              style={{
                                width: `${s.attendanceRate}%`,
                                backgroundColor: getAttendanceColor(s.attendanceRate)
                              }}
                            />
                          </div>
                          <span className="text-sm font-medium" style={{ color: getAttendanceColor(s.attendanceRate) }}>
                            {s.attendanceRate.toFixed(0)}%
                          </span>
                        </div>
                      </td>
                      <td className="p-4 text-center">
                        <span
                          className="font-mono font-medium cursor-help relative group"
                          title={s.scoreBreakdown}
                        >
                          {s.averageScore > 0 ? s.averageScore.toFixed(0) : "-"}
                          <span
                            className="invisible group-hover:visible absolute left-1/2 -translate-x-1/2 bottom-full mb-2 px-3 py-2 text-xs rounded whitespace-nowrap z-10"
                            style={{
                              backgroundColor: "var(--color-surface)",
                              border: "1px solid var(--color-border)",
                              color: "var(--color-foreground)",
                              boxShadow: "0 4px 12px rgba(0,0,0,0.15)"
                            }}
                          >
                            {s.scoreBreakdown}
                          </span>
                        </span>
                      </td>
                      <td className="p-4 text-center">
                        <div className="text-xs space-y-1">
                          <div style={{ color: "var(--color-foreground)" }}>
                            CR: <span className="font-medium">{s.castleRushAttendance.toFixed(0)}%</span>
                          </div>
                          <div style={{ color: "var(--color-foreground)" }}>
                            AE: <span className="font-medium">{s.adventAttendance.toFixed(0)}%</span>
                          </div>
                        </div>
                      </td>
                      <td className="p-4 text-center">
                        <div
                          className="inline-block px-2 py-1 rounded text-sm font-medium"
                          style={{
                            backgroundColor: s.consistency >= 70 ? "rgba(16, 185, 129, 0.1)" : "rgba(245, 158, 11, 0.1)",
                            color: s.consistency >= 70 ? "#10b981" : "#f59e0b"
                          }}
                        >
                          {s.consistency > 0 ? s.consistency.toFixed(0) : "-"}
                        </div>
                      </td>
                      <td className="p-4 text-center">
                        <span
                          className="text-sm px-2 py-1 rounded"
                          style={{
                            backgroundColor: s.daysSinceLastEntry && s.daysSinceLastEntry <= 1 ? "rgba(16,185,129,0.1)" : "rgba(0,0,0,0.03)",
                            color: s.daysSinceLastEntry && s.daysSinceLastEntry <= 1 ? "#10b981" : "var(--color-muted)"
                          }}
                        >
                          {formatLastActive(s.daysSinceLastEntry)}
                        </span>
                      </td>
                      <td className="p-4">
                        <div className="flex gap-1">
                          {s.weeklyActivity.map((count, i) => (
                            <div
                              key={i}
                              className="w-7 h-7 rounded"
                              style={{
                                backgroundColor:
                                  count === 0
                                    ? "rgba(200,200,200,0.15)"
                                    : `rgba(139,92,246,${Math.min(count / 3, 1)})`,
                              }}
                              title={`Day ${i + 1}: ${count} attended`}
                            />
                          ))}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {filteredStats.length === 0 && (
            <div className="text-center py-8 text-sm" style={{ color: "var(--color-muted)" }}>
              No members found in this category
            </div>
          )}
        </>
      )}
    </div>
  );
}
