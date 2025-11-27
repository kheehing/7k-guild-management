"use client";

import { useState, useEffect } from "react";
import { FaPlus, FaEdit, FaTrash } from "react-icons/fa";
import AdventEntryModal from "../AdventEntryModal";
import { supabase } from "../../../lib/supabaseClient";

interface AdventEntry {
  id: string;
  date: string;
  total_score?: number;
  attendance_count?: number;
  total_members?: number;
  boss_scores?: Record<string, number>;
}

const BOSSES = ["Teo", "Kyle", "Yeonhee", "Karma"];

// Function to get grade based on score
function getScoreGrade(score: number): { grade: string; color: string; bgColor: string } {
  if (score >= 400000000) return { grade: "EX+", color: "#FF1493", bgColor: "linear-gradient(135deg, #FFB6C1 0%, #FF69B4 50%, #FF1493 100%)" };
  if (score >= 300000000) return { grade: "EX", color: "#4169E1", bgColor: "linear-gradient(135deg, #B8C5FF 0%, #6B8EFF 50%, #4169E1 100%)" };
  if (score >= 200000000) return { grade: "SSS", color: "#8B7355", bgColor: "linear-gradient(135deg, #D4AF7A 0%, #B8956B 50%, #8B7355 100%)" };
  if (score >= 150000000) return { grade: "SS", color: "#B8860B", bgColor: "linear-gradient(135deg, #FFD700 0%, #DAA520 50%, #B8860B 100%)" };
  if (score >= 100000000) return { grade: "S", color: "#8B0000", bgColor: "linear-gradient(135deg, #DC143C 0%, #B22222 50%, #8B0000 100%)" };
  if (score >= 75000000) return { grade: "A", color: "#4B0082", bgColor: "linear-gradient(135deg, #9370DB 0%, #6A5ACD 50%, #4B0082 100%)" };
  if (score >= 50000000) return { grade: "B", color: "#2F4F4F", bgColor: "linear-gradient(135deg, #5F9EA0 0%, #2F4F4F 50%, #1C3738 100%)" };
  if (score >= 25000000) return { grade: "C", color: "#006400", bgColor: "linear-gradient(135deg, #32CD32 0%, #228B22 50%, #006400 100%)" };
  if (score >= 10000000) return { grade: "D", color: "#4A5568", bgColor: "linear-gradient(135deg, #A0AEC0 0%, #718096 50%, #4A5568 100%)" };
  return { grade: "F", color: "#8B4513", bgColor: "linear-gradient(135deg, #CD853F 0%, #A0522D 50%, #8B4513 100%)" };
}

export default function AdventTab() {
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [adventData, setAdventData] = useState<AdventEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedEntry, setSelectedEntry] = useState<string | null>(null);

  const handleDeleteEntry = async (entryId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    
    if (!confirm("Are you sure you want to delete this Advent Expedition entry? This will also delete all member scores for this entry.")) {
      return;
    }

    try {
      // Delete advent_expedition_entry records first
      const { error: entriesError } = await supabase
        .from('advent_expedition_entry')
        .delete()
        .eq('advent_expedition_id', entryId);

      if (entriesError) throw entriesError;

      // Delete the advent_expedition record
      const { error: adventError } = await supabase
        .from('advent_expedition')
        .delete()
        .eq('id', entryId);

      if (adventError) throw adventError;

      alert("Advent Expedition entry deleted successfully!");
      loadAdventData();
    } catch (error) {
      alert(`Failed to delete entry: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  useEffect(() => {
    loadAdventData();

    // Set up real-time subscriptions
    const aeChannel = supabase
      .channel('advent-tab-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'advent_expedition' }, () => loadAdventData())
      .subscribe();

    const aeEntryChannel = supabase
      .channel('advent-entry-tab-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'advent_expedition_entry' }, () => loadAdventData())
      .subscribe();

    return () => {
      supabase.removeChannel(aeChannel);
      supabase.removeChannel(aeEntryChannel);
    };
  }, []);

  async function loadAdventData() {
    setLoading(true);
    try {
      // Get recent advent expedition entries only (last 30 days)
      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
      
      const { data: adventExpeditions, error } = await supabase
        .from('advent_expedition')
        .select(`
          id,
          date,
          advent_expedition_entry (
            member_id,
            total_score,
            attendance,
            boss
          )
        `)
        .gte('date', thirtyDaysAgo)
        .order('date', { ascending: false })
        .limit(30);

      if (error) throw error;

      // Calculate totals for each advent expedition
      const processedData = (adventExpeditions || []).map((ae: any) => {
        const entries = ae.advent_expedition_entry || [];
        const total_score = entries.reduce((sum: number, e: any) => sum + (e.total_score || 0), 0);
        const attendance_count = entries.filter((e: any) => e.attendance).length;
        
        // Calculate unique members who participated (had at least one score > 0)
        const uniqueMembers = new Set(
          entries.filter((e: any) => e.attendance).map((e: any) => e.member_id)
        );
        
        // Calculate per-boss totals
        const boss_scores: Record<string, number> = {};
        BOSSES.forEach(boss => {
          const bossEntries = entries.filter((e: any) => e.boss === boss);
          boss_scores[boss] = bossEntries.reduce((sum: number, e: any) => sum + (e.total_score || 0), 0);
        });

        return {
          id: ae.id,
          date: ae.date,
          total_score,
          attendance_count,
          total_members: uniqueMembers.size,
          boss_scores,
        };
      });

      setAdventData(processedData);
    } catch (err) {
      // Error loading advent data
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="p-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold" style={{ color: "var(--color-foreground)" }}>
          Advent Expeditions
        </h2>
        <button
          onClick={() => setIsAddOpen(true)}
          className="flex items-center gap-2 px-4 py-2 rounded-lg transition-colors hover:opacity-90"
          style={{
            backgroundColor: "var(--color-primary)",
            color: "white",
          }}
        >
          <FaPlus />
          <span>Add Entry</span>
        </button>
      </div>

      {/* Loading State */}
      {loading ? (
        <div className="text-center py-8" style={{ color: "var(--color-muted)" }}>
          Loading advent expeditions...
        </div>
      ) : adventData.length === 0 ? (
        /* Empty State */
        <div 
          className="text-center py-12 rounded-lg"
          style={{
            backgroundColor: "var(--color-surface)",
            border: "1px solid var(--color-border)",
            color: "var(--color-muted)",
          }}
        >
          <p className="text-lg mb-2">No advent expeditions yet</p>
          <p className="text-sm">Click "Add Entry" to record your first expedition</p>
        </div>
      ) : (
        /* List of Entries */
        <div className="space-y-4">
          {adventData.map((entry) => {
            const date = new Date(entry.date + 'T00:00:00');
            const formattedDate = date.toLocaleDateString('en-US', { 
              year: 'numeric', 
              month: 'long', 
              day: 'numeric' 
            });

            return (
              <div
                key={entry.id}
                className="rounded-lg p-4 transition-all hover:shadow-lg"
                style={{
                  backgroundColor: "var(--color-surface)",
                  border: "1px solid var(--color-border)",
                }}
              >
                {/* Header Row */}
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <h3 className="text-xl font-bold mb-1" style={{ color: "var(--color-foreground)" }}>
                      {formattedDate}
                    </h3>
                    <p className="text-sm" style={{ color: "var(--color-muted)" }}>
                      2-Week Expedition Period
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => setSelectedEntry(entry.id)}
                      className="p-2 rounded hover:opacity-80 transition-opacity"
                      style={{
                        backgroundColor: "rgba(59, 130, 246, 0.8)",
                        color: "white",
                      }}
                      title="Edit entry"
                    >
                      <FaEdit />
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteEntry(entry.id, e);
                      }}
                      className="p-2 rounded hover:opacity-80 transition-opacity"
                      style={{
                        backgroundColor: "rgba(220, 38, 38, 0.8)",
                        color: "white",
                      }}
                      title="Delete entry"
                    >
                      <FaTrash />
                    </button>
                  </div>
                </div>

                {/* Stats Grid */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                  <div 
                    className="p-3 rounded"
                    style={{
                      backgroundColor: "var(--color-background)",
                      border: "1px solid var(--color-border)",
                    }}
                  >
                    <p className="text-xs mb-1" style={{ color: "var(--color-muted)" }}>
                      Total Score
                    </p>
                    <p className="text-lg font-bold" style={{ color: "var(--color-foreground)" }}>
                      {((entry.total_score || 0) / 1000000).toFixed(1)}M
                    </p>
                  </div>
                  <div 
                    className="p-3 rounded"
                    style={{
                      backgroundColor: "var(--color-background)",
                      border: "1px solid var(--color-border)",
                    }}
                  >
                    <p className="text-xs mb-1" style={{ color: "var(--color-muted)" }}>
                      Participation
                    </p>
                    <p className="text-lg font-bold" style={{ color: "var(--color-foreground)" }}>
                      {entry.attendance_count}/{(entry.total_members || 0) * 4}
                    </p>
                  </div>
                  <div 
                    className="p-3 rounded"
                    style={{
                      backgroundColor: "var(--color-background)",
                      border: "1px solid var(--color-border)",
                    }}
                  >
                    <p className="text-xs mb-1" style={{ color: "var(--color-muted)" }}>
                      Average Score
                    </p>
                    <p className="text-lg font-bold" style={{ color: "var(--color-foreground)" }}>
                      {(entry.attendance_count || 0) > 0 
                        ? ((entry.total_score || 0) / (entry.attendance_count || 1) / 1000000).toFixed(1) 
                        : "0"}M
                    </p>
                  </div>
                  <div 
                    className="p-3 rounded"
                    style={{
                      backgroundColor: "var(--color-background)",
                      border: "1px solid var(--color-border)",
                    }}
                  >
                    <p className="text-xs mb-1" style={{ color: "var(--color-muted)" }}>
                      Participants
                    </p>
                    <p className="text-lg font-bold" style={{ color: "var(--color-foreground)" }}>
                      {entry.total_members || 0}
                    </p>
                  </div>
                </div>

                {/* Boss Breakdown */}
                <div>
                  <p className="text-sm font-semibold mb-2" style={{ color: "var(--color-foreground)" }}>
                    Boss Scores
                  </p>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                    {BOSSES.map(boss => {
                      const bossScore = entry.boss_scores?.[boss] || 0;
                      return (
                        <div 
                          key={boss}
                          className="p-2 rounded text-center"
                          style={{
                            backgroundColor: bossScore > 0 
                              ? "rgba(59, 130, 246, 0.1)" 
                              : "var(--color-background)",
                            border: "1px solid var(--color-border)",
                          }}
                        >
                          <p className="text-xs mb-1" style={{ color: "var(--color-muted)" }}>
                            {boss}
                          </p>
                          <p 
                            className="text-sm font-bold" 
                            style={{ 
                              color: bossScore > 0 
                                ? "var(--color-foreground)" 
                                : "var(--color-muted)" 
                            }}
                          >
                            {(bossScore / 1000000).toFixed(1)}M
                          </p>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Add/Edit Entry Modal */}
      <AdventEntryModal 
        isOpen={isAddOpen || !!selectedEntry} 
        onClose={() => {
          setIsAddOpen(false);
          setSelectedEntry(null);
          loadAdventData();
        }} 
        editEntryId={selectedEntry}
      />
    </div>
  );
}
