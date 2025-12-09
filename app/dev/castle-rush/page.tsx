"use client";

import { useState, useEffect } from "react";
import { supabase } from "../../../lib/supabaseClient";
import { useRouter } from "next/navigation";
import { FaChevronLeft, FaChevronRight, FaArrowLeft } from "react-icons/fa";

type ViewMode = "calendar" | "edit";

export default function DevCastleRushPage() {
  const [viewMode, setViewMode] = useState<ViewMode>("calendar");
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [calendarEvents, setCalendarEvents] = useState<any[]>([]);
  const [entries, setEntries] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editScore, setEditScore] = useState("");
  const [editAttendance, setEditAttendance] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const router = useRouter();

  useEffect(() => {
    checkAuth();
  }, []);

  async function checkAuth() {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      router.push("/");
    } else {
      setIsAuthenticated(true);
    }
  }

  useEffect(() => {
    if (viewMode === "calendar" && isAuthenticated) {
      loadCalendarEvents();
    }
  }, [currentDate, viewMode, isAuthenticated]);

  const loadCalendarEvents = async () => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    const firstDay = new Date(year, month, 1).toISOString().split('T')[0];
    const lastDay = new Date(year, month + 1, 0).toISOString().split('T')[0];

    try {
      const { data } = await supabase
        .from('castle_rush')
        .select(`
          id, 
          date, 
          castle,
          castle_rush_entry (id)
        `)
        .gte('date', firstDay)
        .lte('date', lastDay)
        .order('date');

      const processedData = (data || []).map((event: any) => ({
        id: event.id,
        date: event.date,
        castle: event.castle,
        entryCount: Array.isArray(event.castle_rush_entry) ? event.castle_rush_entry.length : 0,
      }));

      setCalendarEvents(processedData);
    } catch (error) {
      // Error loading calendar
    }
  };

  const handleDateClick = async (dateStr: string) => {
    setSelectedDate(dateStr);
    setLoading(true);
    setViewMode("edit");

    try {
      const response = await fetch(`/api/dev/castle-rush-entries?date=${dateStr}`);
      if (!response.ok) throw new Error("Failed to fetch entries");
      const data = await response.json();
      setEntries(data.entries || []);
    } finally {
      setLoading(false);
    }
  };

  const handleBackToCalendar = () => {
    setViewMode("calendar");
    setSelectedDate(null);
    setEntries([]);
    setEditingId(null);
  };

  const handleDeleteCastleRush = async () => {
    if (!selectedDate) return;
    
    if (!confirm(`Are you sure you want to delete ALL Castle Rush entries for ${new Date(selectedDate + 'T00:00:00').toLocaleDateString('en-US', { 
      month: 'long', 
      day: 'numeric', 
      year: 'numeric' 
    })}? This will delete the castle rush event and all associated member entries.`)) return;

    try {
      setLoading(true);
      
      // Get the castle_rush record for this date
      const { data: castleRushData, error: fetchError } = await supabase
        .from('castle_rush')
        .select('id')
        .eq('date', selectedDate)
        .single();

      if (fetchError) throw fetchError;
      if (!castleRushData) {
        alert("Castle Rush entry not found");
        return;
      }

      // Delete all castle_rush_entry records first (foreign key constraint)
      const { error: entriesError } = await supabase
        .from('castle_rush_entry')
        .delete()
        .eq('castle_rush_id', castleRushData.id);

      if (entriesError) throw entriesError;

      // Delete the castle_rush record
      const { error: castleRushError } = await supabase
        .from('castle_rush')
        .delete()
        .eq('id', castleRushData.id);

      if (castleRushError) throw castleRushError;

      alert("Castle Rush entry deleted successfully");
      handleBackToCalendar();
      loadCalendarEvents(); // Refresh calendar
    } catch (error) {
      console.error("Delete error:", error);
      alert("Failed to delete Castle Rush entry");
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (entryId: string) => {
    if (!confirm("Are you sure you want to delete this entry?")) return;

    try {
      const { error } = await supabase
        .from("castle_rush_entry")
        .delete()
        .eq("id", entryId);

      if (error) throw error;

      setEntries(entries.filter(e => e.id !== entryId));
    } catch (error) {
      alert("Failed to delete entry");
    }
  };

  const startEdit = (entry: any) => {
    setEditingId(entry.id);
    setEditScore(entry.score?.toString() || "0");
    setEditAttendance(entry.attendance);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditScore("");
    setEditAttendance(false);
  };

  const saveEdit = async (entryId: string) => {
    try {
      const { error } = await supabase
        .from("castle_rush_entry")
        .update({
          score: parseInt(editScore) || 0,
          attendance: editAttendance,
        })
        .eq("id", entryId);

      if (error) throw error;

      setEntries(entries.map(e => 
        e.id === entryId 
          ? { ...e, score: parseInt(editScore) || 0, attendance: editAttendance }
          : e
      ));
      cancelEdit();
    } catch (error) {
      alert("Failed to update entry");
    }
  };

  const getDaysInMonth = () => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const daysInMonth = lastDay.getDate();
    const startingDayOfWeek = firstDay.getDay();

    const days = [];
    for (let i = 0; i < startingDayOfWeek; i++) {
      days.push(null);
    }
    for (let i = 1; i <= daysInMonth; i++) {
      days.push(i);
    }
    return days;
  };

  const getEventsForDay = (day: number) => {
    const dateStr = new Date(currentDate.getFullYear(), currentDate.getMonth(), day)
      .toISOString().split('T')[0];
    return calendarEvents.filter(e => e.date === dateStr);
  };

  const previousMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1));
  };

  const nextMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1));
  };

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: "var(--color-bg)" }}>
        <div style={{ color: "var(--color-muted)" }}>Loading...</div>
      </div>
    );
  }

  if (viewMode === "calendar") {
    return (
      <div className="min-h-screen p-8" style={{ backgroundColor: "var(--color-bg)" }}>
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center justify-between mb-6">
            <h1 className="text-3xl font-bold" style={{ color: "var(--color-foreground)" }}>Castle Rush Entries</h1>
            <button
              onClick={() => router.push("/dev")}
              className="px-4 py-2 rounded"
              style={{
                backgroundColor: "var(--color-surface)",
                border: "1px solid var(--color-border)",
                color: "var(--color-foreground)",
              }}
            >
              ← Back to Dev Tools
            </button>
          </div>

          <div className="space-y-4">
            {/* Calendar Header */}
            <div className="flex items-center justify-between mb-4">
              <button
                onClick={previousMonth}
                className="p-2 rounded hover:bg-opacity-80 transition-colors"
                style={{ backgroundColor: "var(--color-surface)" }}
              >
                <FaChevronLeft style={{ color: "var(--color-foreground)" }} />
              </button>
              <h2 className="text-xl font-bold" style={{ color: "var(--color-foreground)" }}>
                {currentDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
              </h2>
              <button
                onClick={nextMonth}
                className="p-2 rounded hover:bg-opacity-80 transition-colors"
                style={{ backgroundColor: "var(--color-surface)" }}
              >
                <FaChevronRight style={{ color: "var(--color-foreground)" }} />
              </button>
            </div>

            {/* Calendar Grid */}
            <div className="rounded-lg border overflow-hidden" style={{ borderColor: "var(--color-border)", backgroundColor: "var(--color-surface)" }}>
              {/* Weekday Headers */}
              <div className="grid grid-cols-7 border-b" style={{ borderColor: "var(--color-border)" }}>
                {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
                  <div key={day} className="p-3 text-center font-semibold text-sm" style={{ color: "var(--color-muted)" }}>
                    {day}
                  </div>
                ))}
              </div>
              
              {/* Calendar Days */}
              <div className="grid grid-cols-7">
                {getDaysInMonth().map((day, index) => {
                  const events = day ? getEventsForDay(day) : [];
                  const hasEvents = events.length > 0;
                  
                  return (
                    <div
                      key={index}
                      onClick={() => day && hasEvents && handleDateClick(
                        new Date(currentDate.getFullYear(), currentDate.getMonth(), day).toISOString().split('T')[0]
                      )}
                      className="min-h-[100px] p-2 border-r border-b transition-colors"
                      style={{
                        borderColor: "var(--color-border)",
                        backgroundColor: day ? (hasEvents ? "rgba(128, 128, 128, 0.05)" : "transparent") : "rgba(128, 128, 128, 0.02)",
                        cursor: day && hasEvents ? "pointer" : "default",
                      }}
                    >
                      {day && (
                        <>
                          <div className="text-sm font-medium mb-1" style={{ color: "var(--color-foreground)" }}>
                            {day}
                          </div>
                          {events.map(event => (
                            <div
                              key={event.id}
                              className="text-xs px-2 py-1 rounded mb-1"
                              style={{
                                backgroundColor: "var(--color-primary)",
                                color: "white",
                              }}
                            >
                              <div className="truncate font-medium">{event.castle}</div>
                              <div className="text-[10px] opacity-80">{event.entryCount} entries</div>
                            </div>
                          ))}
                        </>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Edit View
  return (
    <div className="min-h-screen p-8" style={{ backgroundColor: "var(--color-bg)" }}>
      <div className="max-w-7xl mx-auto">
        <div className="space-y-4">
          {/* Back Button and Delete Castle Rush Button */}
          <div className="flex items-center justify-between">
            <button
              onClick={handleBackToCalendar}
              className="flex items-center gap-2 px-4 py-2 rounded transition-colors"
              style={{
                backgroundColor: "var(--color-surface)",
                color: "var(--color-foreground)",
              }}
            >
              <FaArrowLeft />
              Back to Calendar
            </button>

            <button
              onClick={handleDeleteCastleRush}
              disabled={loading}
              className="px-4 py-2 rounded transition-colors"
              style={{
                backgroundColor: "#EF4444",
                color: "white",
                opacity: loading ? 0.5 : 1,
                cursor: loading ? "not-allowed" : "pointer",
              }}
            >
              Delete Castle Rush Entry
            </button>
          </div>

          {/* Selected Date Header */}
          <div className="mb-4">
            <h2 className="text-xl font-bold" style={{ color: "var(--color-foreground)" }}>
              Entries for {selectedDate && new Date(selectedDate + 'T00:00:00').toLocaleDateString('en-US', { 
                month: 'long', 
                day: 'numeric', 
                year: 'numeric' 
              })}
            </h2>
          </div>

          {loading ? (
            <div className="text-center py-8" style={{ color: "var(--color-muted)" }}>Loading...</div>
          ) : entries.length > 0 ? (
            <div className="rounded-lg border overflow-hidden" style={{ borderColor: "var(--color-border)", backgroundColor: "var(--color-surface)" }}>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b" style={{ borderColor: "var(--color-border)", backgroundColor: "rgba(128, 128, 128, 0.1)" }}>
                      <th className="text-left px-4 py-3 text-sm font-medium" style={{ color: "var(--color-foreground)" }}>Member Name</th>
                      <th className="text-left px-4 py-3 text-sm font-medium" style={{ color: "var(--color-foreground)" }}>Kicked</th>
                      <th className="text-left px-4 py-3 text-sm font-medium" style={{ color: "var(--color-foreground)" }}>Score</th>
                      <th className="text-left px-4 py-3 text-sm font-medium" style={{ color: "var(--color-foreground)" }}>Attendance</th>
                      <th className="text-left px-4 py-3 text-sm font-medium" style={{ color: "var(--color-foreground)" }}>Castle</th>
                      <th className="text-left px-4 py-3 text-sm font-medium" style={{ color: "var(--color-foreground)" }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {entries.map((entry, index) => (
                      <tr 
                        key={entry.id}
                        className="border-b"
                        style={{ 
                          borderColor: "var(--color-border)",
                          backgroundColor: index % 2 === 0 ? "transparent" : "rgba(128, 128, 128, 0.03)"
                        }}
                      >
                        <td className="px-4 py-3 text-sm" style={{ color: "var(--color-foreground)" }}>{entry.member_name || "N/A"}</td>
                        <td className="px-4 py-3 text-sm">
                          {entry.kicked ? (
                            <span className="px-2 py-1 rounded text-xs" style={{ backgroundColor: "rgba(239, 68, 68, 0.2)", color: "#EF4444" }}>Kicked</span>
                          ) : (
                            <span className="px-2 py-1 rounded text-xs" style={{ backgroundColor: "rgba(34, 197, 94, 0.2)", color: "#22C55E" }}>Active</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-sm">
                          {editingId === entry.id ? (
                            <input
                              type="number"
                              value={editScore}
                              onChange={(e) => setEditScore(e.target.value)}
                              className="px-2 py-1 rounded border w-32"
                              style={{
                                backgroundColor: "var(--color-bg)",
                                borderColor: "var(--color-border)",
                                color: "var(--color-foreground)",
                              }}
                            />
                          ) : (
                            <span style={{ color: "var(--color-foreground)" }}>{entry.score?.toLocaleString() || 0}</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-sm">
                          {editingId === entry.id ? (
                            <input
                              type="checkbox"
                              checked={editAttendance}
                              onChange={(e) => setEditAttendance(e.target.checked)}
                              className="w-4 h-4"
                            />
                          ) : (
                            <span className="px-2 py-1 rounded text-xs" style={{
                              backgroundColor: entry.attendance ? "rgba(34, 197, 94, 0.2)" : "rgba(239, 68, 68, 0.2)",
                              color: entry.attendance ? "#22C55E" : "#EF4444"
                            }}>
                              {entry.attendance ? "Yes" : "No"}
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-sm" style={{ color: "var(--color-foreground)" }}>{entry.castle || "N/A"}</td>
                        <td className="px-4 py-3 text-sm">
                          {editingId === entry.id ? (
                            <div className="flex gap-2">
                              <button
                                onClick={() => saveEdit(entry.id)}
                                className="px-3 py-1 rounded text-xs font-medium"
                                style={{ backgroundColor: "#22C55E", color: "white" }}
                              >
                                Save
                              </button>
                              <button
                                onClick={cancelEdit}
                                className="px-3 py-1 rounded text-xs font-medium"
                                style={{ backgroundColor: "var(--color-muted)", color: "white" }}
                              >
                                Cancel
                              </button>
                            </div>
                          ) : (
                            <div className="flex gap-2">
                              <button
                                onClick={() => startEdit(entry)}
                                className="px-3 py-1 rounded text-xs font-medium"
                                style={{ backgroundColor: "var(--color-primary)", color: "white" }}
                              >
                                Edit
                              </button>
                              <button
                                onClick={() => handleDelete(entry.id)}
                                className="px-3 py-1 rounded text-xs font-medium"
                                style={{ backgroundColor: "#EF4444", color: "white" }}
                              >
                                Delete
                              </button>
                            </div>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="px-4 py-3 text-sm border-t" style={{ borderColor: "var(--color-border)", backgroundColor: "rgba(128, 128, 128, 0.05)", color: "var(--color-foreground)" }}>
                Total Entries: {entries.length}
              </div>
            </div>
          ) : (
            <div className="text-center py-8 text-sm" style={{ color: "var(--color-muted)" }}>
              No entries found for this date
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
