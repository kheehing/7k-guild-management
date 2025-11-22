import { FaTimes, FaPlus } from "react-icons/fa";
import { useState, useEffect, useCallback, useMemo } from "react";
import AddMemberForm from "./AddMemberForm";
import { supabase } from "../../lib/supabaseClient";

interface Member {
  id: string;
  name: string;
  role?: string;
  kicked?: boolean;
}

interface CastleRushEntryModalProps {
  isOpen: boolean;
  onClose: () => void;
  days: string[];
}

interface CastleInfo {
  day: string;
  boss: string;
  castle: string;
  recommendation: string[];
}

const CASTLE_SCHEDULE: Record<number, CastleInfo> = {
  1: { // Monday
    day: "Monday",
    boss: "Rudy",
    castle: "Guardian's Castle",
    recommendation: ["Magic", "Attacks 3-4 enemies"]
  },
  2: { // Tuesday
    day: "Tuesday",
    boss: "Eileene",
    castle: "Fodina Castle",
    recommendation: ["Magic", "Attacks 3-4 enemies"]
  },
  3: { // Wednesday
    day: "Wednesday",
    boss: "Rachel",
    castle: "Immortal Castle",
    recommendation: ["Magic", "Attacks 3-4 enemies"]
  },
  4: { // Thursday
    day: "Thursday",
    boss: "Dellons",
    castle: "Death Castle",
    recommendation: ["Physical", "Attacks 3-4 enemies"]
  },
  5: { // Friday
    day: "Friday",
    boss: "Jave",
    castle: "Ancient Dragon's Castle",
    recommendation: ["Physical", "Attacks 3-4 enemies"]
  },
  6: { // Saturday
    day: "Saturday",
    boss: "Spike",
    castle: "Blizzard Castle",
    recommendation: ["Physical", "Attacks 3-4 enemies"]
  },
  0: { // Sunday
    day: "Sunday",
    boss: "Kris",
    castle: "Hell Castle",
    recommendation: ["Any", "Single-target"]
  }
};

export default function CastleRushEntryModal({ isOpen, onClose, days }: CastleRushEntryModalProps) {
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState("");
  const [castleInfo, setCastleInfo] = useState<CastleInfo | null>(null);
  const [entries, setEntries] = useState<Record<string, string>>({});
  const [showAllMembers, setShowAllMembers] = useState(false);
  const [isAddMemberOpen, setIsAddMemberOpen] = useState(false);
  const [excludedMembers, setExcludedMembers] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (isOpen) {
      loadMembers();
    }
  }, [isOpen, selectedDate]);

  useEffect(() => {
    if (selectedDate) {
      const date = new Date(selectedDate + 'T00:00:00');
      const dayOfWeek = date.getDay();
      setCastleInfo(CASTLE_SCHEDULE[dayOfWeek]);
    } else {
      setCastleInfo(null);
    }
  }, [selectedDate]);

  async function loadMembers() {
    setLoading(true);
    try {
      const res = await fetch("/api/members");
      if (!res.ok) throw new Error("Failed to fetch members");
      const json = await res.json();
      const memberData = Array.isArray(json) ? json : json.members ?? [];
      
      // If a date is selected, fetch historical performance for that day of the week
      let performanceMap: Record<string, number> = {};
      if (selectedDate) {
        const date = new Date(selectedDate + 'T00:00:00');
        const dayOfWeek = date.getDay();
        const castleForDay = CASTLE_SCHEDULE[dayOfWeek]?.castle;
        
        if (castleForDay) {
          try {
            // Fetch all castle rush entries for this castle
            const { data: castleRushData } = await supabase
              .from('castle_rush')
              .select('id')
              .eq('castle', castleForDay);
            
            if (castleRushData && castleRushData.length > 0) {
              const castleRushIds = castleRushData.map(cr => cr.id);
              
              // Fetch all entries for these castle rushes
              const { data: entriesData } = await supabase
                .from('castle_rush_entry')
                .select('member_id, score')
                .in('castle_rush_id', castleRushIds)
                .not('score', 'is', null);
              
              if (entriesData) {
                // Calculate max score per member
                entriesData.forEach((entry: any) => {
                  const memberId = entry.member_id;
                  const score = entry.score || 0;
                  if (!performanceMap[memberId] || score > performanceMap[memberId]) {
                    performanceMap[memberId] = score;
                  }
                });
              }
            }
          } catch (err) {
            console.error("Error fetching performance data:", err);
          }
        }
      }
      
      // Sort based on performance if available, otherwise by role and name
      const sortedMembers = memberData.sort((a: Member, b: Member) => {
        const perfA = performanceMap[a.id] || 0;
        const perfB = performanceMap[b.id] || 0;
        
        // If we have performance data, sort by best performance (highest first)
        if (perfA !== perfB) {
          return perfB - perfA;
        }
        
        // Fallback to original sorting: non-Members first, then by role, then by name
        const roleA = (a.role ?? "Member").toLowerCase();
        const roleB = (b.role ?? "Member").toLowerCase();
        const nameA = (a.name ?? "").toLowerCase();
        const nameB = (b.name ?? "").toLowerCase();
        
        const isAMember = roleA === "member";
        const isBMember = roleB === "member";
        
        if (isAMember && !isBMember) return 1;
        if (!isAMember && isBMember) return -1;
        
        if (roleA !== roleB) {
          return roleA.localeCompare(roleB);
        }
        
        return nameA.localeCompare(nameB);
      });
      
      setMembers(sortedMembers);
    } catch (err) {
      console.error("Error loading members:", err);
    } finally {
      setLoading(false);
    }
  }

  const handleScoreChange = (memberId: string, score: string) => {
    setEntries(prev => ({
      ...prev,
      [memberId]: score
    }));
  };

  const handleToggleExclude = (memberId: string) => {
    setExcludedMembers((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(memberId)) {
        newSet.delete(memberId);
        // Clear the score when re-adding
      } else {
        newSet.add(memberId);
        // Clear the score when excluding
        setEntries((prevEntries) => {
          const newEntries = { ...prevEntries };
          delete newEntries[memberId];
          return newEntries;
        });
      }
      return newSet;
    });
  };

  const handleMemberAdded = useCallback((newMember: Member) => {
    setMembers((prev) => [newMember, ...prev]);
  }, []);

  // Filter members based on showAllMembers toggle - memoized
  const displayedMembers = useMemo(() => 
    showAllMembers ? members : members.filter((m) => m.kicked !== true),
    [showAllMembers, members]
  );

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!selectedDate) {
      alert("Please select a date");
      return;
    }

    if (!castleInfo) {
      alert("Castle information not available");
      return;
    }

    // Create castle_rush entry
    const castleRushData = {
      castle: castleInfo.castle,
      date: selectedDate,
      // logger_id will be added on the backend
    };

    // Create castle_rush_entry records for non-excluded members only
    const entriesData = displayedMembers
      .filter((member) => !excludedMembers.has(member.id))
      .map((member) => {
        const score = entries[member.id] ? parseInt(entries[member.id]) : null;
        return {
          member_id: member.id,
          attendance: score !== null && score > 0, // true if they have a score
          score: score,
          // castle_rush_id and logger_id will be added on the backend
        };
      });

    console.log("Submitting castle rush:", castleRushData);
    console.log("Submitting entries:", entriesData);
    // Add your submission logic here
    
    // Reset form
    setEntries({});
    setSelectedDate("");
    setCastleInfo(null);
    setExcludedMembers(new Set());
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      aria-modal="true"
      role="dialog"
    >
      <div
        className="absolute inset-0"
        onClick={onClose}
        style={{ background: "rgba(0,0,0,0.4)" }}
      />
      <form
        onSubmit={handleSubmit}
        className="relative z-10 w-full max-w-4xl p-6 rounded-lg max-h-[90vh] overflow-hidden flex flex-col"
        style={{
          background: "var(--color-surface)",
          border: "1px solid var(--color-border)",
          color: "var(--color-foreground)",
        }}
      >
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-medium">Add Castle Rush Entries</h3>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded"
            aria-label="Close"
            style={{ color: "var(--color-foreground)" }}
          >
            <FaTimes />
          </button>
        </div>

        <div className="flex-1 overflow-auto space-y-4">
          <div>
            <label htmlFor="date" className="block text-sm mb-1">Select Date</label>
            <input
              id="date"
              name="date"
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="w-full px-3 py-2 rounded border"
              required
              style={{
                background: "rgba(128, 128, 128, 0.1)",
                borderColor: "var(--color-border)",
                color: "var(--color-foreground)",
              }}
            />
          </div>

          {castleInfo && (
            <div 
              className="p-4 rounded-lg"
              style={{
                backgroundColor: "rgba(128, 128, 128, 0.05)",
                border: "1px solid var(--color-border)",
              }}
            >
              <div className="space-y-3">
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <div className="text-xs mb-1" style={{ color: "var(--color-muted)" }}>Day</div>
                    <div className="font-medium">{castleInfo.day}</div>
                  </div>
                  <div>
                    <div className="text-xs mb-1" style={{ color: "var(--color-muted)" }}>Boss</div>
                    <div className="font-medium">{castleInfo.boss}</div>
                  </div>
                  <div>
                    <div className="text-xs mb-1" style={{ color: "var(--color-muted)" }}>Castle</div>
                    <div className="font-medium">{castleInfo.castle}</div>
                  </div>
                </div>
                <div>
                  <div className="text-xs mb-1" style={{ color: "var(--color-muted)" }}>Recommendation</div>
                  <div className="text-sm">
                    {castleInfo.recommendation.map((rec, idx) => (
                      <div key={idx}>{rec}</div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="block text-sm">Members & Scores</label>
              <div className="flex items-center gap-2">
                <label className="flex items-center gap-2 text-xs" style={{ color: "var(--color-muted)" }}>
                  <input
                    type="checkbox"
                    checked={showAllMembers}
                    onChange={(e) => setShowAllMembers(e.target.checked)}
                    className="rounded"
                  />
                  Show kicked members
                </label>
                <button
                  type="button"
                  onClick={() => setIsAddMemberOpen(true)}
                  className="px-2 py-1 rounded text-xs flex items-center gap-1"
                  style={{
                    backgroundColor: "var(--color-primary)",
                    color: "white",
                  }}
                >
                  <FaPlus size={10} />
                  Add Member
                </button>
              </div>
            </div>
            {loading ? (
              <div className="text-sm" style={{ color: "var(--color-muted)" }}>
                Loading members...
              </div>
            ) : (
              <div 
                className="border rounded-lg overflow-hidden"
                style={{ 
                  borderColor: "var(--color-border)"
                }}
              >
                <div className="grid grid-cols-2 gap-x-4">
                  {/* Left Column */}
                  <div>
                    <table className="w-full">
                      <thead className="sticky top-0">
                        <tr 
                          className="border-b"
                          style={{ 
                            borderColor: "var(--color-border)",
                            backgroundColor: "var(--color-surface)"
                          }}
                        >
                          <th className="text-left px-4 py-2 text-sm font-medium">Member Name</th>
                          <th className="text-right px-4 py-2 text-sm font-medium" style={{ width: "120px" }}>Score</th>
                          <th className="text-center px-2 py-2 text-sm font-medium" style={{ width: "80px" }}>Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        {displayedMembers.slice(0, Math.ceil(displayedMembers.length / 2)).map((member) => {
                          const isExcluded = excludedMembers.has(member.id);
                          return (
                            <tr 
                              key={member.id}
                              className="border-b"
                              style={{ 
                                borderColor: "var(--color-border)",
                                opacity: isExcluded ? 0.4 : (member.kicked ? 0.6 : 1)
                              }}
                            >
                              <td className="px-4 py-2 text-sm">
                                {member.name}
                                {member.kicked && <span className="ml-1 text-xs" style={{ color: "var(--color-muted)" }}>(kicked)</span>}
                                {isExcluded && <span className="ml-1 text-xs" style={{ color: "var(--color-muted)" }}>(excluded)</span>}
                              </td>
                              <td className="px-4 py-2" style={{ width: "120px" }}>
                                <input
                                  type="number"
                                  value={entries[member.id] || ""}
                                  onChange={(e) => handleScoreChange(member.id, e.target.value)}
                                  className="w-full px-2 py-1 rounded border text-right [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                                  placeholder="0"
                                  min="0"
                                  disabled={isExcluded}
                                  style={{
                                    background: "transparent",
                                    borderColor: "var(--color-border)",
                                    color: "var(--color-foreground)",
                                  }}
                                />
                              </td>
                              <td className="px-2 py-2 text-center" style={{ width: "80px" }}>
                                <button
                                  type="button"
                                  onClick={() => handleToggleExclude(member.id)}
                                  className="px-2 py-1 text-xs rounded"
                                  style={{
                                    backgroundColor: isExcluded ? "var(--color-primary)" : "rgba(128, 128, 128, 0.6)",
                                    color: "white",
                                  }}
                                >
                                  {isExcluded ? "Add" : "Remove"}
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>

                  {/* Right Column */}
                  <div>
                    <table className="w-full">
                      <thead className="sticky top-0">
                        <tr 
                          className="border-b"
                          style={{ 
                            borderColor: "var(--color-border)",
                            backgroundColor: "var(--color-surface)"
                          }}
                        >
                          <th className="text-left px-4 py-2 text-sm font-medium">Member Name</th>
                          <th className="text-right px-4 py-2 text-sm font-medium" style={{ width: "120px" }}>Score</th>
                          <th className="text-center px-2 py-2 text-sm font-medium" style={{ width: "80px" }}>Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        {displayedMembers.slice(Math.ceil(displayedMembers.length / 2)).map((member) => {
                          const isExcluded = excludedMembers.has(member.id);
                          return (
                            <tr 
                              key={member.id}
                              className="border-b"
                              style={{ 
                                borderColor: "var(--color-border)",
                                opacity: isExcluded ? 0.4 : (member.kicked ? 0.6 : 1)
                              }}
                            >
                              <td className="px-4 py-2 text-sm">
                                {member.name}
                                {member.kicked && <span className="ml-1 text-xs" style={{ color: "var(--color-muted)" }}>(kicked)</span>}
                                {isExcluded && <span className="ml-1 text-xs" style={{ color: "var(--color-muted)" }}>(excluded)</span>}
                              </td>
                              <td className="px-4 py-2" style={{ width: "120px" }}>
                                <input
                                  type="number"
                                  value={entries[member.id] || ""}
                                  onChange={(e) => handleScoreChange(member.id, e.target.value)}
                                  className="w-full px-2 py-1 rounded border text-right [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                                  placeholder="0"
                                  min="0"
                                  disabled={isExcluded}
                                  style={{
                                    background: "transparent",
                                    borderColor: "var(--color-border)",
                                    color: "var(--color-foreground)",
                                  }}
                                />
                              </td>
                              <td className="px-2 py-2 text-center" style={{ width: "80px" }}>
                                <button
                                  type="button"
                                  onClick={() => handleToggleExclude(member.id)}
                                  className="px-2 py-1 text-xs rounded"
                                  style={{
                                    backgroundColor: isExcluded ? "var(--color-primary)" : "rgba(128, 128, 128, 0.6)",
                                    color: "white",
                                  }}
                                >
                                  {isExcluded ? "Add" : "Remove"}
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="mt-4 pt-4 border-t flex items-center justify-end gap-2" style={{ borderColor: "var(--color-border)" }}>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded"
            style={{
              border: "1px solid var(--color-border)",
              color: "var(--color-foreground)",
            }}
          >
            Cancel
          </button>
          <button
            type="submit"
            className="px-4 py-2 rounded"
            style={{
              backgroundColor: "var(--color-primary)",
              color: "white",
            }}
          >
            Save
          </button>
        </div>
      </form>

      <AddMemberForm
        isOpen={isAddMemberOpen}
        onClose={() => setIsAddMemberOpen(false)}
        onMemberAdded={handleMemberAdded}
      />
    </div>
  );
}
