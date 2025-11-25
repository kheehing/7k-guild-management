"use client";

import { useState, useEffect } from "react";
import { FaPlus, FaHistory } from "react-icons/fa";
import CastleRushEntryModal from "../CastleRushEntryModal";
import HistoricalCastleRushModal from "../HistoricalCastleRushModal";
import { supabase } from "../../../lib/supabaseClient";

interface CastleRushEntry {
  id: string;
  castle: string;
  date: string;
  total_score?: number;
  attendance_count?: number;
  total_members?: number;
}

// Function to get grade based on score
function getScoreGrade(score: number): { grade: string; color: string; bgColor: string } {
  if (score >= 100000000) return { grade: "EX+", color: "#FF1493", bgColor: "linear-gradient(135deg, #FFB6C1 0%, #FF69B4 50%, #FF1493 100%)" }; // Pink EX
  if (score >= 75000000) return { grade: "EX", color: "#4169E1", bgColor: "linear-gradient(135deg, #B8C5FF 0%, #6B8EFF 50%, #4169E1 100%)" }; // Blue EX
  if (score >= 50000000) return { grade: "SSS", color: "#8B7355", bgColor: "linear-gradient(135deg, #D4AF7A 0%, #B8956B 50%, #8B7355 100%)" }; // SSS
  if (score >= 30000000) return { grade: "SS", color: "#B8860B", bgColor: "linear-gradient(135deg, #FFD700 0%, #DAA520 50%, #B8860B 100%)" }; // SS
  if (score >= 15000000) return { grade: "S", color: "#8B0000", bgColor: "linear-gradient(135deg, #DC143C 0%, #B22222 50%, #8B0000 100%)" }; // S
  if (score >= 10000000) return { grade: "A", color: "#4B0082", bgColor: "linear-gradient(135deg, #9370DB 0%, #6A5ACD 50%, #4B0082 100%)" }; // A
  if (score >= 7500000) return { grade: "B", color: "#2F4F4F", bgColor: "linear-gradient(135deg, #5F9EA0 0%, #2F4F4F 50%, #1C3738 100%)" }; // B (dark teal/cyan)
  if (score >= 5000000) return { grade: "C", color: "#006400", bgColor: "linear-gradient(135deg, #32CD32 0%, #228B22 50%, #006400 100%)" }; // C (green)
  if (score >= 2500000) return { grade: "D", color: "#4A5568", bgColor: "linear-gradient(135deg, #A0AEC0 0%, #718096 50%, #4A5568 100%)" }; // D
  return { grade: "F", color: "#8B4513", bgColor: "linear-gradient(135deg, #CD853F 0%, #A0522D 50%, #8B4513 100%)" }; // F
}

export default function CastleRushTab() {
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [isHistoricalOpen, setIsHistoricalOpen] = useState(false);
  const [castleRushData, setCastleRushData] = useState<CastleRushEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedEntry, setSelectedEntry] = useState<string | null>(null);
  const [currentDate, setCurrentDate] = useState(new Date());

  // Get calendar data for current month
  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const daysInMonth = lastDay.getDate();
  const startingDayOfWeek = firstDay.getDay();

  const monthNames = ["January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"];
  const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

  const handleDeleteEntry = async (entryId: string, e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent opening the edit modal
    
    if (!confirm("Are you sure you want to delete this Castle Rush entry? This will also delete all member scores for this entry.")) {
      return;
    }

    try {
      // Delete castle_rush_entry records first
      const { error: entriesError } = await supabase
        .from('castle_rush_entry')
        .delete()
        .eq('castle_rush_id', entryId);

      if (entriesError) throw entriesError;

      // Delete the castle_rush record
      const { error: castleRushError } = await supabase
        .from('castle_rush')
        .delete()
        .eq('id', entryId);

      if (castleRushError) throw castleRushError;

      alert("Castle Rush entry deleted successfully!");
      loadCastleRushData(); // Reload the data
    } catch (error) {
      alert(`Failed to delete entry: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  useEffect(() => {
    loadCastleRushData();
  }, [currentDate]);

  async function loadCastleRushData() {
    setLoading(true);
    try {
      // Get castle rush entries for current month only
      const firstDayStr = new Date(year, month, 1).toISOString().split('T')[0];
      const lastDayStr = new Date(year, month + 1, 0).toISOString().split('T')[0];
      
      const { data: castleRushes, error } = await supabase
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
        .gte('date', firstDayStr)
        .lte('date', lastDayStr)
        .order('date', { ascending: false });

      if (error) throw error;

      // Get total member count
      const { count: totalMembers } = await supabase
        .from('members')
        .select('*', { count: 'exact', head: true })
        .eq('kicked', false);

      // Calculate totals for each castle rush
      const processedData = (castleRushes || []).map((cr: any) => {
        const entries = cr.castle_rush_entry || [];
        const total_score = entries.reduce((sum: number, e: any) => sum + (e.score || 0), 0);
        const attendance_count = entries.filter((e: any) => e.attendance).length;
        
        return {
          id: cr.id,
          castle: cr.castle,
          date: cr.date,
          total_score,
          attendance_count,
          total_members: totalMembers || 0,
        };
      });

      setCastleRushData(processedData);
    } catch (err) {
    } finally {
      setLoading(false);
    }
  }

  // Get entry for a specific date
  const getEntryForDate = (day: number) => {
    // Format date as YYYY-MM-DD without timezone conversion
    const yearStr = year.toString();
    const monthStr = (month + 1).toString().padStart(2, '0');
    const dayStr = day.toString().padStart(2, '0');
    const dateStr = `${yearStr}-${monthStr}-${dayStr}`;
    return castleRushData.find(entry => entry.date === dateStr);
  };

  const previousMonth = () => {
    setCurrentDate(new Date(year, month - 1, 1));
  };

  const nextMonth = () => {
    setCurrentDate(new Date(year, month + 1, 1));
  };

  return (
    <div className="p-4">
      {/* Header with month navigation and Add Entry button */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <button
            onClick={previousMonth}
            className="px-3 py-1 rounded hover:opacity-80"
            style={{
              backgroundColor: "var(--color-surface)",
              border: "1px solid var(--color-border)",
              color: "var(--color-foreground)",
            }}
          >
            ← Previous
          </button>
          <h2 className="text-2xl font-bold" style={{ color: "var(--color-foreground)" }}>
            {monthNames[month]} {year}
          </h2>
          <button
            onClick={nextMonth}
            className="px-3 py-1 rounded hover:opacity-80"
            style={{
              backgroundColor: "var(--color-surface)",
              border: "1px solid var(--color-border)",
              color: "var(--color-foreground)",
            }}
          >
            Next →
          </button>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setIsHistoricalOpen(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-lg transition-colors hover:opacity-90"
            style={{
              backgroundColor: "rgba(245, 158, 11, 0.8)",
              color: "white",
            }}
          >
            <FaHistory />
            <span>Import Historical</span>
          </button>
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
      </div>

      {/* Calendar Grid */}
      <div 
        className="rounded-lg overflow-hidden"
        style={{
          backgroundColor: "var(--color-surface)",
          border: "1px solid var(--color-border)",
        }}
      >
        {/* Day names header */}
        <div className="grid grid-cols-7 border-b" style={{ borderColor: "var(--color-border)" }}>
          {dayNames.map((day) => (
            <div 
              key={day}
              className="p-2 text-center font-semibold text-sm"
              style={{ 
                color: "var(--color-foreground)",
                backgroundColor: "rgba(128, 128, 128, 0.05)",
              }}
            >
              {day}
            </div>
          ))}
        </div>

        {/* Calendar days */}
        <div className="grid grid-cols-7">
          {/* Empty cells for days before month starts */}
          {Array.from({ length: startingDayOfWeek }).map((_, index) => (
            <div 
              key={`empty-${index}`}
              className="border-r border-b p-2 h-24"
              style={{ 
                borderColor: "var(--color-border)",
                backgroundColor: "rgba(128, 128, 128, 0.02)",
              }}
            />
          ))}

          {/* Actual calendar days */}
          {Array.from({ length: daysInMonth }).map((_, index) => {
            const day = index + 1;
            const entry = getEntryForDate(day);
            const scoreGrade = entry ? getScoreGrade(entry.total_score || 0) : null;
            const isToday = new Date().toDateString() === new Date(year, month, day).toDateString();

            return (
              <div 
                key={day}
                className={`border-r border-b p-2 h-24 relative ${entry ? 'cursor-pointer hover:opacity-80' : ''}`}
                onClick={() => entry && setSelectedEntry(entry.id)}
                style={{ 
                  borderColor: "var(--color-border)",
                  backgroundColor: isToday ? "rgba(var(--color-primary-rgb, 59, 130, 246), 0.05)" : "transparent",
                }}
              >
                <div className="flex justify-between items-start mb-1">
                  <span 
                    className="text-sm font-medium"
                    style={{ 
                      color: isToday ? "var(--color-primary)" : "var(--color-foreground)",
                      fontWeight: isToday ? "bold" : "normal",
                    }}
                  >
                    {day}
                  </span>
                  {entry && (
                    <button
                      onClick={(e) => handleDeleteEntry(entry.id, e)}
                      className="p-0.5 rounded opacity-0 hover:opacity-100 transition-opacity text-xs leading-none"
                      style={{
                        backgroundColor: "rgba(220, 38, 38, 0.8)",
                        color: "white",
                        width: "16px",
                        height: "16px",
                      }}
                      title="Delete entry"
                    >
                      ×
                    </button>
                  )}
                </div>

                {loading ? (
                  <div className="text-xs" style={{ color: "var(--color-muted)" }}>...</div>
                ) : entry ? (
                  <div className="text-xs space-y-0.5">
                    <div style={{ color: "var(--color-muted)", fontSize: "0.7rem" }}>
                      {entry.attendance_count}/{entry.total_members}
                    </div>
                    <div 
                      className="font-bold px-2 py-1 rounded inline-block"
                      style={{ 
                        background: scoreGrade?.bgColor,
                        color: "white",
                        fontSize: "0.75rem",
                        textShadow: "0 1px 2px rgba(0,0,0,0.3)",
                        border: `1px solid ${scoreGrade?.color}`,
                      }}
                    >
                      {scoreGrade?.grade}
                    </div>
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      </div>

      {/* Add/Edit Entry Modal */}
      <CastleRushEntryModal 
        isOpen={isAddOpen || !!selectedEntry} 
        onClose={() => {
          setIsAddOpen(false);
          setSelectedEntry(null);
          loadCastleRushData(); // Reload data after adding/editing entry
        }} 
        days={dayNames}
        editEntryId={selectedEntry}
      />

      {/* Historical Import Modal */}
      <HistoricalCastleRushModal
        isOpen={isHistoricalOpen}
        onClose={() => {
          setIsHistoricalOpen(false);
          loadCastleRushData(); // Reload data after importing
        }}
      />
    </div>
  );
}
