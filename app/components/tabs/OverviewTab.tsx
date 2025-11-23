"use client";

import { useState, useEffect } from "react";
import { supabase } from "../../../lib/supabaseClient";

interface GuildStats {
  totalMembers: number;
  activeMembers: number;
  kickedMembers: number;
  todayAttendance: number;
  todayAverageScore: number;
  todayTopScore: number;
  todayTopScorer: string | null;
  weeklyTrend: number; // percentage change
  lowPerformers: number;
  averageAttendanceRate: number;
  totalEntriesThisMonth: number;
  lastEntryDate: string | null;
}

export default function OverviewTab() {
  const [stats, setStats] = useState<GuildStats>({
    totalMembers: 0,
    activeMembers: 0,
    kickedMembers: 0,
    todayAttendance: 0,
    todayAverageScore: 0,
    todayTopScore: 0,
    todayTopScorer: null,
    weeklyTrend: 0,
    lowPerformers: 0,
    averageAttendanceRate: 0,
    totalEntriesThisMonth: 0,
    lastEntryDate: null,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadStats();
  }, []);

  async function loadStats() {
    try {
      // Parallel queries for efficiency
      const [membersRes, entriesRes, castleRushRes] = await Promise.all([
        supabase.from('members').select('*'),
        supabase.from('castle_rush_entry').select('member_id, attendance, score, castle_rush!inner(date)'),
        supabase.from('castle_rush').select('id, date').order('date', { ascending: false })
      ]);

      if (membersRes.error) throw membersRes.error;
      if (entriesRes.error) throw entriesRes.error;

      const members = membersRes.data || [];
      const entries = entriesRes.data || [];
      const castleRushEvents = castleRushRes.data || [];

      const totalMembers = members.length;
      const activeMembers = members.filter(m => !m.kicked).length;
      const kickedMembers = members.filter(m => m.kicked).length;

      // Today's stats
      const today = new Date().toISOString().split('T')[0];
      const todayEntries = entries.filter((e: any) => e.castle_rush.date === today);
      const todayAttended = todayEntries.filter((e: any) => e.attendance);
      const todayScores = todayAttended.map((e: any) => e.score || 0).filter(s => s > 0);

      const todayAttendance = todayAttended.length;
      const todayAverageScore = todayScores.length > 0 
        ? Math.round(todayScores.reduce((a, b) => a + b, 0) / todayScores.length)
        : 0;
      const todayTopScore = todayScores.length > 0 ? Math.max(...todayScores) : 0;
      
      let todayTopScorer = null;
      if (todayTopScore > 0) {
        const topEntry = todayAttended.find((e: any) => e.score === todayTopScore);
        if (topEntry) {
          const topMember = members.find(m => m.id === topEntry.member_id);
          todayTopScorer = topMember?.name || null;
        }
      }

      // Weekly trend (compare this week vs last week attendance)
      const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
      const fourteenDaysAgo = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
      
      const thisWeekEntries = entries.filter((e: any) => e.castle_rush.date >= sevenDaysAgo && e.attendance);
      const lastWeekEntries = entries.filter((e: any) => 
        e.castle_rush.date >= fourteenDaysAgo && e.castle_rush.date < sevenDaysAgo && e.attendance
      );
      
      const weeklyTrend = lastWeekEntries.length > 0
        ? ((thisWeekEntries.length - lastWeekEntries.length) / lastWeekEntries.length) * 100
        : 0;

      // Low performers (< 50% attendance or inactive > 14 days)
      const now = Date.now();
      const lowPerformers = members.filter(m => {
        if (m.kicked) return false;
        const memberEntries = entries.filter((e: any) => e.member_id === m.id);
        const attended = memberEntries.filter((e: any) => e.attendance);
        const attendanceRate = memberEntries.length > 0 ? (attended.length / memberEntries.length) * 100 : 0;
        
        const lastEntry = memberEntries.length > 0
          ? Math.max(...memberEntries.map((e: any) => new Date(e.castle_rush.date).getTime()))
          : 0;
        const daysSinceLastEntry = lastEntry ? Math.floor((now - lastEntry) / (1000 * 60 * 60 * 24)) : 999;
        
        return attendanceRate < 50 || daysSinceLastEntry > 14;
      }).length;

      // Average attendance rate
      const totalAttendanceRates = members
        .filter(m => !m.kicked)
        .map(m => {
          const memberEntries = entries.filter((e: any) => e.member_id === m.id);
          const attended = memberEntries.filter((e: any) => e.attendance);
          return memberEntries.length > 0 ? (attended.length / memberEntries.length) * 100 : 0;
        });
      
      const averageAttendanceRate = totalAttendanceRates.length > 0
        ? totalAttendanceRates.reduce((a, b) => a + b, 0) / totalAttendanceRates.length
        : 0;

      // This month's entries
      const firstDayOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0];
      const thisMonthEvents = castleRushEvents.filter(e => e.date >= firstDayOfMonth);
      const totalEntriesThisMonth = thisMonthEvents.length;

      // Last entry date
      const lastEntryDate = castleRushEvents.length > 0 ? castleRushEvents[0].date : null;

      setStats({
        totalMembers,
        activeMembers,
        kickedMembers,
        todayAttendance,
        todayAverageScore,
        todayTopScore,
        todayTopScorer,
        weeklyTrend,
        lowPerformers,
        averageAttendanceRate,
        totalEntriesThisMonth,
        lastEntryDate,
      });
    } catch (err) {
      console.error("Error loading overview stats:", err);
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="p-8">
        <div className="text-lg">Loading guild overview...</div>
      </div>
    );
  }

  const getHealthColor = () => {
    if (stats.averageAttendanceRate >= 80) return "#10b981";
    if (stats.averageAttendanceRate >= 60) return "#f59e0b";
    return "#ef4444";
  };

  return (
    <div className="p-4">
      <div className="mb-6">
        <h1 className="text-3xl font-bold mb-2">Guild Overview</h1>
        <p className="text-sm" style={{ color: "var(--color-muted)" }}>
          {stats.lastEntryDate ? `Last updated: ${new Date(stats.lastEntryDate + 'T00:00:00').toLocaleDateString()}` : 'No entries yet'}
        </p>
      </div>

      {/* Top Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <div 
          className="p-4 rounded-lg"
          style={{ 
            backgroundColor: "var(--color-surface)", 
            border: "1px solid var(--color-border)" 
          }}
        >
          <div className="text-xs mb-1" style={{ color: "var(--color-muted)" }}>Total Members</div>
          <div className="text-3xl font-bold">{stats.totalMembers}</div>
          <div className="text-xs mt-1" style={{ color: "var(--color-muted)" }}>
            {stats.activeMembers} active, {stats.kickedMembers} kicked
          </div>
        </div>

        <div 
          className="p-4 rounded-lg"
          style={{ 
            backgroundColor: "var(--color-surface)", 
            border: "1px solid var(--color-border)" 
          }}
        >
          <div className="text-xs mb-1" style={{ color: "var(--color-muted)" }}>Guild Health</div>
          <div className="text-3xl font-bold" style={{ color: getHealthColor() }}>
            {stats.averageAttendanceRate.toFixed(0)}%
          </div>
          <div className="text-xs mt-1" style={{ color: "var(--color-muted)" }}>
            Average attendance rate
          </div>
        </div>

        <div 
          className="p-4 rounded-lg"
          style={{ 
            backgroundColor: "var(--color-surface)", 
            border: "1px solid var(--color-border)" 
          }}
        >
          <div className="text-xs mb-1" style={{ color: "var(--color-muted)" }}>Weekly Trend</div>
          <div className="text-3xl font-bold" style={{ 
            color: stats.weeklyTrend > 0 ? "#10b981" : stats.weeklyTrend < 0 ? "#ef4444" : "var(--color-foreground)" 
          }}>
            {stats.weeklyTrend > 0 ? '+' : ''}{stats.weeklyTrend.toFixed(0)}%
          </div>
          <div className="text-xs mt-1" style={{ color: "var(--color-muted)" }}>
            vs last week
          </div>
        </div>

        <div 
          className="p-4 rounded-lg"
          style={{ 
            backgroundColor: "var(--color-surface)", 
            border: "1px solid var(--color-border)" 
          }}
        >
          <div className="text-xs mb-1" style={{ color: "var(--color-muted)" }}>At Risk</div>
          <div className="text-3xl font-bold" style={{ color: stats.lowPerformers > 0 ? "#ef4444" : "#10b981" }}>
            {stats.lowPerformers}
          </div>
          <div className="text-xs mt-1" style={{ color: "var(--color-muted)" }}>
            Low activity members
          </div>
        </div>
      </div>

      {/* Today's Performance */}
      <div 
        className="p-6 rounded-lg mb-6"
        style={{
          backgroundColor: "var(--color-surface)",
          border: "1px solid var(--color-border)",
        }}
      >
        <h2 className="text-xl font-bold mb-4">Today's Castle Rush</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div>
            <div className="text-sm mb-1" style={{ color: "var(--color-muted)" }}>Participation</div>
            <div className="text-2xl font-bold">{stats.todayAttendance}/{stats.activeMembers}</div>
            <div className="text-xs mt-1" style={{ color: "var(--color-muted)" }}>
              {stats.activeMembers > 0 ? ((stats.todayAttendance / stats.activeMembers) * 100).toFixed(0) : 0}% turnout
            </div>
          </div>
          <div>
            <div className="text-sm mb-1" style={{ color: "var(--color-muted)" }}>Average Score</div>
            <div className="text-2xl font-bold font-mono">
              {stats.todayAverageScore > 0 ? stats.todayAverageScore.toLocaleString() : '-'}
            </div>
            <div className="text-xs mt-1" style={{ color: "var(--color-muted)" }}>
              {stats.todayAttendance > 0 ? `From ${stats.todayAttendance} participants` : 'No data yet'}
            </div>
          </div>
          <div>
            <div className="text-sm mb-1" style={{ color: "var(--color-muted)" }}>Top Performance</div>
            <div className="text-2xl font-bold font-mono" style={{ color: "#A855F7" }}>
              {stats.todayTopScore > 0 ? stats.todayTopScore.toLocaleString() : '-'}
            </div>
            <div className="text-xs mt-1" style={{ color: "var(--color-muted)" }}>
              {stats.todayTopScorer || 'No scores yet'}
            </div>
          </div>
        </div>
      </div>

      {/* Monthly Summary */}
      <div 
        className="p-6 rounded-lg"
        style={{
          backgroundColor: "var(--color-surface)",
          border: "1px solid var(--color-border)",
        }}
      >
        <h2 className="text-xl font-bold mb-4">This Month</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <div className="text-sm mb-1" style={{ color: "var(--color-muted)" }}>Total Events</div>
            <div className="text-2xl font-bold">{stats.totalEntriesThisMonth}</div>
            <div className="text-xs mt-1" style={{ color: "var(--color-muted)" }}>
              Castle Rush entries recorded
            </div>
          </div>
          <div>
            <div className="text-sm mb-1" style={{ color: "var(--color-muted)" }}>Members Needing Review</div>
            <div className="text-2xl font-bold" style={{ color: stats.lowPerformers > 3 ? "#ef4444" : "#f59e0b" }}>
              {stats.lowPerformers}
            </div>
            <div className="text-xs mt-1" style={{ color: "var(--color-muted)" }}>
              Check Analysis tab for details
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
