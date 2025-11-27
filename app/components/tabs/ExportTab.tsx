"use client";

import { useState, useEffect } from "react";
import { FaFileDownload, FaDiscord, FaCalendarAlt, FaDragon } from "react-icons/fa";
import { supabase } from "../../../lib/supabaseClient";

interface CastleRushEvent {
  id: string;
  castle: string;
  date: string;
  total_score: number;
  attendance_count: number;
}

interface AdventEvent {
  id: string;
  date: string;
  total_score: number;
  attendance_count: number;
}

function getScoreGrade(score: number): { grade: string; color: string } {
  if (score >= 100000000) return { grade: "EX+", color: "#FF1493" };
  if (score >= 75000000) return { grade: "EX", color: "#4169E1" };
  if (score >= 50000000) return { grade: "SSS", color: "#8B7355" };
  if (score >= 30000000) return { grade: "SS", color: "#B8860B" };
  if (score >= 15000000) return { grade: "S", color: "#8B0000" };
  if (score >= 10000000) return { grade: "A", color: "#4B0082" };
  if (score >= 7500000) return { grade: "B", color: "#2F4F4F" };
  if (score >= 5000000) return { grade: "C", color: "#006400" };
  if (score >= 2500000) return { grade: "D", color: "#4A5568" };
  return { grade: "F", color: "#8B4513" };
}

function getAdventGrade(score: number): { grade: string; color: string } {
  if (score >= 400000000) return { grade: "EX+", color: "#FF1493" };
  if (score >= 300000000) return { grade: "EX", color: "#4169E1" };
  if (score >= 200000000) return { grade: "SSS", color: "#8B7355" };
  if (score >= 150000000) return { grade: "SS", color: "#B8860B" };
  if (score >= 100000000) return { grade: "S", color: "#8B0000" };
  if (score >= 75000000) return { grade: "A", color: "#4B0082" };
  if (score >= 50000000) return { grade: "B", color: "#2F4F4F" };
  if (score >= 25000000) return { grade: "C", color: "#006400" };
  if (score >= 10000000) return { grade: "D", color: "#4A5568" };
  return { grade: "F", color: "#8B4513" };
}

export default function ExportTab() {
  const [castleRushEvents, setCastleRushEvents] = useState<CastleRushEvent[]>([]);
  const [adventEvents, setAdventEvents] = useState<AdventEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<{ message: string; visible: boolean }>({ message: '', visible: false });

  useEffect(() => {
    loadEvents();
  }, []);

  function showToast(message: string) {
    setToast({ message, visible: true });
    setTimeout(() => {
      setToast({ message: '', visible: false });
    }, 3000);
  }

  async function loadEvents() {
    setLoading(true);
    try {
      // Fetch both event types in parallel
      const [crRes, aeRes] = await Promise.all([
        supabase
          .from('castle_rush')
          .select(`
            id,
            castle,
            date,
            castle_rush_entry (
              score,
              attendance
            )
          `)
          .order('date', { ascending: false })
          .limit(20),
        supabase
          .from('advent_expedition')
          .select(`
            id,
            date,
            advent_expedition_entry (
              total_score,
              attendance
            )
          `)
          .order('date', { ascending: false })
          .limit(20)
      ]);

      if (crRes.error) throw crRes.error;
      if (aeRes.error) throw aeRes.error;

      const crProcessed = (crRes.data || []).map((cr: any) => {
        const entries = cr.castle_rush_entry || [];
        const total_score = entries.reduce((sum: number, e: any) => sum + (e.score || 0), 0);
        const attendance_count = entries.filter((e: any) => e.attendance).length;
        return {
          id: cr.id,
          castle: cr.castle,
          date: cr.date,
          total_score,
          attendance_count,
        };
      });

      setCastleRushEvents(crProcessed);

      const aeProcessed = (aeRes.data || []).map((ae: any) => {
        const entries = ae.advent_expedition_entry || [];
        const attendedEntries = entries.filter((e: any) => e.attendance);
        const total_score = attendedEntries.reduce((sum: number, e: any) => sum + (e.total_score || 0), 0);
        const attendance_count = attendedEntries.length;
        return {
          id: ae.id,
          date: ae.date,
          total_score,
          attendance_count,
        };
      });

      setAdventEvents(aeProcessed);
    } catch (error) {
      // Error loading events
    } finally {
      setLoading(false);
    }
  }

  async function exportCastleRushToDiscord(eventId: string) {
    try {
      const { data: crData, error: crError } = await supabase
        .from('castle_rush')
        .select(`
          id,
          castle,
          date,
          castle_rush_entry (
            score,
            attendance,
            members (
              name,
              role
            )
          )
        `)
        .eq('id', eventId)
        .single();

      if (crError) throw crError;

      const entries = crData.castle_rush_entry || [];
      const attendedEntries = entries.filter((e: any) => e.attendance);
      const sortedEntries = attendedEntries
        .map((e: any) => ({
          name: e.members?.name || 'Unknown',
          role: e.members?.role || 'Member',
          score: e.score || 0
        }))
        .sort((a, b) => b.score - a.score);

      const totalScore = sortedEntries.reduce((sum, e) => sum + e.score, 0);
      const avgScore = sortedEntries.length > 0 ? Math.round(totalScore / sortedEntries.length) : 0;
      const grade = getScoreGrade(totalScore);
      const date = new Date(crData.date + 'T00:00:00').toLocaleDateString('en-US', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      });

      let discordText = `**🏰 Castle Rush - ${crData.castle}**\n`;
      discordText += `📅 ${date}\n`;
      discordText += `\n**Guild Performance:**\n`;
      discordText += `• Total Score: **${totalScore.toLocaleString()}** (${grade.grade})\n`;
      discordText += `• Attendance: **${sortedEntries.length}** members\n`;
      discordText += `• Average Score: **${avgScore.toLocaleString()}**\n`;
      discordText += `\n**Member Scores:**\n`;
      
      sortedEntries.forEach((entry, idx) => {
        const medal = idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : `${idx + 1}.`;
        const roleTag = entry.role ? ` [${entry.role}]` : '';
        discordText += `${medal} **${entry.name}**${roleTag} - ${entry.score.toLocaleString()}\n`;
      });

      await navigator.clipboard.writeText(discordText);
      showToast('Discord message copied to clipboard! 📋');
    } catch (error) {
      showToast('Failed to export data');
    }
  }

  async function postCastleRushToDiscord(eventId: string) {
    const webhookUrl = process.env.NEXT_PUBLIC_DISCORD_WEBHOOK_URL;
    
    if (!webhookUrl) {
      showToast('Discord webhook not configured');
      return;
    }

    try {
      const { data: crData, error: crError } = await supabase
        .from('castle_rush')
        .select(`
          id,
          castle,
          date,
          castle_rush_entry (
            score,
            attendance,
            members (
              name,
              role
            )
          )
        `)
        .eq('id', eventId)
        .single();

      if (crError) throw crError;

      const entries = crData.castle_rush_entry || [];
      const attendedEntries = entries.filter((e: any) => e.attendance);
      const sortedEntries = attendedEntries
        .map((e: any) => ({
          name: e.members?.name || 'Unknown',
          role: e.members?.role || 'Member',
          score: e.score || 0
        }))
        .sort((a, b) => b.score - a.score);

      const totalScore = sortedEntries.reduce((sum, e) => sum + e.score, 0);
      const avgScore = sortedEntries.length > 0 ? Math.round(totalScore / sortedEntries.length) : 0;
      const grade = getScoreGrade(totalScore);
      const date = new Date(crData.date + 'T00:00:00').toLocaleDateString('en-US', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      });

      // Build member list
      let memberList = '';
      sortedEntries.forEach((entry, idx) => {
        const medal = idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : `${idx + 1}.`;
        const roleTag = entry.role ? ` [${entry.role}]` : '';
        memberList += `${medal} **${entry.name}**${roleTag} - ${entry.score.toLocaleString()}\n`;
      });

      // Send to Discord with embed
      const response = await fetch(webhookUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          embeds: [{
            title: `🏰 Castle Rush - ${crData.castle}`,
            description: `📅 ${date}`,
            color: parseInt(grade.color.replace('#', ''), 16),
            fields: [
              {
                name: '📊 Guild Performance',
                value: `• Total Score: **${totalScore.toLocaleString()}** (${grade.grade})\n• Attendance: **${sortedEntries.length}** members\n• Average Score: **${avgScore.toLocaleString()}**`,
                inline: false
              },
              {
                name: '👥 Member Scores',
                value: memberList.length > 1024 ? memberList.substring(0, 1020) + '...' : memberList,
                inline: false
              }
            ],
            timestamp: new Date().toISOString(),
            footer: {
              text: '7K Guild Management'
            }
          }]
        })
      });

      if (!response.ok) {
        throw new Error('Discord webhook failed');
      }

      showToast('Posted to Discord! 🎉');
    } catch (error) {
      showToast('Failed to post to Discord');
    }
  }

  async function exportCastleRushToJSON(eventId: string) {
    try {
      const { data: crData, error: crError } = await supabase
        .from('castle_rush')
        .select(`
          id,
          castle,
          date,
          created_at,
          castle_rush_entry (
            score,
            attendance,
            members (
              id,
              name,
              role
            )
          )
        `)
        .eq('id', eventId)
        .single();

      if (crError) throw crError;

      const entries = (crData.castle_rush_entry || []).map((e: any) => ({
        member_id: e.members?.id,
        member_name: e.members?.name,
        member_role: e.members?.role,
        score: e.score,
        attendance: e.attendance
      }));

      const totalScore = entries.filter(e => e.attendance).reduce((sum, e) => sum + (e.score || 0), 0);
      const attendanceCount = entries.filter(e => e.attendance).length;

      const exportData = {
        event_type: 'castle_rush',
        event_id: crData.id,
        castle: crData.castle,
        date: crData.date,
        created_at: crData.created_at,
        summary: {
          total_score: totalScore,
          attendance_count: attendanceCount,
          total_members: entries.length,
          average_score: attendanceCount > 0 ? Math.round(totalScore / attendanceCount) : 0,
          grade: getScoreGrade(totalScore).grade
        },
        entries: entries.sort((a, b) => (b.score || 0) - (a.score || 0))
      };

      const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `castle-rush-${crData.castle}-${crData.date}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      showToast('JSON file downloaded! 📥');
    } catch (error) {
      showToast('Failed to export data');
    }
  }

  async function exportAdventToDiscord(eventId: string) {
    try {
      const { data: aeData, error: aeError } = await supabase
        .from('advent_expedition')
        .select(`
          id,
          date,
          advent_expedition_entry (
            total_score,
            attendance,
            boss,
            members (
              name,
              role
            )
          )
        `)
        .eq('id', eventId)
        .single();

      if (aeError) throw aeError;

      const entries = aeData.advent_expedition_entry || [];
      const attendedEntries = entries.filter((e: any) => e.attendance);
      
      // Aggregate scores by member
      const memberScores = new Map<string, { name: string; role: string; score: number }>();
      attendedEntries.forEach((e: any) => {
        const name = e.members?.name || 'Unknown';
        const existing = memberScores.get(name);
        if (existing) {
          existing.score += e.total_score || 0;
        } else {
          memberScores.set(name, {
            name,
            role: e.members?.role || 'Member',
            score: e.total_score || 0
          });
        }
      });

      const sortedMembers = Array.from(memberScores.values()).sort((a, b) => b.score - a.score);
      const totalScore = sortedMembers.reduce((sum, m) => sum + m.score, 0);
      const avgScore = sortedMembers.length > 0 ? Math.round(totalScore / sortedMembers.length) : 0;
      const grade = getAdventGrade(totalScore);
      const date = new Date(aeData.date).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      });

      let discordText = `**🐉 Advent Expedition**\n`;
      discordText += `📅 ${date}\n`;
      discordText += `\n**Guild Performance:**\n`;
      discordText += `• Total Score: **${totalScore.toLocaleString()}** (${grade.grade})\n`;
      discordText += `• Participants: **${sortedMembers.length}** members\n`;
      discordText += `• Average Score: **${avgScore.toLocaleString()}**\n`;
      discordText += `\n**Member Scores:**\n`;
      
      sortedMembers.forEach((member, idx) => {
        const medal = idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : `${idx + 1}.`;
        const roleTag = member.role ? ` [${member.role}]` : '';
        discordText += `${medal} **${member.name}**${roleTag} - ${member.score.toLocaleString()}\n`;
      });

      await navigator.clipboard.writeText(discordText);
      showToast('Discord message copied to clipboard! 📋');
    } catch (error) {
      showToast('Failed to export data');
    }
  }

  async function postAdventToDiscord(eventId: string) {
    const webhookUrl = process.env.NEXT_PUBLIC_DISCORD_WEBHOOK_URL;
    
    if (!webhookUrl) {
      showToast('Discord webhook not configured');
      return;
    }

    try {
      const { data: aeData, error: aeError } = await supabase
        .from('advent_expedition')
        .select(`
          id,
          date,
          advent_expedition_entry (
            total_score,
            attendance,
            boss,
            members (
              name,
              role
            )
          )
        `)
        .eq('id', eventId)
        .single();

      if (aeError) throw aeError;

      const entries = aeData.advent_expedition_entry || [];
      const attendedEntries = entries.filter((e: any) => e.attendance);
      
      // Aggregate scores by member
      const memberScores = new Map<string, { name: string; role: string; score: number }>();
      attendedEntries.forEach((e: any) => {
        const name = e.members?.name || 'Unknown';
        const existing = memberScores.get(name);
        if (existing) {
          existing.score += e.total_score || 0;
        } else {
          memberScores.set(name, {
            name,
            role: e.members?.role || 'Member',
            score: e.total_score || 0
          });
        }
      });

      const sortedMembers = Array.from(memberScores.values()).sort((a, b) => b.score - a.score);
      const totalScore = sortedMembers.reduce((sum, m) => sum + m.score, 0);
      const avgScore = sortedMembers.length > 0 ? Math.round(totalScore / sortedMembers.length) : 0;
      const grade = getAdventGrade(totalScore);
      const date = new Date(aeData.date).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      });

      // Build member list
      let memberList = '';
      sortedMembers.forEach((member, idx) => {
        const medal = idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : `${idx + 1}.`;
        const roleTag = member.role ? ` [${member.role}]` : '';
        memberList += `${medal} **${member.name}**${roleTag} - ${member.score.toLocaleString()}\n`;
      });

      // Send to Discord with embed
      const response = await fetch(webhookUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          embeds: [{
            title: '🐉 Advent Expedition',
            description: `📅 ${date}`,
            color: parseInt(grade.color.replace('#', ''), 16),
            fields: [
              {
                name: '📊 Guild Performance',
                value: `• Total Score: **${totalScore.toLocaleString()}** (${grade.grade})\n• Participants: **${sortedMembers.length}** members\n• Average Score: **${avgScore.toLocaleString()}**`,
                inline: false
              },
              {
                name: '👥 Member Scores',
                value: memberList.length > 1024 ? memberList.substring(0, 1020) + '...' : memberList,
                inline: false
              }
            ],
            timestamp: new Date().toISOString(),
            footer: {
              text: '7K Guild Management'
            }
          }]
        })
      });

      if (!response.ok) {
        throw new Error('Discord webhook failed');
      }

      showToast('Posted to Discord! 🎉');
    } catch (error) {
      showToast('Failed to post to Discord');
    }
  }

  async function exportAdventToJSON(eventId: string) {
    try {
      const { data: aeData, error: aeError } = await supabase
        .from('advent_expedition')
        .select(`
          id,
          date,
          created_at,
          advent_expedition_entry (
            total_score,
            attendance,
            boss,
            members (
              id,
              name,
              role
            )
          )
        `)
        .eq('id', eventId)
        .single();

      if (aeError) throw aeError;

      const entries = (aeData.advent_expedition_entry || []).map((e: any) => ({
        member_id: e.members?.id,
        member_name: e.members?.name,
        member_role: e.members?.role,
        boss: e.boss,
        total_score: e.total_score,
        attendance: e.attendance
      }));

      const attendedEntries = entries.filter(e => e.attendance);
      const totalScore = attendedEntries.reduce((sum, e) => sum + (e.total_score || 0), 0);
      const uniqueMembers = new Set(attendedEntries.map(e => e.member_id)).size;

      const exportData = {
        event_type: 'advent_expedition',
        event_id: aeData.id,
        date: aeData.date,
        created_at: aeData.created_at,
        summary: {
          total_score: totalScore,
          unique_participants: uniqueMembers,
          total_entries: attendedEntries.length,
          average_score: uniqueMembers > 0 ? Math.round(totalScore / uniqueMembers) : 0,
          grade: getAdventGrade(totalScore).grade
        },
        entries: entries.sort((a, b) => (b.total_score || 0) - (a.total_score || 0))
      };

      const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `advent-expedition-${aeData.date}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      showToast('JSON file downloaded! 📥');
    } catch (error) {
      showToast('Failed to export data');
    }
  }

  if (loading) {
    return (
      <div className="p-8 flex items-center justify-center" style={{ minHeight: "400px" }}>
        <div className="text-lg" style={{ color: "var(--color-foreground)" }}>
          Loading events...
        </div>
      </div>
    );
  }

  return (
    <div className="p-4">
      <div className="mb-6">
        <h1 className="text-3xl font-bold mb-2" style={{ color: "var(--color-foreground)" }}>
          Export Data
        </h1>
        <p className="text-sm" style={{ color: "var(--color-muted)" }}>
          Export Castle Rush and Advent Expedition data for Discord or backup
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Castle Rush Events */}
        <div
          className="p-5 rounded-lg"
          style={{
            backgroundColor: "var(--color-surface)",
            border: "1px solid var(--color-border)",
          }}
        >
          <div className="flex items-center gap-2 mb-4">
            <FaCalendarAlt size={20} style={{ color: "#3b82f6" }} />
            <h2 className="text-xl font-bold" style={{ color: "var(--color-foreground)" }}>
              Castle Rush
            </h2>
            <span className="text-sm ml-auto" style={{ color: "var(--color-muted)" }}>
              {castleRushEvents.length} events
            </span>
          </div>

          {castleRushEvents.length > 0 ? (
            <div className="space-y-2 max-h-[600px] overflow-y-auto">
              {castleRushEvents.map((event) => {
                const grade = getScoreGrade(event.total_score);
                return (
                  <div
                    key={event.id}
                    className="p-3 rounded-lg"
                    style={{
                      backgroundColor: "rgba(59, 130, 246, 0.05)",
                      border: "1px solid var(--color-border)",
                    }}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div>
                        <div className="font-medium" style={{ color: "var(--color-foreground)" }}>
                          {event.castle}
                        </div>
                        <div className="text-xs" style={{ color: "var(--color-muted)" }}>
                          {new Date(event.date + 'T00:00:00').toLocaleDateString('en-US', {
                            month: 'short',
                            day: 'numeric',
                            year: 'numeric'
                          })}
                        </div>
                      </div>
                      <div className="text-right">
                        <div
                          className="px-2 py-1 rounded text-xs font-bold mb-1"
                          style={{
                            backgroundColor: grade.color,
                            color: "white",
                          }}
                        >
                          {grade.grade}
                        </div>
                        <div className="text-xs" style={{ color: "var(--color-muted)" }}>
                          {event.attendance_count} attended
                        </div>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => postCastleRushToDiscord(event.id)}
                        className="flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded text-sm font-medium hover:opacity-90 transition-opacity"
                        style={{
                          backgroundColor: "#5865F2",
                          color: "white",
                        }}
                      >
                        <FaDiscord size={14} />
                        Post
                      </button>
                      <button
                        onClick={() => exportCastleRushToDiscord(event.id)}
                        className="flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded text-sm font-medium hover:opacity-90 transition-opacity"
                        style={{
                          backgroundColor: "#7289DA",
                          color: "white",
                        }}
                      >
                        <FaDiscord size={14} />
                        Copy
                      </button>
                      <button
                        onClick={() => exportCastleRushToJSON(event.id)}
                        className="flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded text-sm font-medium hover:opacity-90 transition-opacity"
                        style={{
                          backgroundColor: "var(--color-primary)",
                          color: "white",
                        }}
                      >
                        <FaFileDownload size={14} />
                        JSON
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="text-center py-8" style={{ color: "var(--color-muted)" }}>
              No Castle Rush events found
            </div>
          )}
        </div>

        {/* Advent Expedition Events */}
        <div
          className="p-5 rounded-lg"
          style={{
            backgroundColor: "var(--color-surface)",
            border: "1px solid var(--color-border)",
          }}
        >
          <div className="flex items-center gap-2 mb-4">
            <FaDragon size={20} style={{ color: "#8b5cf6" }} />
            <h2 className="text-xl font-bold" style={{ color: "var(--color-foreground)" }}>
              Advent Expedition
            </h2>
            <span className="text-sm ml-auto" style={{ color: "var(--color-muted)" }}>
              {adventEvents.length} events
            </span>
          </div>

          {adventEvents.length > 0 ? (
            <div className="space-y-2 max-h-[600px] overflow-y-auto">
              {adventEvents.map((event) => {
                const grade = getAdventGrade(event.total_score);
                return (
                  <div
                    key={event.id}
                    className="p-3 rounded-lg"
                    style={{
                      backgroundColor: "rgba(139, 92, 246, 0.05)",
                      border: "1px solid var(--color-border)",
                    }}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div>
                        <div className="font-medium" style={{ color: "var(--color-foreground)" }}>
                          Advent Expedition
                        </div>
                        <div className="text-xs" style={{ color: "var(--color-muted)" }}>
                          {new Date(event.date).toLocaleDateString('en-US', {
                            month: 'short',
                            day: 'numeric',
                            year: 'numeric'
                          })}
                        </div>
                      </div>
                      <div className="text-right">
                        <div
                          className="px-2 py-1 rounded text-xs font-bold mb-1"
                          style={{
                            backgroundColor: grade.color,
                            color: "white",
                          }}
                        >
                          {grade.grade}
                        </div>
                        <div className="text-xs" style={{ color: "var(--color-muted)" }}>
                          {event.attendance_count} entries
                        </div>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => postAdventToDiscord(event.id)}
                        className="flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded text-sm font-medium hover:opacity-90 transition-opacity"
                        style={{
                          backgroundColor: "#5865F2",
                          color: "white",
                        }}
                      >
                        <FaDiscord size={14} />
                        Post
                      </button>
                      <button
                        onClick={() => exportAdventToDiscord(event.id)}
                        className="flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded text-sm font-medium hover:opacity-90 transition-opacity"
                        style={{
                          backgroundColor: "#7289DA",
                          color: "white",
                        }}
                      >
                        <FaDiscord size={14} />
                        Copy
                      </button>
                      <button
                        onClick={() => exportAdventToJSON(event.id)}
                        className="flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded text-sm font-medium hover:opacity-90 transition-opacity"
                        style={{
                          backgroundColor: "var(--color-primary)",
                          color: "white",
                        }}
                      >
                        <FaFileDownload size={14} />
                        JSON
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="text-center py-8" style={{ color: "var(--color-muted)" }}>
              No Advent Expedition events found
            </div>
          )}
        </div>
      </div>

      {/* Toast Notification */}
      {toast.visible && (
        <div
          className="fixed bottom-4 left-4 px-4 py-3 rounded-lg shadow-lg transition-opacity duration-300 flex items-center gap-2"
          style={{
            backgroundColor: "var(--color-surface)",
            border: "2px solid var(--color-primary)",
            color: "var(--color-foreground)",
            zIndex: 1000,
            opacity: toast.visible ? 1 : 0,
          }}
        >
          <span className="text-sm font-medium">{toast.message}</span>
        </div>
      )}
    </div>
  );
}
