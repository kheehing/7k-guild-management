"use client";

import { useState } from "react";
import { FaPlus } from "react-icons/fa";
import CastleRushEntryModal from "../CastleRushEntryModal";

export default function CastleRushTab() {
  const days = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
  const [isAddOpen, setIsAddOpen] = useState(false);

  return (
    <div>
      {/* Header with Add Entry button */}
      <div className="flex items-center gap-4 mb-6">
        <h2 className="text-2xl font-bold" style={{ color: "var(--color-foreground)" }}>
          Castle Rush Schedule
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

      {/* Day columns */}
      <div className="grid grid-cols-7 gap-4">
        {days.map((day) => (
          <div 
            key={day}
            className="p-4 rounded-lg"
            style={{
              backgroundColor: "var(--color-surface)",
              border: "1px solid var(--color-border)",
            }}
          >
            <h3 className="text-sm font-semibold mb-2" style={{ color: "var(--color-foreground)" }}>
              {day}
            </h3>
            <div style={{ color: "var(--color-muted)" }}>
              {/* Content for each day */}
            </div>
          </div>
        ))}
      </div>

      {/* Add Entry Modal */}
      <CastleRushEntryModal 
        isOpen={isAddOpen} 
        onClose={() => setIsAddOpen(false)} 
        days={days}
      />
    </div>
  );
}
