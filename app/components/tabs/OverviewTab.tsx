"use client";

import { useState, useEffect, useMemo } from "react";
import { supabase } from "../../../lib/supabaseClient";
import { FaUsers, FaTrophy, FaChartLine, FaExclamationTriangle, FaCalendarAlt, FaStar } from "react-icons/fa";

interface Member {
  id: string;
  name: string;
  role?: string;
  kicked?: boolean;
  created_at?: string;
}

interface RecentActivity {
  type: 'castle_rush' | 'advent';
  date: string;
  attendance: number;
  totalMembers: number;
  averageScore: number;
  topScore: number;
  topPerformer: string;
}

interface QuickStat {
  label: string;
  value: string | number;
  subtext: string;
  color: string;
  icon: any;
}

interface GuildOverview {
  totalMembers: number;
  activeMembers: number;
  kickedMembers: number;
  newMembersThisWeek: number;
  averageAttendanceRate: number;
  guildAverageScore: number;
  totalEventsThisWeek: number;
  atRiskCount: number;
  recentActivities: RecentActivity[];
  upcomingMilestones: string[];
}

export default function OverviewTab() {
  const [overview, setOverview] = useState<GuildOverview>({
    totalMembers: 0,
    activeMembers: 0,
    kickedMembers: 0,
    newMembersThisWeek: 0,
    averageAttendanceRate: 0,
    guildAverageScore: 0,
    totalEventsThisWeek: 0,
    atRiskCount: 0,
    recentActivities: [],
    upcomingMilestones: [],
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadOverview();
  }, []);

  async function loadOverview() {
    try {
      const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
      const sevenDaysAgoStr = new Date(sevenDaysAgo).toISOString().split('T')[0];

      // Fetch only necessary data in parallel with limits
      const [membersRes, crEntriesRes, aeEntriesRes, crEventsRes, aeEventsRes] = await Promise.all([
        supabase.from('members').select('id, name, role, kicked, created_at').order('created_at', { ascending: false }),
        supabase.from('castle_rush_entry').select('member_id, attendance, score, castle_rush!inner(date, id)').gte('castle_rush.date', sevenDaysAgoStr),
        supabase.from('advent_expedition_entry').select('member_id, attendance, total_score, date, advent_expedition!inner(id)').gte('date', sevenDaysAgoStr),
        supabase.from('castle_rush').select('id, date, castle').order('date', { ascending: false }).limit(7),
        supabase.from('advent_expedition').select('id, date').order('date', { ascending: false }).limit(7)
      ]);

      if (membersRes.error) throw membersRes.error;
      if (crEntriesRes.error) throw crEntriesRes.error;
      if (aeEntriesRes.error) throw aeEntriesRes.error;

      const members: Member[] = membersRes.data || [];
      const crEntries = crEntriesRes.data || [];
      const aeRawEntries = aeEntriesRes.data || [];
      const crEvents = crEventsRes.data || [];
      const aeEvents = aeEventsRes.data || [];

      // Process Advent entries: Group by member and date (1 entry per date if participated in any boss)
      const aeByDateAndMember = new Map<string, boolean>();
      aeRawEntries.forEach((e: any) => {
        const key = `${e.member_id}_${e.date}`;
        if (e.attendance) {
          aeByDateAndMember.set(key, true);
        } else if (!aeByDateAndMember.has(key)) {
          aeByDateAndMember.set(key, false);
        }
      });

      const uniqueAdventDates = new Set(aeRawEntries.map((e: any) => e.date));
      const adventMembers = new Set(aeRawEntries.map((e: any) => e.member_id));

      const aeEntries: any[] = [];
      adventMembers.forEach(member_id => {
        uniqueAdventDates.forEach(date => {
          const key = `${member_id}_${date}`;
          const attended = aeByDateAndMember.get(key) || false;
          
          // Calculate total score for this member on this date
          const memberDateEntries = aeRawEntries.filter((e: any) => 
            e.member_id === member_id && e.date === date
          );
          const totalScore = memberDateEntries.reduce((sum: number, e: any) => sum + (e.total_score || 0), 0);
          
          aeEntries.push({
            member_id,
            attendance: attended,
            total_score: totalScore,
            date,
            advent_expedition: memberDateEntries[0]?.advent_expedition
          });
        });
      });

      // Member statistics
      const totalMembers = members.length;
      const activeMembers = members.filter(m => !m.kicked).length;
      const kickedMembers = members.filter(m => m.kicked).length;
      const newMembersThisWeek = members.filter(m => {
        const createdAt = new Date(m.created_at || '').getTime();
        return createdAt >= sevenDaysAgo;
      }).length;

      // Calculate attendance rates
      const attendanceRates = members
        .filter(m => !m.kicked)
        .map(m => {
          const memberCREntries = crEntries.filter((e: any) => e.member_id === m.id);
          const memberAEEntries = aeEntries.filter((e: any) => e.member_id === m.id);
          const totalEntries = memberCREntries.length + memberAEEntries.length;
          const attendedEntries = [
            ...memberCREntries.filter((e: any) => e.attendance),
            ...memberAEEntries.filter((e: any) => e.attendance)
          ].length;
          return totalEntries > 0 ? (attendedEntries / totalEntries) * 100 : 0;
        });

      const averageAttendanceRate = attendanceRates.length > 0
        ? attendanceRates.reduce((a, b) => a + b, 0) / attendanceRates.length
        : 0;

      // Calculate average scores (7 days)
      const recentCREntries = crEntries.filter((e: any) => e.castle_rush.date >= sevenDaysAgoStr);
      const recentAEEntries = aeEntries.filter((e: any) => e.date >= sevenDaysAgoStr);
      const allRecentScores = [
        ...recentCREntries.filter((e: any) => e.attendance).map((e: any) => e.score || 0),
        ...recentAEEntries.filter((e: any) => e.attendance).map((e: any) => e.total_score || 0)
      ].filter(s => s > 0);

      const guildAverageScore = allRecentScores.length > 0
        ? allRecentScores.reduce((a, b) => a + b, 0) / allRecentScores.length
        : 0;

      // Count at-risk members (attendance < 60% or inactive 3+ days)
      const now = Date.now();
      const atRiskCount = members.filter(m => {
        if (m.kicked) return false;
        const memberEntries = [
          ...crEntries.filter((e: any) => e.member_id === m.id).map((e: any) => ({ ...e, date: e.castle_rush.date })),
          ...aeEntries.filter((e: any) => e.member_id === m.id)
        ];
        
        const attended = memberEntries.filter((e: any) => e.attendance);
        const attendanceRate = memberEntries.length > 0 ? (attended.length / memberEntries.length) * 100 : 0;
        
        const lastEntryDate = memberEntries.length > 0
          ? Math.max(...memberEntries.map((e: any) => new Date(e.date).getTime()))
          : 0;
        const daysSinceLastEntry = lastEntryDate ? Math.floor((now - lastEntryDate) / (1000 * 60 * 60 * 24)) : 999;
        
        return attendanceRate < 60 || daysSinceLastEntry >= 3;
      }).length;

      // Events this week
      const recentCREvents = crEvents.filter((e: any) => e.date >= sevenDaysAgoStr);
      const recentAEEvents = aeEvents.filter((e: any) => e.date >= sevenDaysAgoStr);
      const totalEventsThisWeek = recentCREvents.length + recentAEEvents.length;

      // Build recent activities (last 5 events combined)
      const recentActivities: RecentActivity[] = [];

      // Process Castle Rush events
      recentCREvents.slice(0, 5).forEach((event: any) => {
        const eventEntries = crEntries.filter((e: any) => e.castle_rush.id === event.id);
        const attendedEntries = eventEntries.filter((e: any) => e.attendance);
        const scores = attendedEntries.map((e: any) => e.score || 0).filter(s => s > 0);
        const topScore = scores.length > 0 ? Math.max(...scores) : 0;
        const topEntry = attendedEntries.find((e: any) => e.score === topScore);
        const topPerformer = topEntry ? members.find(m => m.id === topEntry.member_id)?.name || 'Unknown' : '-';

        recentActivities.push({
          type: 'castle_rush',
          date: event.date,
          attendance: attendedEntries.length,
          totalMembers: eventEntries.length,
          averageScore: scores.length > 0 ? scores.reduce((a, b) => a + b, 0) / scores.length : 0,
          topScore,
          topPerformer
        });
      });

      // Process Advent events
      recentAEEvents.slice(0, 5).forEach((event: any) => {
        const eventEntries = aeEntries.filter((e: any) => e.advent_expedition && e.advent_expedition.id === event.id);
        const attendedEntries = eventEntries.filter((e: any) => e.attendance);
        const scores = attendedEntries.map((e: any) => e.total_score || 0).filter(s => s > 0);
        const topScore = scores.length > 0 ? Math.max(...scores) : 0;
        const topEntry = attendedEntries.find((e: any) => e.total_score === topScore);
        const topPerformer = topEntry ? members.find(m => m.id === topEntry.member_id)?.name || 'Unknown' : '-';

        recentActivities.push({
          type: 'advent',
          date: event.date,
          attendance: attendedEntries.length,
          totalMembers: eventEntries.length,
          averageScore: scores.length > 0 ? scores.reduce((a, b) => a + b, 0) / scores.length : 0,
          topScore,
          topPerformer
        });
      });

      // Sort by date descending
      recentActivities.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

      setOverview({
        totalMembers,
        activeMembers,
        kickedMembers,
        newMembersThisWeek,
        averageAttendanceRate,
        guildAverageScore,
        totalEventsThisWeek,
        atRiskCount,
        recentActivities: recentActivities.slice(0, 7),
        upcomingMilestones: [],
      });
    } catch (err) {
    } finally {
      setLoading(false);
    }
  }

  // Quick stats for header cards
  const quickStats = useMemo<QuickStat[]>(() => [
    {
      label: "Active Members",
      value: overview.activeMembers,
      subtext: `${overview.newMembersThisWeek} new this week`,
      color: "#3b82f6",
      icon: FaUsers
    },
    {
      label: "Guild Health",
      value: `${overview.averageAttendanceRate.toFixed(0)}%`,
      subtext: "Average attendance",
      color: overview.averageAttendanceRate >= 80 ? "#10b981" : overview.averageAttendanceRate >= 60 ? "#f59e0b" : "#ef4444",
      icon: FaChartLine
    },
    {
      label: "Avg Performance",
      value: overview.guildAverageScore > 0 ? overview.guildAverageScore.toFixed(0) : "-",
      subtext: "Last 7 days",
      color: "#8b5cf6",
      icon: FaTrophy
    },
    {
      label: "Events This Week",
      value: overview.totalEventsThisWeek,
      subtext: "CR + Advent combined",
      color: "#06b6d4",
      icon: FaCalendarAlt
    },
    {
      label: "At-Risk Members",
      value: overview.atRiskCount,
      subtext: "Need attention",
      color: overview.atRiskCount > 0 ? "#ef4444" : "#10b981",
      icon: FaExclamationTriangle
    },
  ], [overview]);

  if (loading) {
    return (
      <div className="p-8 flex items-center justify-center" style={{ minHeight: "400px" }}>
        <div className="text-center">
          <div className="text-lg font-medium mb-2" style={{ color: "var(--color-foreground)" }}>
            Loading guild overview...
          </div>
          <div className="text-sm" style={{ color: "var(--color-muted)" }}>
            Fetching latest guild data
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-3xl font-bold mb-2" style={{ color: "var(--color-foreground)" }}>
          Guild Dashboard
        </h1>
        <p className="text-sm" style={{ color: "var(--color-muted)" }}>
          Real-time overview of guild performance and member activity
        </p>
      </div>

      {/* Quick Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4 mb-6">
        {quickStats.map((stat, idx) => {
          const Icon = stat.icon;
          return (
            <div
              key={idx}
              className="p-4 rounded-lg transition-all hover:shadow-lg"
              style={{
                backgroundColor: "var(--color-surface)",
                border: "1px solid var(--color-border)",
              }}
            >
              <div className="flex items-center gap-3 mb-2">
                <div
                  className="p-2 rounded"
                  style={{ backgroundColor: `${stat.color}15`, color: stat.color }}
                >
                  <Icon size={18} />
                </div>
                <div className="text-xs font-medium" style={{ color: "var(--color-muted)" }}>
                  {stat.label}
                </div>
              </div>
              <div className="text-2xl font-bold mb-1" style={{ color: stat.color }}>
                {stat.value}
              </div>
              <div className="text-xs" style={{ color: "var(--color-muted)" }}>
                {stat.subtext}
              </div>
            </div>
          );
        })}
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Recent Activity Feed */}
        <div
          className="lg:col-span-2 p-5 rounded-lg"
          style={{
            backgroundColor: "var(--color-surface)",
            border: "1px solid var(--color-border)",
          }}
        >
          <div className="flex items-center gap-2 mb-4">
            <FaCalendarAlt size={18} style={{ color: "var(--color-primary)" }} />
            <h2 className="text-xl font-bold" style={{ color: "var(--color-foreground)" }}>
              Recent Activity
            </h2>
            <span className="text-sm ml-auto" style={{ color: "var(--color-muted)" }}>
              Last 7 events
            </span>
          </div>

          {overview.recentActivities.length > 0 ? (
            <div className="space-y-3">
              {overview.recentActivities.map((activity, idx) => (
                <div
                  key={idx}
                  className="p-4 rounded-lg transition-all hover:shadow-sm"
                  style={{
                    backgroundColor: activity.type === 'castle_rush' ? "rgba(59, 130, 246, 0.05)" : "rgba(139, 92, 246, 0.05)",
                    border: "1px solid var(--color-border)",
                  }}
                >
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <div
                        className="px-3 py-1 rounded-full text-xs font-bold"
                        style={{
                          backgroundColor: activity.type === 'castle_rush' ? "#3b82f6" : "#8b5cf6",
                          color: "white"
                        }}
                      >
                        {activity.type === 'castle_rush' ? 'Castle Rush' : 'Advent Exp'}
                      </div>
                      <div className="text-sm font-medium" style={{ color: "var(--color-foreground)" }}>
                        {new Date(activity.date).toLocaleDateString('en-US', {
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric'
                        })}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <FaStar size={14} style={{ color: "#f59e0b" }} />
                      <span className="text-sm font-medium" style={{ color: "var(--color-foreground)" }}>
                        {activity.topPerformer}
                      </span>
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-4">
                    <div>
                      <div className="text-xs mb-1" style={{ color: "var(--color-muted)" }}>
                        Attendance
                      </div>
                      <div className="text-lg font-bold" style={{ color: "var(--color-foreground)" }}>
                        {activity.attendance}/{activity.totalMembers}
                      </div>
                      <div className="text-xs" style={{ color: "var(--color-muted)" }}>
                        {((activity.attendance / activity.totalMembers) * 100).toFixed(0)}% rate
                      </div>
                    </div>
                    <div>
                      <div className="text-xs mb-1" style={{ color: "var(--color-muted)" }}>
                        Avg Score
                      </div>
                      <div className="text-lg font-bold font-mono" style={{ color: "var(--color-foreground)" }}>
                        {activity.averageScore > 0 ? activity.averageScore.toFixed(0) : '-'}
                      </div>
                    </div>
                    <div>
                      <div className="text-xs mb-1" style={{ color: "var(--color-muted)" }}>
                        Top Score
                      </div>
                      <div className="text-lg font-bold font-mono" style={{ color: "#f59e0b" }}>
                        {activity.topScore > 0 ? activity.topScore.toFixed(0) : '-'}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-12" style={{ color: "var(--color-muted)" }}>
              <FaCalendarAlt size={48} className="mx-auto mb-3 opacity-30" />
              <p>No recent activity</p>
              <p className="text-sm mt-1">Start adding Castle Rush or Advent entries</p>
            </div>
          )}
        </div>

        {/* Quick Actions & Info */}
        <div className="space-y-6">
          {/* Guild Summary */}
          <div
            className="p-5 rounded-lg"
            style={{
              backgroundColor: "var(--color-surface)",
              border: "1px solid var(--color-border)",
            }}
          >
            <h3 className="text-lg font-bold mb-4" style={{ color: "var(--color-foreground)" }}>
              Guild Summary
            </h3>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm" style={{ color: "var(--color-muted)" }}>
                  Total Members
                </span>
                <span className="font-bold" style={{ color: "var(--color-foreground)" }}>
                  {overview.totalMembers}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm" style={{ color: "var(--color-muted)" }}>
                  Active
                </span>
                <span className="font-bold" style={{ color: "#10b981" }}>
                  {overview.activeMembers}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm" style={{ color: "var(--color-muted)" }}>
                  Kicked
                </span>
                <span className="font-bold" style={{ color: "#ef4444" }}>
                  {overview.kickedMembers}
                </span>
              </div>
              <div
                className="pt-3 mt-3"
                style={{ borderTop: "1px solid var(--color-border)" }}
              >
                <div className="flex items-center justify-between">
                  <span className="text-sm" style={{ color: "var(--color-muted)" }}>
                    New This Week
                  </span>
                  <span className="font-bold" style={{ color: "#3b82f6" }}>
                    +{overview.newMembersThisWeek}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Performance Indicators */}
          <div
            className="p-5 rounded-lg"
            style={{
              backgroundColor: "var(--color-surface)",
              border: "1px solid var(--color-border)",
            }}
          >
            <h3 className="text-lg font-bold mb-4" style={{ color: "var(--color-foreground)" }}>
              Performance
            </h3>
            <div className="space-y-4">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium" style={{ color: "var(--color-muted)" }}>
                    Attendance Rate
                  </span>
                  <span
                    className="text-sm font-bold"
                    style={{
                      color: overview.averageAttendanceRate >= 80
                        ? "#10b981"
                        : overview.averageAttendanceRate >= 60
                        ? "#f59e0b"
                        : "#ef4444"
                    }}
                  >
                    {overview.averageAttendanceRate.toFixed(0)}%
                  </span>
                </div>
                <div
                  className="h-2 rounded-full overflow-hidden"
                  style={{ backgroundColor: "rgba(0,0,0,0.06)" }}
                >
                  <div
                    className="h-full transition-all"
                    style={{
                      width: `${overview.averageAttendanceRate}%`,
                      backgroundColor: overview.averageAttendanceRate >= 80
                        ? "#10b981"
                        : overview.averageAttendanceRate >= 60
                        ? "#f59e0b"
                        : "#ef4444"
                    }}
                  />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm font-medium" style={{ color: "var(--color-muted)" }}>
                    Avg Score (7d)
                  </span>
                  <span className="text-sm font-bold font-mono" style={{ color: "#8b5cf6" }}>
                    {overview.guildAverageScore > 0 ? overview.guildAverageScore.toFixed(0) : '-'}
                  </span>
                </div>
              </div>

              <div
                className="pt-3 mt-3"
                style={{ borderTop: "1px solid var(--color-border)" }}
              >
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium" style={{ color: "var(--color-muted)" }}>
                    At-Risk Members
                  </span>
                  <span
                    className="px-2 py-1 rounded text-xs font-bold"
                    style={{
                      backgroundColor: overview.atRiskCount > 0 ? "#ef444410" : "#10b98110",
                      color: overview.atRiskCount > 0 ? "#ef4444" : "#10b981"
                    }}
                  >
                    {overview.atRiskCount}
                  </span>
                </div>
                {overview.atRiskCount > 0 && (
                  <p className="text-xs mt-2" style={{ color: "var(--color-muted)" }}>
                    Check Analysis tab for details
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* Quick Tips */}
          <div
            className="p-5 rounded-lg"
            style={{
              backgroundColor: "var(--color-surface)",
              border: "1px solid var(--color-border)",
            }}
          >
            <h3 className="text-lg font-bold mb-3" style={{ color: "var(--color-foreground)" }}>
              Quick Tips
            </h3>
            <ul className="space-y-2 text-sm" style={{ color: "var(--color-muted)" }}>
              <li className="flex items-start gap-2">
                <span style={{ color: "var(--color-primary)" }}>•</span>
                <span>Use <strong>Castle Rush</strong> tab for daily entries</span>
              </li>
              <li className="flex items-start gap-2">
                <span style={{ color: "var(--color-primary)" }}>•</span>
                <span>Track 2-week expeditions in <strong>Advent</strong> tab</span>
              </li>
              <li className="flex items-start gap-2">
                <span style={{ color: "var(--color-primary)" }}>•</span>
                <span>View detailed metrics in <strong>Analysis</strong> tab</span>
              </li>
              <li className="flex items-start gap-2">
                <span style={{ color: "var(--color-primary)" }}>•</span>
                <span>Manage roster in <strong>Members</strong> tab</span>
              </li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
