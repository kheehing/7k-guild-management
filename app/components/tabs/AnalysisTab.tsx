"use client";

import React, { useEffect, useState, useMemo } from "react";
import { supabase } from "../../../lib/supabaseClient";
import { FaChartLine, FaUsers, FaTrophy, FaExclamationTriangle, FaCheckCircle, FaTimesCircle, FaTimes } from "react-icons/fa";

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
  riskScore: number;
  bestCastleScores?: { [castle: string]: number }; // Best score per castle
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
  const [selectedMember, setSelectedMember] = useState<MemberStats | null>(null);
  const [showRiskModal, setShowRiskModal] = useState(false);

  useEffect(() => {
    loadAnalysis();

    // Set up real-time subscriptions
    const membersChannel = supabase
      .channel('analysis-members-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'members' }, () => loadAnalysis())
      .subscribe();

    const crEntryChannel = supabase
      .channel('analysis-cr-entry-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'castle_rush_entry' }, () => loadAnalysis())
      .subscribe();

    const aeEntryChannel = supabase
      .channel('analysis-ae-entry-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'advent_expedition_entry' }, () => loadAnalysis())
      .subscribe();

    return () => {
      supabase.removeChannel(membersChannel);
      supabase.removeChannel(crEntryChannel);
      supabase.removeChannel(aeEntryChannel);
    };
  }, []);

  async function loadAnalysis() {
    setLoading(true);
    try {
      // Fetch all data in parallel
      const [membersRes, crRes, aeRes] = await Promise.all([
        supabase.from('members').select('id, name, role, kicked, created_at').order('created_at', { ascending: false }),
        supabase.from('castle_rush_entry').select('member_id, attendance, score, castle_rush!inner(date, castle)'),
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
        castle: e.castle_rush.castle,
        type: 'castle_rush'
      }));

      // Group Advent Expedition entries by date (each date = 1 event with multiple bosses)
      // If member participated in at least 1 boss on that date, count as attended
      const aeByDateAndMember = new Map<string, boolean>();
      (aeRes.data || []).forEach((e: any) => {
        const key = `${e.member_id}_${e.date}`;
        if (e.attendance) {
          aeByDateAndMember.set(key, true);
        } else if (!aeByDateAndMember.has(key)) {
          aeByDateAndMember.set(key, false);
        }
      });

      // Get unique Advent dates and members for creating entries
      const uniqueAdventDates = new Set((aeRes.data || []).map((e: any) => e.date));
      const adventMembers = new Set((aeRes.data || []).map((e: any) => e.member_id));

      const aeEntries: any[] = [];
      adventMembers.forEach(member_id => {
        uniqueAdventDates.forEach(date => {
          const key = `${member_id}_${date}`;
          const attended = aeByDateAndMember.get(key) || false;
          
          // Calculate total score for this member on this date
          const memberDateEntries = (aeRes.data || []).filter((e: any) => 
            e.member_id === member_id && e.date === date
          );
          const totalScore = memberDateEntries.reduce((sum: number, e: any) => sum + (e.total_score || 0), 0);
          
          aeEntries.push({
            member_id,
            attendance: attended,
            score: totalScore,
            date,
            type: 'advent'
          });
        });
      });

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
          
          // Advent: Count unique dates where member participated
          const aeMemberDates = new Set(aeMemberEntries.map((e: any) => e.date));
          const aeAttendedDates = new Set(
            aeMemberEntries.filter((e: any) => e.attendance).map((e: any) => e.date)
          );
          const aeAttendanceRate = aeMemberDates.size > 0 ? (aeAttendedDates.size / aeMemberDates.size) * 100 : 0;

          // Calculate risk score: (100 - attendanceRate) * (1 + totalEntries/10)
          const riskScore = memberEntries.length >= 3 
            ? (100 - attendanceRate) * (1 + memberEntries.length / 10)
            : 0;

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

          // Calculate best score per castle
          const bestCastleScores: { [castle: string]: number } = {};
          crMemberEntries.forEach((e: any) => {
            if (e.castle && e.score) {
              if (!bestCastleScores[e.castle] || e.score > bestCastleScores[e.castle]) {
                bestCastleScores[e.castle] = e.score;
              }
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
            adventEntries: aeMemberDates.size,
            castleRushAttendance: crAttendanceRate,
            adventAttendance: aeAttendanceRate,
            highestScore,
            lowestScore,
            consistency,
            riskScore,
            bestCastleScores,
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

    // At-risk members: Calculate risk score based on attendance rate AND total entries
    // Formula: riskScore = (100 - attendanceRate) * (1 + totalEntries/10)
    // This makes members with more entries and low attendance worse
    // Exclude members with less than 3 total entries (too new to judge)
    const atRiskMembers = stats
      .filter(s => s.totalEntries >= 3) // Must have at least 3 entries
      .map(s => ({
        ...s,
        riskScore: (100 - s.attendanceRate) * (1 + s.totalEntries / 10)
      }))
      .filter(s => s.attendanceRate < 70 || (s.daysSinceLastEntry !== null && s.daysSinceLastEntry >= 3))
      .sort((a, b) => b.riskScore - a.riskScore)
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
      return sorted.filter(s => s.totalEntries >= 3 && (s.attendanceRate < 70 || (s.daysSinceLastEntry !== null && s.daysSinceLastEntry >= 3)));
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

  function showRiskBreakdown(member: MemberStats) {
    setSelectedMember(member);
    setShowRiskModal(true);
  }

  function getRiskLevel(score: number): { label: string; color: string; bgColor: string } {
    if (score >= 100) return { label: "CRITICAL", color: "#ef4444", bgColor: "rgba(239, 68, 68, 0.1)" };
    if (score >= 50) return { label: "HIGH", color: "#f59e0b", bgColor: "rgba(245, 158, 11, 0.1)" };
    if (score >= 20) return { label: "MODERATE", color: "#eab308", bgColor: "rgba(234, 179, 8, 0.1)" };
    return { label: "LOW", color: "#10b981", bgColor: "rgba(16, 185, 129, 0.1)" };
  }

  function calculateMemberTenure(member: MemberStats): number {
    // Calculate days since member joined (from first entry)
    if (!member.lastEntry) return 0;
    const firstEntry = stats.find(s => s.memberId === member.memberId);
    if (!firstEntry) return 0;
    
    // Estimate join date from total entries and last entry
    const avgDaysBetweenEvents = 2; // Assume events every 2 days on average
    const estimatedJoinDate = new Date(member.lastEntry).getTime() - (member.totalEntries * avgDaysBetweenEvents * 24 * 60 * 60 * 1000);
    const daysSinceJoin = Math.floor((Date.now() - estimatedJoinDate) / (1000 * 60 * 60 * 24));
    return Math.max(daysSinceJoin, member.totalEntries); // At least as many days as entries
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
                  guildMetrics.atRiskMembers.map((member: any) => (
                    <div
                      key={member.memberId}
                      className="p-3 rounded"
                      style={{ backgroundColor: "rgba(239, 68, 68, 0.05)" }}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <div>
                          <div className="font-medium" style={{ color: "var(--color-foreground)" }}>
                            {member.memberName}
                          </div>
                          <div className="text-xs" style={{ color: "var(--color-muted)" }}>
                            {member.totalEntries} entries • {member.attendanceRate.toFixed(0)}% attendance
                            {member.daysSinceLastEntry !== null && member.daysSinceLastEntry >= 3 && ` • Inactive ${member.daysSinceLastEntry}d`}
                          </div>
                        </div>
                        <div
                          className="text-sm font-bold px-2 py-1 rounded"
                          style={{ backgroundColor: "#ef4444", color: "white" }}
                        >
                          Risk: {member.riskScore.toFixed(0)}
                        </div>
                      </div>
                      {member.bestCastleScores && Object.keys(member.bestCastleScores).length > 0 && (
                        <div className="flex flex-wrap gap-2 mt-2">
                          {Object.entries(member.bestCastleScores).map(([castle, score]: [string, any]) => (
                            <div
                              key={castle}
                              className="px-2 py-1 rounded text-xs"
                              style={{
                                backgroundColor: "rgba(139, 92, 246, 0.1)",
                                color: "#8b5cf6",
                                border: "1px solid rgba(139, 92, 246, 0.2)"
                              }}
                            >
                              <span className="font-semibold">{castle}:</span> {score.toLocaleString()}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ))
                ) : (
                  <div className="text-center py-4 text-sm" style={{ color: "var(--color-muted)" }}>
                    All members performing well! 🎉
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
                    <th className="text-center p-4 font-semibold text-sm">Events</th>
                    <th className="text-center p-4 font-semibold text-sm">Attendance</th>
                    <th className="text-center p-4 font-semibold text-sm">Avg Score (7d)</th>
                    <th className="text-center p-4 font-semibold text-sm">CR / AE</th>
                    <th className="text-center p-4 font-semibold text-sm">Consistency</th>
                    <th className="text-center p-4 font-semibold text-sm">Last Active</th>
                    <th className="text-left p-4 font-semibold text-sm">Weekly Activity</th>
                    <th className="text-center p-4 font-semibold text-sm">Risk</th>
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
                            <div className="text-xs" style={{ color: "var(--color-muted)" }}>{s.role}</div>
                          </div>
                        </div>
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
                      <td className="p-4 text-center">
                        {s.totalEntries >= 3 ? (
                          <div className="flex items-center justify-center gap-2">
                            <div
                              className="px-3 py-1.5 rounded-lg text-sm font-bold cursor-pointer"
                              style={{
                                backgroundColor: s.riskScore >= 100 ? "#ef4444" : 
                                               s.riskScore >= 50 ? "#f59e0b" : "#10b981",
                                color: "white"
                              }}
                              onClick={() => {
                                const memberData = stats.find(st => st.memberId === s.memberId);
                                if (memberData) showRiskBreakdown(memberData);
                              }}
                            >
                              {s.riskScore.toFixed(0)}
                            </div>
                          </div>
                        ) : (
                          <span className="text-xs" style={{ color: "var(--color-muted)" }}>
                            New
                          </span>
                        )}
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

      {/* Risk Analysis Modal */}
      {showRiskModal && selectedMember && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          {/* Backdrop */}
          <div 
            className="absolute inset-0" 
            style={{ backgroundColor: "rgba(0, 0, 0, 0.7)" }}
            onClick={() => setShowRiskModal(false)}
          />

          {/* Modal */}
          <div 
            className="relative rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-auto"
            style={{
              backgroundColor: "var(--color-surface)",
              border: "1px solid var(--color-border)",
            }}
          >
            {/* Header */}
            <div 
              className="sticky top-0 z-10 flex items-center justify-between p-6 border-b"
              style={{
                borderColor: "var(--color-border)",
                backgroundColor: "var(--color-surface)",
              }}
            >
              <div>
                <h2 className="text-2xl font-bold" style={{ color: "var(--color-foreground)" }}>
                  Risk Analysis: {selectedMember.memberName}
                </h2>
                <p className="text-sm mt-1" style={{ color: "var(--color-muted)" }}>
                  Comprehensive performance and risk breakdown
                </p>
              </div>
              <button
                onClick={() => setShowRiskModal(false)}
                className="p-2 rounded-lg hover:opacity-80"
                style={{
                  backgroundColor: "rgba(0,0,0,0.1)",
                  color: "var(--color-foreground)",
                }}
              >
                <FaTimes />
              </button>
            </div>

            {/* Content */}
            <div className="p-6 space-y-6">
              {/* Risk Score Overview */}
              <div
                className="p-6 rounded-lg"
                style={{
                  backgroundColor: getRiskLevel(selectedMember.riskScore).bgColor,
                  border: `2px solid ${getRiskLevel(selectedMember.riskScore).color}`,
                }}
              >
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <div className="text-sm font-medium mb-1" style={{ color: "var(--color-muted)" }}>
                      Overall Risk Score
                    </div>
                    <div className="text-6xl font-bold" style={{ color: getRiskLevel(selectedMember.riskScore).color }}>
                      {selectedMember.riskScore.toFixed(0)}
                    </div>
                  </div>
                  <div
                    className="px-6 py-3 rounded-lg text-xl font-bold"
                    style={{
                      backgroundColor: getRiskLevel(selectedMember.riskScore).color,
                      color: "white",
                    }}
                  >
                    {getRiskLevel(selectedMember.riskScore).label}
                  </div>
                </div>
                <div className="text-sm" style={{ color: "var(--color-muted)" }}>
                  Formula: (100 - Attendance%) × (1 + Total Entries ÷ 10) = ({(100 - selectedMember.attendanceRate).toFixed(1)}%) × (1 + {selectedMember.totalEntries} ÷ 10) = {selectedMember.riskScore.toFixed(0)}
                </div>
              </div>

              {/* Key Metrics Grid */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div
                  className="p-4 rounded-lg"
                  style={{
                    backgroundColor: "var(--color-bg)",
                    border: "1px solid var(--color-border)",
                  }}
                >
                  <div className="text-xs mb-1" style={{ color: "var(--color-muted)" }}>
                    Attendance Rate
                  </div>
                  <div className="text-2xl font-bold" style={{ color: getAttendanceColor(selectedMember.attendanceRate) }}>
                    {selectedMember.attendanceRate.toFixed(1)}%
                  </div>
                  <div className="text-xs mt-1" style={{ color: "var(--color-muted)" }}>
                    {(selectedMember.totalEntries * selectedMember.attendanceRate / 100).toFixed(0)} / {selectedMember.totalEntries} events
                  </div>
                </div>

                <div
                  className="p-4 rounded-lg"
                  style={{
                    backgroundColor: "var(--color-bg)",
                    border: "1px solid var(--color-border)",
                  }}
                >
                  <div className="text-xs mb-1" style={{ color: "var(--color-muted)" }}>
                    Avg Score (7d)
                  </div>
                  <div className="text-2xl font-bold" style={{ color: "var(--color-foreground)" }}>
                    {selectedMember.averageScore > 0 ? selectedMember.averageScore.toFixed(0) : "N/A"}
                  </div>
                  <div className="text-xs mt-1" style={{ color: "var(--color-muted)" }}>
                    High: {selectedMember.highestScore.toLocaleString()}
                  </div>
                </div>

                <div
                  className="p-4 rounded-lg"
                  style={{
                    backgroundColor: "var(--color-bg)",
                    border: "1px solid var(--color-border)",
                  }}
                >
                  <div className="text-xs mb-1" style={{ color: "var(--color-muted)" }}>
                    Last Active
                  </div>
                  <div className="text-2xl font-bold" style={{ color: "var(--color-foreground)" }}>
                    {selectedMember.daysSinceLastEntry !== null ? `${selectedMember.daysSinceLastEntry}d` : "N/A"}
                  </div>
                  <div className="text-xs mt-1" style={{ color: "var(--color-muted)" }}>
                    {selectedMember.lastEntry ? new Date(selectedMember.lastEntry).toLocaleDateString() : "No entries"}
                  </div>
                </div>

                <div
                  className="p-4 rounded-lg"
                  style={{
                    backgroundColor: "var(--color-bg)",
                    border: "1px solid var(--color-border)",
                  }}
                >
                  <div className="text-xs mb-1" style={{ color: "var(--color-muted)" }}>
                    Consistency
                  </div>
                  <div className="text-2xl font-bold" style={{ color: selectedMember.consistency >= 70 ? "#10b981" : "#f59e0b" }}>
                    {selectedMember.consistency > 0 ? selectedMember.consistency.toFixed(0) : "N/A"}
                  </div>
                  <div className="text-xs mt-1" style={{ color: "var(--color-muted)" }}>
                    {selectedMember.consistency >= 70 ? "Stable" : "Variable"}
                  </div>
                </div>
              </div>

              {/* Risk Factors Breakdown */}
              <div>
                <h3 className="text-lg font-bold mb-4" style={{ color: "var(--color-foreground)" }}>
                  Risk Factors Analysis
                </h3>
                <div className="space-y-3">
                  {/* Attendance Risk */}
                  <div
                    className="p-4 rounded-lg"
                    style={{
                      backgroundColor: "var(--color-bg)",
                      border: "1px solid var(--color-border)",
                    }}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-3">
                        {selectedMember.attendanceRate < 70 ? (
                          <FaTimesCircle size={20} style={{ color: "#ef4444" }} />
                        ) : (
                          <FaCheckCircle size={20} style={{ color: "#10b981" }} />
                        )}
                        <span className="font-semibold" style={{ color: "var(--color-foreground)" }}>
                          Attendance Pattern
                        </span>
                      </div>
                      <div
                        className="px-3 py-1 rounded text-sm font-bold"
                        style={{
                          backgroundColor: selectedMember.attendanceRate >= 80 ? "#10b981" : 
                                         selectedMember.attendanceRate >= 70 ? "#f59e0b" : "#ef4444",
                          color: "white"
                        }}
                      >
                        {selectedMember.attendanceRate >= 80 ? "Excellent" : 
                         selectedMember.attendanceRate >= 70 ? "Acceptable" : "Poor"}
                      </div>
                    </div>
                    <div className="text-sm space-y-1" style={{ color: "var(--color-muted)" }}>
                      <div>• Attended: {(selectedMember.totalEntries * selectedMember.attendanceRate / 100).toFixed(0)} events</div>
                      <div>• Missed: {selectedMember.totalEntries - (selectedMember.totalEntries * selectedMember.attendanceRate / 100)} events</div>
                      <div>• Castle Rush: {selectedMember.castleRushAttendance.toFixed(0)}% ({selectedMember.castleRushEntries} events)</div>
                      <div>• Advent Expedition: {selectedMember.adventAttendance.toFixed(0)}% ({selectedMember.adventEntries} events)</div>
                    </div>
                  </div>

                  {/* Activity Risk */}
                  <div
                    className="p-4 rounded-lg"
                    style={{
                      backgroundColor: "var(--color-bg)",
                      border: "1px solid var(--color-border)",
                    }}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-3">
                        {selectedMember.daysSinceLastEntry !== null && selectedMember.daysSinceLastEntry >= 3 ? (
                          <FaExclamationTriangle size={20} style={{ color: "#f59e0b" }} />
                        ) : (
                          <FaCheckCircle size={20} style={{ color: "#10b981" }} />
                        )}
                        <span className="font-semibold" style={{ color: "var(--color-foreground)" }}>
                          Recent Activity
                        </span>
                      </div>
                      <div
                        className="px-3 py-1 rounded text-sm font-bold"
                        style={{
                          backgroundColor: selectedMember.daysSinceLastEntry === null || selectedMember.daysSinceLastEntry <= 1 ? "#10b981" :
                                         selectedMember.daysSinceLastEntry <= 3 ? "#f59e0b" : "#ef4444",
                          color: "white"
                        }}
                      >
                        {selectedMember.daysSinceLastEntry === null ? "No Data" :
                         selectedMember.daysSinceLastEntry <= 1 ? "Active" :
                         selectedMember.daysSinceLastEntry <= 3 ? "Recent" : "Inactive"}
                      </div>
                    </div>
                    <div className="text-sm space-y-1" style={{ color: "var(--color-muted)" }}>
                      <div>• Last Entry: {selectedMember.lastEntry ? new Date(selectedMember.lastEntry).toLocaleString() : "Never"}</div>
                      <div>• Days Inactive: {selectedMember.daysSinceLastEntry ?? "Unknown"}</div>
                      <div>• Weekly Activity: {selectedMember.weeklyActivity.reduce((a, b) => a + b, 0)} events in last 7 days</div>
                    </div>
                  </div>

                  {/* Performance Risk */}
                  <div
                    className="p-4 rounded-lg"
                    style={{
                      backgroundColor: "var(--color-bg)",
                      border: "1px solid var(--color-border)",
                    }}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-3">
                        <FaChartLine size={20} style={{ color: "#8b5cf6" }} />
                        <span className="font-semibold" style={{ color: "var(--color-foreground)" }}>
                          Performance Metrics
                        </span>
                      </div>
                      <div
                        className="px-3 py-1 rounded text-sm font-bold"
                        style={{
                          backgroundColor: selectedMember.averageScore > guildMetrics.guildAverageScore ? "#10b981" : "#f59e0b",
                          color: "white"
                        }}
                      >
                        {selectedMember.averageScore > guildMetrics.guildAverageScore ? "Above Average" : "Below Average"}
                      </div>
                    </div>
                    <div className="text-sm space-y-1" style={{ color: "var(--color-muted)" }}>
                      <div>• 7-Day Average: {selectedMember.averageScore > 0 ? selectedMember.averageScore.toFixed(0) : "N/A"}</div>
                      <div>• Guild Average: {guildMetrics.guildAverageScore.toFixed(0)}</div>
                      <div>• Highest Score: {selectedMember.highestScore.toLocaleString()}</div>
                      <div>• Lowest Score: {selectedMember.lowestScore > 0 ? selectedMember.lowestScore.toLocaleString() : "N/A"}</div>
                      <div>• Consistency: {selectedMember.consistency > 0 ? selectedMember.consistency.toFixed(0) : "N/A"}% (lower variance = more consistent)</div>
                    </div>
                  </div>

                  {/* Experience & Tenure */}
                  <div
                    className="p-4 rounded-lg"
                    style={{
                      backgroundColor: "var(--color-bg)",
                      border: "1px solid var(--color-border)",
                    }}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-3">
                        <FaUsers size={20} style={{ color: "#3b82f6" }} />
                        <span className="font-semibold" style={{ color: "var(--color-foreground)" }}>
                          Experience & Tenure
                        </span>
                      </div>
                      <div
                        className="px-3 py-1 rounded text-sm font-bold"
                        style={{
                          backgroundColor: selectedMember.totalEntries >= 20 ? "#10b981" :
                                         selectedMember.totalEntries >= 10 ? "#f59e0b" : "#ef4444",
                          color: "white"
                        }}
                      >
                        {selectedMember.totalEntries >= 20 ? "Veteran" :
                         selectedMember.totalEntries >= 10 ? "Experienced" : "New"}
                      </div>
                    </div>
                    <div className="text-sm space-y-1" style={{ color: "var(--color-muted)" }}>
                      <div>• Total Events: {selectedMember.totalEntries}</div>
                      <div>• Estimated Tenure: ~{calculateMemberTenure(selectedMember)} days</div>
                      <div>• Role: {selectedMember.role}</div>
                      <div>• Events per Week: {((selectedMember.totalEntries / Math.max(calculateMemberTenure(selectedMember), 1)) * 7).toFixed(1)}</div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Castle Performance Breakdown */}
              {selectedMember.bestCastleScores && Object.keys(selectedMember.bestCastleScores).length > 0 && (
                <div>
                  <h3 className="text-lg font-bold mb-4" style={{ color: "var(--color-foreground)" }}>
                    Best Scores by Castle
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {Object.entries(selectedMember.bestCastleScores)
                      .sort(([, scoreA], [, scoreB]) => (scoreB as number) - (scoreA as number))
                      .map(([castle, score]) => (
                        <div
                          key={castle}
                          className="p-4 rounded-lg flex items-center justify-between"
                          style={{
                            backgroundColor: "var(--color-bg)",
                            border: "1px solid var(--color-border)",
                          }}
                        >
                          <div>
                            <div className="font-medium" style={{ color: "var(--color-foreground)" }}>
                              {castle}
                            </div>
                            <div className="text-xs" style={{ color: "var(--color-muted)" }}>
                              Personal Best
                            </div>
                          </div>
                          <div className="text-2xl font-bold" style={{ color: "#8b5cf6" }}>
                            {(score as number).toLocaleString()}
                          </div>
                        </div>
                      ))}
                  </div>
                </div>
              )}

              {/* Recommendation */}
              <div
                className="p-5 rounded-lg"
                style={{
                  backgroundColor: getRiskLevel(selectedMember.riskScore).bgColor,
                  border: `2px solid ${getRiskLevel(selectedMember.riskScore).color}`,
                }}
              >
                <div className="flex items-start gap-3">
                  <FaExclamationTriangle size={24} style={{ color: getRiskLevel(selectedMember.riskScore).color }} />
                  <div>
                    <div className="font-bold text-lg mb-2" style={{ color: "var(--color-foreground)" }}>
                      Recommendation
                    </div>
                    <div className="text-sm space-y-2" style={{ color: "var(--color-foreground)" }}>
                      {selectedMember.riskScore >= 100 && (
                        <>
                          <p>⚠️ <strong>CRITICAL RISK:</strong> This member shows severe attendance issues with low participation rate.</p>
                          <p>• Consider immediate intervention or removal</p>
                          <p>• Has {selectedMember.totalEntries} entries with only {selectedMember.attendanceRate.toFixed(0)}% attendance</p>
                        </>
                      )}
                      {selectedMember.riskScore >= 50 && selectedMember.riskScore < 100 && (
                        <>
                          <p>⚠️ <strong>HIGH RISK:</strong> This member requires attention due to inconsistent participation.</p>
                          <p>• Schedule a check-in to understand issues</p>
                          <p>• Set clear attendance expectations</p>
                          <p>• Monitor closely for next 2 weeks</p>
                        </>
                      )}
                      {selectedMember.riskScore >= 20 && selectedMember.riskScore < 50 && (
                        <>
                          <p>ℹ️ <strong>MODERATE RISK:</strong> Performance is acceptable but could improve.</p>
                          <p>• Encourage more consistent participation</p>
                          <p>• Current attendance: {selectedMember.attendanceRate.toFixed(0)}% (target: 80%+)</p>
                        </>
                      )}
                      {selectedMember.riskScore < 20 && (
                        <>
                          <p>✅ <strong>LOW RISK:</strong> This member is performing well.</p>
                          <p>• Maintain current engagement level</p>
                          <p>• Consider for leadership roles or mentoring</p>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Footer */}
            <div 
              className="sticky bottom-0 flex justify-end gap-3 p-4 border-t"
              style={{
                borderColor: "var(--color-border)",
                backgroundColor: "var(--color-surface)",
              }}
            >
              <button
                onClick={() => setShowRiskModal(false)}
                className="px-6 py-2 rounded-lg hover:opacity-80"
                style={{
                  backgroundColor: "var(--color-primary)",
                  color: "white",
                }}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
