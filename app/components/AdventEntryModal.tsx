import { FaTimes, FaPlus } from "react-icons/fa";
import { useState, useEffect, useCallback } from "react";
import AddMemberForm from "./AddMemberForm";
import { supabase } from "../../lib/supabaseClient";

interface Member {
  id: string;
  name: string;
  role?: string;
  kicked?: boolean;
}

interface AdventEntryModalProps {
  isOpen: boolean;
  onClose: () => void;
  editEntryId?: string | null;
}

const BOSSES = ["Teo", "Kyle", "Yeonhee", "Karma"];

export default function AdventEntryModal({ isOpen, onClose, editEntryId }: AdventEntryModalProps) {
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState("");
  const [entries, setEntries] = useState<Record<string, Record<string, string>>>({});
  const [showAllMembers, setShowAllMembers] = useState(false);
  const [isAddMemberOpen, setIsAddMemberOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [existingEntryId, setExistingEntryId] = useState<string | null>(null);
  const [activeBoss, setActiveBoss] = useState<string>(BOSSES[0]);
  const [excludedEntries, setExcludedEntries] = useState<Set<string>>(new Set()); // Format: "memberId:boss"

  const loadExistingEntry = useCallback(async (entryId: string) => {
    setLoading(true);
    setExistingEntryId(entryId);
    try {
      // Fetch the advent expedition entry
      const { data: adventExpedition, error: aeError } = await supabase
        .from('advent_expedition')
        .select('*')
        .eq('id', entryId)
        .single();

      if (aeError) throw aeError;

      // Set the date
      setSelectedDate(adventExpedition.date);

      // Fetch all members
      const res = await fetch("/api/members");
      if (!res.ok) throw new Error("Failed to fetch members");
      const json = await res.json();
      const memberData = Array.isArray(json) ? json : json.members ?? [];

      // Fetch existing entry data
      const { data: existingEntries, error: entriesError } = await supabase
        .from('advent_expedition_entry')
        .select('member_id, boss, total_score, attendance')
        .eq('advent_expedition_id', entryId);

      if (entriesError) throw entriesError;

      // Map existing scores to entries state (member_id -> boss -> score)
      const entriesMap: Record<string, Record<string, string>> = {};
      existingEntries?.forEach((entry: any) => {
        if (!entriesMap[entry.member_id]) {
          entriesMap[entry.member_id] = {};
        }
        if (entry.total_score > 0) {
          entriesMap[entry.member_id][entry.boss] = entry.total_score.toString();
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
        setSearchQuery("");
        setActiveBoss(BOSSES[0]);
        setExcludedEntries(new Set());
        loadMembers();
      }
    }
  }, [isOpen, editEntryId, loadExistingEntry]);

  useEffect(() => {
    if (selectedDate && !editEntryId && !existingEntryId) {
      checkExistingEntry(selectedDate);
    }
  }, [selectedDate, editEntryId, existingEntryId]);

  const checkExistingEntry = async (date: string) => {
    try {
      const { data: existingEntry, error } = await supabase
        .from('advent_expedition')
        .select('id')
        .eq('date', date)
        .single();

      if (!error && existingEntry) {
        const shouldUpdate = confirm(
          `An entry already exists for ${new Date(date + 'T00:00:00').toLocaleDateString()}. Would you like to update it instead?`
        );
        
        if (shouldUpdate) {
          loadExistingEntry(existingEntry.id);
        } else {
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
      
      // Sort members by role and name
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
      // Error loading members
    } finally {
      setLoading(false);
    }
  }

  const handleScoreChange = (memberId: string, boss: string, score: string) => {
    setEntries(prev => ({
      ...prev,
      [memberId]: {
        ...(prev[memberId] || {}),
        [boss]: score
      }
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
          handleScoreChange(member.id, activeBoss, score);
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!selectedDate) {
      alert("Please select a date");
      return;
    }

    setSubmitting(true);

    try {
      // Build entries array for all members and all bosses, excluding excluded entries
      const allEntries = members.flatMap(member => {
        return BOSSES.map(boss => {
          const entryKey = `${member.id}:${boss}`;
          const isExcluded = excludedEntries.has(entryKey);
          
          // Skip this entry if excluded
          if (isExcluded) {
            return null;
          }
          
          const score = entries[member.id]?.[boss] || "";
          const totalScore = score ? parseInt(score, 10) : 0;
          const attendance = totalScore > 0;

          return {
            member_id: member.id,
            date: selectedDate,
            boss,
            attendance,
            total_score: totalScore,
          };
        }).filter(entry => entry !== null); // Remove null entries
      }).flat();

      let response;
      if (existingEntryId) {
        // Update existing entry
        response = await fetch("/api/advent", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            adventId: existingEntryId,
            entries: allEntries,
            loggedBy: "web",
          }),
        });
      } else {
        // Create new entry
        response = await fetch("/api/advent", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            date: selectedDate,
            entries: allEntries,
            loggedBy: "web",
          }),
        });
      }

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to submit");
      }

      alert(existingEntryId ? "Advent Expedition updated!" : "Advent Expedition entry added!");
      onClose();
    } catch (err: any) {
      alert(`Error: ${err.message}`);
    } finally {
      setSubmitting(false);
    }
  };

  const handleMemberAdded = (newMember: Member) => {
    setMembers(prev => [newMember, ...prev]);
    setIsAddMemberOpen(false);
  };

  const toggleExcludeEntry = (memberId: string, boss: string) => {
    const entryKey = `${memberId}:${boss}`;
    setExcludedEntries(prev => {
      const newSet = new Set(prev);
      if (newSet.has(entryKey)) {
        newSet.delete(entryKey);
      } else {
        newSet.add(entryKey);
      }
      return newSet;
    });
  };

  const filteredMembers = members.filter(m => {
    if (m.kicked) return false;
    if (searchQuery.trim() === "") return true;
    // Remove trailing numbers from search query for filtering
    const queryWithoutNumbers = searchQuery.replace(/\s+\d+$/, '').toLowerCase().trim();
    return m.name.toLowerCase().includes(queryWithoutNumbers);
  });

  const displayedMembers = showAllMembers ? filteredMembers : filteredMembers.slice(0, 15);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 flex items-center justify-center z-50"
      style={{ backgroundColor: "rgba(0, 0, 0, 0.7)" }}
    >
      <div
        className="rounded-lg p-6 w-full max-w-4xl max-h-[90vh] overflow-y-auto"
        style={{
          backgroundColor: "var(--color-surface)",
          border: "1px solid var(--color-border)",
        }}
      >
        {/* Header */}
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-bold" style={{ color: "var(--color-foreground)" }}>
            {existingEntryId ? "Edit Advent Expedition Entry" : "Add Advent Expedition Entry"}
          </h2>
          <button
            onClick={onClose}
            className="p-2 rounded hover:opacity-80"
            style={{ backgroundColor: "var(--color-muted)" }}
          >
            <FaTimes />
          </button>
        </div>

        <form onSubmit={handleSubmit} onKeyDown={handleFormKeyDown}>
          {/* Date Selection */}
          <div className="mb-6">
            <label className="block mb-2 font-medium" style={{ color: "var(--color-foreground)" }}>
              Expedition Start Date (2-week period)
            </label>
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="w-full px-3 py-2 rounded"
              style={{
                backgroundColor: "var(--color-background)",
                border: "1px solid var(--color-border)",
                color: "var(--color-foreground)",
              }}
              required
            />
          </div>

          {/* Boss Tabs */}
          <div className="mb-4 flex gap-2 border-b" style={{ borderColor: "var(--color-border)" }}>
            {BOSSES.map(boss => (
              <button
                key={boss}
                type="button"
                onClick={() => setActiveBoss(boss)}
                className="px-4 py-2 font-medium transition-colors"
                style={{
                  color: activeBoss === boss ? "var(--color-primary)" : "var(--color-muted)",
                  borderBottom: activeBoss === boss ? "2px solid var(--color-primary)" : "2px solid transparent",
                }}
              >
                {boss}
              </button>
            ))}
          </div>

          {/* Search and Add Member */}
          <div className="mb-4">
            <div className="flex gap-2 mb-2">
              <input
                type="text"
                placeholder="Quick entry: type member name, add space + score, press Enter"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={handleSearchKeyDown}
                className="flex-1 px-3 py-2 rounded border text-sm"
                style={{
                  backgroundColor: "rgba(128, 128, 128, 0.1)",
                  borderColor: displayedMembers.length === 1 && searchQuery.match(/\s+\d+$/) ? "#22C55E" : "var(--color-border)",
                  color: displayedMembers.length === 1 && searchQuery.match(/\s+\d+$/) ? "#22C55E" : "var(--color-foreground)",
                }}
              />
              <button
                type="button"
                onClick={() => setIsAddMemberOpen(true)}
                className="flex items-center gap-2 px-4 py-2 rounded hover:opacity-90"
                style={{
                  backgroundColor: "var(--color-primary)",
                  color: "white",
                }}
              >
                <FaPlus /> Add Member
              </button>
            </div>
            
            {/* Feedback Messages */}
            {displayedMembers.length === 1 && searchQuery && (
              searchQuery.match(/\s+\d+$/) ? (
                <div className="text-xs px-1" style={{ color: "#22C55E", fontWeight: "600" }}>
                  ✓ Ready! Press Enter to set score {parseInt(searchQuery.match(/\s+(\d+)$/)?.[1] || '0').toLocaleString()} for {displayedMembers[0].name} ({activeBoss})
                </div>
              ) : searchQuery.includes(' ') ? (
                <div className="text-xs px-1" style={{ color: "#FBBF24", fontWeight: "500" }}>
                  Preparing for {displayedMembers[0].name}... (add score)
                </div>
              ) : (
                <div className="text-xs px-1" style={{ color: "#A78BFA", fontWeight: "500" }}>
                  Preparing for {displayedMembers[0].name}... (add space + score)
                </div>
              )
            )}
            {displayedMembers.length === 0 && searchQuery && !searchQuery.match(/\s+\d+$/) && (
              <div className="text-xs px-1" style={{ color: "var(--color-muted)" }}>
                No members found matching "{searchQuery.replace(/\s+\d+$/, '')}"
              </div>
            )}
          </div>

          {/* Member Score Entry Table */}
          {loading ? (
            <div style={{ color: "var(--color-muted)" }}>Loading members...</div>
          ) : (
            <>
              <div className="mb-4">
                <div className="grid grid-cols-[2fr,1fr,auto] gap-2 mb-2 font-semibold" style={{ color: "var(--color-foreground)" }}>
                  <div>Member Name</div>
                  <div>Score ({activeBoss})</div>
                  <div>Exclude</div>
                </div>
                {displayedMembers.map(member => {
                  const score = entries[member.id]?.[activeBoss] || "";
                  const entryKey = `${member.id}:${activeBoss}`;
                  const isExcluded = excludedEntries.has(entryKey);
                  return (
                    <div key={member.id} className="grid grid-cols-[2fr,1fr,auto] gap-2 mb-2 items-center">
                      <div style={{ 
                        color: "var(--color-foreground)",
                        opacity: isExcluded ? 0.4 : 1,
                        textDecoration: isExcluded ? "line-through" : "none"
                      }}>
                        {member.name}
                        {member.role && member.role.toLowerCase() !== "member" && (
                          <span className="ml-2 text-sm" style={{ color: "var(--color-muted)" }}>
                            ({member.role})
                          </span>
                        )}
                      </div>
                      <input
                        type="number"
                        value={score}
                        onChange={(e) => handleScoreChange(member.id, activeBoss, e.target.value)}
                        placeholder="0"
                        disabled={isExcluded}
                        className="px-3 py-2 rounded"
                        style={{
                          backgroundColor: "var(--color-background)",
                          border: "1px solid var(--color-border)",
                          color: "var(--color-foreground)",
                          opacity: isExcluded ? 0.4 : 1,
                        }}
                      />
                      <button
                        type="button"
                        onClick={() => toggleExcludeEntry(member.id, activeBoss)}
                        className="px-3 py-1 rounded text-xs transition-colors hover:opacity-80"
                        style={{
                          backgroundColor: isExcluded ? "#22C55E" : "#EF4444",
                          color: "white",
                        }}
                      >
                        {isExcluded ? "Include" : "Exclude"}
                      </button>
                    </div>
                  );
                })}
              </div>

              {filteredMembers.length > 15 && (
                <button
                  type="button"
                  onClick={() => setShowAllMembers(!showAllMembers)}
                  className="mb-4 px-4 py-2 rounded hover:opacity-80"
                  style={{
                    backgroundColor: "var(--color-muted)",
                    color: "var(--color-foreground)",
                  }}
                >
                  {showAllMembers ? "Show Less" : `Show All (${filteredMembers.length} members)`}
                </button>
              )}
            </>
          )}

          {/* Submit Button */}
          <div className="flex justify-end gap-2 mt-6">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded hover:opacity-80"
              style={{
                backgroundColor: "var(--color-muted)",
                color: "var(--color-foreground)",
              }}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-4 py-2 rounded hover:opacity-90"
              style={{
                backgroundColor: "var(--color-primary)",
                color: "white",
                opacity: submitting ? 0.5 : 1,
              }}
            >
              {submitting ? "Submitting..." : existingEntryId ? "Update Entry" : "Add Entry"}
            </button>
          </div>
        </form>
      </div>

      {/* Add Member Modal */}
      {isAddMemberOpen && (
        <AddMemberForm
          isOpen={isAddMemberOpen}
          onClose={() => setIsAddMemberOpen(false)}
          onMemberAdded={handleMemberAdded}
        />
      )}
    </div>
  );
}
