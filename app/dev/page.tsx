"use client";

import { useState } from "react";

type TabType = "castle-rush";

export default function DevPage() {
  const [activeTab, setActiveTab] = useState<TabType>("castle-rush");

  return (
    <div className="min-h-screen p-8" style={{ backgroundColor: "var(--color-background)" }}>
      <div className="max-w-7xl mx-auto">
        <h1 className="text-3xl font-bold mb-6" style={{ color: "var(--color-foreground)" }}>Developer Tools</h1>
        
        {/* Tab Navigation */}
        <div className="flex gap-2 mb-6 border-b pb-2" style={{ borderColor: "var(--color-border)" }}>
          <button
            onClick={() => setActiveTab("castle-rush")}
            className="px-4 py-2 font-medium transition-colors rounded-t"
            style={{
              color: activeTab === "castle-rush" ? "var(--color-primary)" : "var(--color-muted)",
              backgroundColor: activeTab === "castle-rush" ? "rgba(128, 128, 128, 0.1)" : "transparent",
            }}
          >
            Castle Rush Entries
          </button>
        </div>

        {/* Tab Content */}
        <div>
          {activeTab === "castle-rush" && <CastleRushDevTab />}
        </div>
      </div>
    </div>
  );
}

function CastleRushDevTab() {
  const [selectedDate, setSelectedDate] = useState("");
  const [entries, setEntries] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  const handleDateSearch = async () => {
    if (!selectedDate) return;

    setLoading(true);
    try {
      const response = await fetch(`/api/dev/castle-rush-entries?date=${selectedDate}`);
      if (!response.ok) throw new Error("Failed to fetch entries");
      const data = await response.json();
      setEntries(data.entries || []);
    } catch (error) {
      console.error("Error fetching entries:", error);
      alert("Failed to fetch entries");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex gap-4 items-end">
        <div>
          <label htmlFor="dev-date" className="block text-sm mb-1" style={{ color: "var(--color-foreground)" }}>Select Date</label>
          <input
            id="dev-date"
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            className="px-3 py-2 rounded border"
            style={{
              background: "var(--color-surface)",
              borderColor: "var(--color-border)",
              color: "var(--color-foreground)",
              colorScheme: "dark",
            }}
          />
        </div>
        <button
          onClick={handleDateSearch}
          disabled={!selectedDate || loading}
          className="px-4 py-2 rounded"
          style={{
            backgroundColor: !selectedDate || loading ? "rgba(128, 128, 128, 0.3)" : "var(--color-primary)",
            color: "white",
            opacity: !selectedDate || loading ? 0.6 : 1,
            cursor: !selectedDate || loading ? "not-allowed" : "pointer",
          }}
        >
          {loading ? "Loading..." : "Search"}
        </button>
      </div>

      {entries.length > 0 && (
        <div className="rounded-lg border overflow-hidden" style={{ borderColor: "var(--color-border)", backgroundColor: "var(--color-surface)" }}>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b" style={{ borderColor: "var(--color-border)", backgroundColor: "rgba(128, 128, 128, 0.1)" }}>
                  <th className="text-left px-4 py-3 text-sm font-medium" style={{ color: "var(--color-foreground)" }}>Entry ID</th>
                  <th className="text-left px-4 py-3 text-sm font-medium" style={{ color: "var(--color-foreground)" }}>Member ID</th>
                  <th className="text-left px-4 py-3 text-sm font-medium" style={{ color: "var(--color-foreground)" }}>Member Name</th>
                  <th className="text-left px-4 py-3 text-sm font-medium" style={{ color: "var(--color-foreground)" }}>Score</th>
                  <th className="text-left px-4 py-3 text-sm font-medium" style={{ color: "var(--color-foreground)" }}>Attendance</th>
                  <th className="text-left px-4 py-3 text-sm font-medium" style={{ color: "var(--color-foreground)" }}>Castle Rush ID</th>
                  <th className="text-left px-4 py-3 text-sm font-medium" style={{ color: "var(--color-foreground)" }}>Castle</th>
                  <th className="text-left px-4 py-3 text-sm font-medium" style={{ color: "var(--color-foreground)" }}>Created At</th>
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
                    <td className="px-4 py-3 text-sm font-mono" style={{ color: "var(--color-muted)" }}>{entry.id}</td>
                    <td className="px-4 py-3 text-sm font-mono" style={{ color: "var(--color-muted)" }}>{entry.member_id}</td>
                    <td className="px-4 py-3 text-sm" style={{ color: "var(--color-foreground)" }}>{entry.member_name || "N/A"}</td>
                    <td className="px-4 py-3 text-sm" style={{ color: "var(--color-foreground)" }}>{entry.score?.toLocaleString() || 0}</td>
                    <td className="px-4 py-3 text-sm">
                      <span className="px-2 py-1 rounded text-xs" style={{
                        backgroundColor: entry.attendance ? "rgba(34, 197, 94, 0.2)" : "rgba(239, 68, 68, 0.2)",
                        color: entry.attendance ? "#22C55E" : "#EF4444"
                      }}>
                        {entry.attendance ? "Yes" : "No"}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm font-mono" style={{ color: "var(--color-muted)" }}>{entry.castle_rush_id}</td>
                    <td className="px-4 py-3 text-sm" style={{ color: "var(--color-foreground)" }}>{entry.castle || "N/A"}</td>
                    <td className="px-4 py-3 text-sm" style={{ color: "var(--color-muted)" }}>{new Date(entry.created_at).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="px-4 py-3 text-sm border-t" style={{ borderColor: "var(--color-border)", backgroundColor: "rgba(128, 128, 128, 0.05)", color: "var(--color-foreground)" }}>
            Total Entries: {entries.length}
          </div>
        </div>
      )}

      {!loading && entries.length === 0 && selectedDate && (
        <div className="text-center py-8 text-sm" style={{ color: "var(--color-muted)" }}>
          No entries found for {new Date(selectedDate + 'T00:00:00').toLocaleDateString()}
        </div>
      )}
    </div>
  );
}
