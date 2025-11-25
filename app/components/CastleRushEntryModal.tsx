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
  editEntryId?: string | null;
}

interface CastleInfo {
  day: string;
  boss: string;
  castle: string;
}

const CASTLE_SCHEDULE: Record<number, CastleInfo> = {
  1: { // Monday
    day: "Monday",
    boss: "Rudy",
    castle: "Guardian's Castle"
  },
  2: { // Tuesday
    day: "Tuesday",
    boss: "Eileene",
    castle: "Fodina Castle"
  },
  3: { // Wednesday
    day: "Wednesday",
    boss: "Rachel",
    castle: "Immortal Castle"
  },
  4: { // Thursday
    day: "Thursday",
    boss: "Dellons",
    castle: "Death Castle"
  },
  5: { // Friday
    day: "Friday",
    boss: "Jave",
    castle: "Ancient Dragon's Castle"
  },
  6: { // Saturday
    day: "Saturday",
    boss: "Spike",
    castle: "Blizzard Castle"
  },
  0: { // Sunday
    day: "Sunday",
    boss: "Kris",
    castle: "Hell Castle"
  }
};

export default function CastleRushEntryModal({ isOpen, onClose, days, editEntryId }: CastleRushEntryModalProps) {
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState("");
  const [castleInfo, setCastleInfo] = useState<CastleInfo | null>(null);
  const [entries, setEntries] = useState<Record<string, string>>({});
  const [showAllMembers, setShowAllMembers] = useState(false);
  const [isAddMemberOpen, setIsAddMemberOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [existingEntryId, setExistingEntryId] = useState<string | null>(null);

  const loadExistingEntry = useCallback(async (entryId: string) => {
    setLoading(true);
    setExistingEntryId(entryId);
    try {
      // Fetch the castle rush entry
      const { data: castleRush, error: crError } = await supabase
        .from('castle_rush')
        .select('*')
        .eq('id', entryId)
        .single();

      if (crError) throw crError;

      // Set the date and castle info
      setSelectedDate(castleRush.date);
      const date = new Date(castleRush.date + 'T00:00:00');
      const dayOfWeek = date.getDay();
      setCastleInfo(CASTLE_SCHEDULE[dayOfWeek]);

      // Fetch all members
      const res = await fetch("/api/members");
      if (!res.ok) throw new Error("Failed to fetch members");
      const json = await res.json();
      const memberData = Array.isArray(json) ? json : json.members ?? [];

      // Fetch existing entry data
      const { data: existingEntries, error: entriesError } = await supabase
        .from('castle_rush_entry')
        .select('member_id, score, attendance')
        .eq('castle_rush_id', entryId);

      if (entriesError) throw entriesError;

      // Map existing scores to entries state
      const entriesMap: Record<string, string> = {};
      existingEntries?.forEach((entry: any) => {
        if (entry.score > 0) {
          entriesMap[entry.member_id] = entry.score.toString();
        }
      });
      setEntries(entriesMap);

      // Sort members
      const sortedMembers = memberData.sort((a: Member, b: Member) => {
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
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isOpen) {
      if (editEntryId) {
        loadExistingEntry(editEntryId);
      } else {
        // Reset state when opening for a new entry
        setExistingEntryId(null);
        setSelectedDate("");
        setEntries({});
        setCastleInfo(null);
        setSearchQuery("");
        loadMembers();
      }
    }
  }, [isOpen, editEntryId, loadExistingEntry]);

  useEffect(() => {
    if (selectedDate) {
      const date = new Date(selectedDate + 'T00:00:00');
      const dayOfWeek = date.getDay();
      setCastleInfo(CASTLE_SCHEDULE[dayOfWeek]);
      
      // Check if entry exists for this date (only when adding new, not editing)
      if (!editEntryId && !existingEntryId) {
        checkExistingEntry(selectedDate);
      }
    } else {
      setCastleInfo(null);
    }
  }, [selectedDate, editEntryId, existingEntryId]);

  const checkExistingEntry = async (date: string) => {
    try {
      const { data: existingEntry, error } = await supabase
        .from('castle_rush')
        .select('id')
        .eq('date', date)
        .single();

      if (!error && existingEntry) {
        const shouldUpdate = confirm(
          `An entry already exists for ${new Date(date + 'T00:00:00').toLocaleDateString()}. Would you like to update it instead?`
        );
        
        if (shouldUpdate) {
          // Load the existing entry for editing
          loadExistingEntry(existingEntry.id);
        } else {
          // Clear the date to prevent duplicate creation
          setSelectedDate("");
        }
      }
    } catch (err) {
      // No existing entry found, this is fine for new entries
    }
  };

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
            // Error fetching performance data
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
      // Error loading members
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

  const handleSearchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (displayedMembers.length === 1) {
        const member = displayedMembers[0];
        const numberMatch = searchQuery.match(/\s+(\d+)$/);
        if (numberMatch) {
          const score = numberMatch[1];
          handleScoreChange(member.id, score);
          setSearchQuery("");
        }
      }
    }
  };

  const handleFormKeyDown = (e: React.KeyboardEvent<HTMLFormElement>) => {
    if (e.key === 'Enter') {
      // Allow Enter to submit only if search bar is empty
      if (searchQuery.trim()) {
        e.preventDefault();
      }
      // If search is empty and target is not a button, also prevent
      else if ((e.target as HTMLElement).tagName !== 'BUTTON') {
        e.preventDefault();
      }
    }
  };

  const handleMemberAdded = useCallback((newMember: Member) => {
    setMembers((prev) => [newMember, ...prev]);
  }, []);

  // Filter members based on showAllMembers toggle - memoized
  const displayedMembers = useMemo(() => {
    let filtered = showAllMembers ? members : members.filter((m) => m.kicked !== true);
    
    // Apply search filter
    if (searchQuery.trim()) {
      // Remove trailing numbers (but keep spaces) from search query for filtering
      const queryWithoutNumbers = searchQuery.replace(/\s+\d+$/, '').toLowerCase().trim();
      filtered = filtered.filter((m) => 
        m.name.toLowerCase().includes(queryWithoutNumbers)
      );
    }
    
    return filtered;
  }, [showAllMembers, members, searchQuery]);

  // Members with scores, sorted by score (highest first)
  const membersWithScores = useMemo(() => {
    return Object.entries(entries)
      .filter(([_, score]) => score && parseInt(score) > 0)
      .map(([memberId, score]) => {
        const member = members.find(m => m.id === memberId);
        const scoreNum = parseInt(score) || 0;
        return member ? { member, score: scoreNum } : null;
      })
      .filter((item): item is { member: Member; score: number } => item !== null)
      .sort((a, b) => b.score - a.score);
  }, [entries, members]);

  // Calculate total score
  const totalScore = useMemo(() => {
    return Object.values(entries)
      .filter(score => score && score.trim() !== '')
      .reduce((sum, score) => sum + (parseInt(score) || 0), 0);
  }, [entries]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!selectedDate) {
      alert("Please select a date");
      return;
    }

    if (!castleInfo) {
      alert("Castle information not available");
      return;
    }

    // Prevent submitting if all scores are empty/0
    const hasAnyScore = Object.values(entries).some(score => score && parseInt(score) > 0);
    if (!hasAnyScore) {
      alert("Please enter at least one score before submitting");
      return;
    }

    setSubmitting(true);

    try {
      // Final check: ensure no duplicate entry exists for this date (when creating new)
      if (!editEntryId && !existingEntryId) {
        const { data: duplicateCheck } = await supabase
          .from('castle_rush')
          .select('id')
          .eq('date', selectedDate)
          .single();

        if (duplicateCheck) {
          alert("An entry already exists for this date. Please refresh the page and try editing the existing entry instead.");
          setSubmitting(false);
          return;
        }
      }

      // Create entries data for ALL members (not just displayed ones)
      const entriesData = members.map((member) => {
        const score = entries[member.id] ? parseInt(entries[member.id]) : 0;
        
        return {
          member_id: member.id,
          attendance: score > 0,
          score: score,
        };
      });

      if (editEntryId || existingEntryId) {
        // Update existing entry
        const entryToUpdate = editEntryId || existingEntryId;
        const { error: deleteError } = await supabase
          .from('castle_rush_entry')
          .delete()
          .eq('castle_rush_id', entryToUpdate);

        if (deleteError) throw deleteError;

        // Get the castle rush to get its logger_id
        const { data: castleRush } = await supabase
          .from('castle_rush')
          .select('logger_id')
          .eq('id', entryToUpdate)
          .single();

        // Insert updated entries
        const entryRecords = entriesData.map((entry: any) => ({
          member_id: entry.member_id,
          castle_rush_id: entryToUpdate,
          attendance: entry.attendance,
          score: entry.score,
          logger_id: castleRush?.logger_id,
        }));

        const { error: insertError } = await supabase
          .from('castle_rush_entry')
          .insert(entryRecords);

        if (insertError) throw insertError;

        alert("Castle rush entries updated successfully!");
      } else {
        // Submit to API for new entry
        const response = await fetch('/api/castle-rush', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            castle: castleInfo.castle,
            date: selectedDate,
            entries: entriesData,
            loggedBy: 'system', // You can change this to the actual user name
          }),
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || 'Failed to submit castle rush');
        }

        await response.json();
        
        alert("Castle rush entries saved successfully!");
      }
      
      // Reset form
      setEntries({});
      setSelectedDate("");
      setCastleInfo(null);
      setSearchQuery("");
      setExistingEntryId(null);
      onClose();
    } catch (error) {
      alert(`Failed to save castle rush entries: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setSubmitting(false);
    }
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
        onKeyDown={handleFormKeyDown}
        className="relative z-10 w-full max-w-4xl p-6 rounded-lg max-h-[90vh] overflow-hidden flex flex-col"
        style={{
          background: "var(--color-surface)",
          border: "1px solid var(--color-border)",
          color: "var(--color-foreground)",
        }}
      >
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-medium">
            {editEntryId || existingEntryId ? "Edit Castle Rush Entry" : "Add Castle Rush Entries"}
          </h3>
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
              className="w-full px-3 py-2 rounded border date-input"
              required
              disabled={!!editEntryId || !!existingEntryId}
              style={{
                background: "rgba(128, 128, 128, 0.1)",
                borderColor: "var(--color-border)",
                color: "var(--color-foreground)",
                opacity: (editEntryId || existingEntryId) ? 0.6 : 1,
                colorScheme: "dark",
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
              </div>
            </div>
          )}

          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="block text-sm">Members & Scores</label>
              <div className="flex items-center gap-2 pr-4">
                <label className="flex items-center gap-2 text-xs pr-4" style={{ color: "var(--color-muted)" }}>
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
            
            {/* Search Bar */}
            <div className="mb-3">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={handleSearchKeyDown}
                placeholder="Quick entry: type member name, add space + score, press Enter"
                className="w-full px-3 py-2 rounded border text-sm"
                style={{
                  background: "rgba(128, 128, 128, 0.1)",
                  borderColor: displayedMembers.length === 1 && searchQuery.match(/\s+\d+$/) ? "#22C55E" : "var(--color-border)",
                  color: displayedMembers.length === 1 && searchQuery.match(/\s+\d+$/) ? "#22C55E" : "var(--color-foreground)",
                }}
              />
              {displayedMembers.length === 1 && searchQuery && (
                searchQuery.match(/\s+\d+$/) ? (
                  <div className="text-xs mt-1 px-1" style={{ color: "#22C55E", fontWeight: "600" }}>
                    ✓ Ready! Press Enter to set score {parseInt(searchQuery.match(/\s+(\d+)$/)?.[1] || '0').toLocaleString()} for {displayedMembers[0].name}
                  </div>
                ) : searchQuery.includes(' ') ? (
                  <div className="text-xs mt-1 px-1" style={{ color: "#FBBF24", fontWeight: "500" }}>
                    Preparing for {displayedMembers[0].name}... (add score)
                  </div>
                ) : (
                  <div className="text-xs mt-1 px-1" style={{ color: "#A78BFA", fontWeight: "500" }}>
                    Preparing for {displayedMembers[0].name}... (add space + score)
                  </div>
                )
              )}
              {displayedMembers.length === 0 && searchQuery && !searchQuery.match(/\s+\d+$/) && (
                <div className="text-xs mt-1 px-1" style={{ color: "var(--color-muted)" }}>
                  No members found matching "{searchQuery.replace(/\s+\d+$/, '')}"
                </div>
              )}
            </div>

            {loading ? (
              <div className="text-sm" style={{ color: "var(--color-muted)" }}>
                Loading members...
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-4">
                {/* Left Side - Search Area (always visible) */}
                <div className="space-y-3">
                  <div className="text-sm font-medium" style={{ color: "var(--color-foreground)" }}>
                    Add Scores
                  </div>
                  {displayedMembers.length === 0 ? (
                    <div className="text-sm p-4 rounded border" style={{ 
                      color: "var(--color-muted)",
                      borderColor: "var(--color-border)",
                      backgroundColor: "rgba(128, 128, 128, 0.05)"
                    }}>
                      {searchQuery ? "No members found" : "No members available"}
                    </div>
                  ) : (
                    <div 
                      className="border rounded-lg overflow-auto"
                      style={{ 
                        borderColor: "var(--color-border)",
                        maxHeight: "400px"
                      }}
                    >
                      <table className="w-full">
                        <thead className="sticky top-0">
                          <tr 
                            className="border-b"
                            style={{ 
                              borderColor: "var(--color-border)",
                              backgroundColor: "var(--color-surface)"
                            }}
                          >
                            <th className="text-left px-3 py-2 text-xs font-medium">Name</th>
                            <th className="text-right px-3 py-2 text-xs font-medium" style={{ width: "100px" }}>Score</th>
                          </tr>
                        </thead>
                        <tbody>
                          {displayedMembers.map((member) => {
                            const hasScore = entries[member.id] && parseInt(entries[member.id]) > 0;
                            return (
                              <tr 
                                key={member.id}
                                className="border-b"
                                style={{ 
                                  borderColor: "var(--color-border)",
                                  opacity: member.kicked ? 0.6 : 1,
                                  backgroundColor: hasScore ? "rgba(34, 197, 94, 0.05)" : "transparent"
                                }}
                              >
                                <td className="px-3 py-2 text-sm">
                                  {member.name}
                                  {member.kicked && <span className="ml-1 text-xs" style={{ color: "var(--color-muted)" }}>(kicked)</span>}
                                </td>
                                <td className="px-3 py-2" style={{ width: "100px" }}>
                                  <input
                                    type="number"
                                    value={entries[member.id] || ""}
                                    onChange={(e) => handleScoreChange(member.id, e.target.value)}
                                    onWheel={(e) => e.currentTarget.blur()}
                                    className="w-full px-2 py-1 rounded border text-right text-sm"
                                    placeholder="0"
                                    min="0"
                                    style={{
                                      background: "rgba(128, 128, 128, 0.1)",
                                      borderColor: "var(--color-border)",
                                      color: "var(--color-foreground)",
                                    }}
                                  />  
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>

                {/* Right Side - Members with Scores (sorted by score) */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="text-sm font-medium" style={{ color: "var(--color-foreground)" }}>
                      Entered ({membersWithScores.length})
                    </div>
                    {totalScore > 0 && (
                      <div className="text-sm font-mono font-semibold" style={{ color: "var(--color-primary)" }}>
                        Total: {totalScore.toLocaleString()}
                      </div>
                    )}
                  </div>
                  {membersWithScores.length === 0 ? (
                    <div className="text-sm p-4 rounded border" style={{ 
                      color: "var(--color-muted)",
                      borderColor: "var(--color-border)",
                      backgroundColor: "rgba(128, 128, 128, 0.05)"
                    }}>
                      No scores entered yet. Use the search above to add member scores.
                    </div>
                  ) : (
                    <div 
                      className="border rounded-lg overflow-auto"
                      style={{ 
                        borderColor: "var(--color-border)",
                        maxHeight: "400px"
                      }}
                    >
                      <table className="w-full">
                        <thead className="sticky top-0">
                          <tr 
                            className="border-b"
                            style={{ 
                              borderColor: "var(--color-border)",
                              backgroundColor: "var(--color-surface)"
                            }}
                          >
                            <th className="text-left px-3 py-2 text-xs font-medium">#</th>
                            <th className="text-left px-3 py-2 text-xs font-medium">Name</th>
                            <th className="text-right px-3 py-2 text-xs font-medium">Score</th>
                          </tr>
                        </thead>
                        <tbody>
                          {membersWithScores.map((item, index) => (
                            <tr 
                              key={item.member.id}
                              className="border-b"
                              style={{ 
                                borderColor: "var(--color-border)",
                              }}
                            >
                              <td className="px-3 py-2 text-sm" style={{ color: "var(--color-muted)", width: "40px" }}>
                                {index + 1}
                              </td>
                              <td className="px-3 py-2 text-sm">
                                {item.member.name}
                              </td>
                              <td className="px-3 py-2 text-sm text-right font-mono">
                                {item.score.toLocaleString()}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
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
            disabled={submitting}
            style={{
              backgroundColor: "var(--color-primary)",
              color: "white",
              opacity: submitting ? 0.6 : 1,
            }}
          >
            {submitting ? "Saving..." : ((editEntryId || existingEntryId) ? "Update" : "Save")}
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
