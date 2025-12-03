import { FaTimes, FaPlus } from "react-icons/fa";
import { useState, useEffect, useMemo } from "react";
import { supabase } from "../../lib/supabaseClient";
import MemberSearchBar from "./MemberSearchBar";

interface Member {
  id: string;
  name: string;
  role?: string;
  kicked?: boolean;
}

interface HistoricalCastleRushModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface CastleInfo {
  day: string;
  boss: string;
  castle: string;
}

const CASTLE_SCHEDULE: Record<number, CastleInfo> = {
  1: { day: "Monday", boss: "Rudy", castle: "Guardian's Castle" },
  2: { day: "Tuesday", boss: "Eileene", castle: "Fodina Castle" },
  3: { day: "Wednesday", boss: "Rachel", castle: "Immortal Castle" },
  4: { day: "Thursday", boss: "Dellons", castle: "Death Castle" },
  5: { day: "Friday", boss: "Jave", castle: "Ancient Dragon's Castle" },
  6: { day: "Saturday", boss: "Spike", castle: "Blizzard Castle" },
  0: { day: "Sunday", boss: "Kris", castle: "Hell Castle" }
};

interface ParticipantEntry {
  memberName: string;
  score: number;
  isExistingMember: boolean;
  memberId?: string;
}

export default function HistoricalCastleRushModal({ isOpen, onClose }: HistoricalCastleRushModalProps) {
  const [allMembers, setAllMembers] = useState<Member[]>([]);
  const [selectedDate, setSelectedDate] = useState("");
  const [castleInfo, setCastleInfo] = useState<CastleInfo | null>(null);
  const [participants, setParticipants] = useState<ParticipantEntry[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [entries, setEntries] = useState<Record<string, string>>({});
  const [showNotification, setShowNotification] = useState(false);

  useEffect(() => {
    if (isOpen) {
      loadMembers();
      setSelectedDate("");
      setParticipants([]);
      setSearchQuery("");
      setEntries({});
      setCastleInfo(null);
    }
  }, [isOpen]);

  useEffect(() => {
    if (selectedDate) {
      const date = new Date(selectedDate + 'T00:00:00');
      const dayOfWeek = date.getDay();
      setCastleInfo(CASTLE_SCHEDULE[dayOfWeek]);
      checkExistingEntry(selectedDate);
    } else {
      setCastleInfo(null);
    }
  }, [selectedDate]);

  async function loadMembers() {
    try {
      const { data, error } = await supabase
        .from('members')
        .select('*')
        .order('name');

      if (error) throw error;
      setAllMembers(data || []);
    } catch (err) {
    } finally {
      setLoading(false);
    }
  }

  async function checkExistingEntry(date: string) {
    try {
      const { data: existingEntry, error } = await supabase
        .from('castle_rush')
        .select('id')
        .eq('date', date)
        .single();

      if (!error && existingEntry) {
        alert(`An entry already exists for ${new Date(date + 'T00:00:00').toLocaleDateString()}. Please delete it first or choose a different date.`);
        setSelectedDate("");
      }
    } catch (err) {
      // No existing entry, this is fine
    }
  }

  const handleScoreChange = (memberId: string, score: string) => {
    setEntries(prev => ({
      ...prev,
      [memberId]: score
    }));
  };

  const handleDeleteEntry = (memberId: string) => {
    setParticipants(prev => prev.filter(p => p.memberId !== memberId));
    setEntries(prev => {
      const newEntries = { ...prev };
      delete newEntries[memberId];
      return newEntries;
    });
  };

  const handleAddMemberToEntry = (memberId: string) => {
    const memberToAdd = allMembers.find(m => m.id === memberId);
    if (memberToAdd && !participants.find(p => p.memberId === memberId)) {
      const newParticipant: ParticipantEntry = {
        memberName: memberToAdd.name,
        score: 0,
        isExistingMember: true, // Member exists in database (kicked or not)
        memberId: memberToAdd.id,
      };
      setParticipants(prev => [...prev, newParticipant]);
    }
  };

  // Displayed entries sorted by score
  const displayedEntries = participants.sort((a, b) => {
    const scoreA = parseInt(entries[a.memberId || ''] || '0');
    const scoreB = parseInt(entries[b.memberId || ''] || '0');
    if (scoreA !== scoreB) return scoreB - scoreA;
    return a.memberName.localeCompare(b.memberName);
  });

  // Convert participants to Member format for MemberSearchBar
  const enteredMembers = useMemo(() => {
    return participants.map(p => ({
      id: p.memberId || '',
      name: p.memberName,
      role: '',
      kicked: false
    }));
  }, [participants]);

  // Calculate total score
  const totalScore = Object.values(entries)
    .filter(score => score && score.trim() !== '')
    .reduce((sum, score) => sum + (parseInt(score) || 0), 0);

  const membersWithScores = participants.filter(p => {
    const score = parseInt(entries[p.memberId || ''] || '0');
    return score > 0;
  });

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

    if (participants.length === 0) {
      alert("Please add at least one participant");
      return;
    }

    setSubmitting(true);

    try {
      // Create logger entry
      const { data: logger, error: loggerError } = await supabase
        .from('logger')
        .insert({ logged_by: 'system' })
        .select()
        .single();

      if (loggerError) throw loggerError;

      // Create castle rush entry
      const { data: castleRush, error: castleRushError } = await supabase
        .from('castle_rush')
        .insert({
          castle: castleInfo.castle,
          date: selectedDate,
          logger_id: logger.id,
        })
        .select()
        .single();

      if (castleRushError) throw castleRushError;

      // For participants that aren't existing members, create temporary member records
      const newMembersToCreate = participants.filter(p => !p.isExistingMember);
      const newMemberIds: Record<string, string> = {};

      if (newMembersToCreate.length > 0) {
        const { data: newMembers, error: newMembersError } = await supabase
          .from('members')
          .insert(
            newMembersToCreate.map(p => ({
              name: p.memberName,
              role: "Historical",
              kicked: true, // Mark as kicked since they're not current members
              logger_id: logger.id,
            }))
          )
          .select();

        if (newMembersError) throw newMembersError;

        // Map names to new IDs
        newMembers?.forEach((member, index) => {
          newMemberIds[newMembersToCreate[index].memberName] = member.id;
        });
      }

      // Create entries for all participants (with scores from entries object)
      const participantEntries = participants.map(p => ({
        member_id: p.memberId || newMemberIds[p.memberName],
        castle_rush_id: castleRush.id,
        attendance: true,
        score: parseInt(entries[p.memberId || ''] || '0'),
        logger_id: logger.id,
      }));

      const allEntries = [...participantEntries];

      const { error: entriesError } = await supabase
        .from('castle_rush_entry')
        .insert(allEntries);

      if (entriesError) throw entriesError;

      const currentMemberCount = participants.filter(p => p.isExistingMember).length;
      const historicalMemberCount = newMembersToCreate.length;
      
      alert(`Historical entry created successfully! Added ${participants.length} participants (${currentMemberCount} current, ${historicalMemberCount} historical).`);
      
      setParticipants([]);
      setSelectedDate("");
      setCastleInfo(null);
      onClose();
    } catch (error) {
      alert(`Failed to create entry: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setSubmitting(false);
    }
  };

  if (!isOpen) return null;

  const hasData = participants.length > 0 || Object.keys(entries).length > 0;

  const handleBackdropClick = () => {
    if (hasData) {
      setShowNotification(true);
      setTimeout(() => setShowNotification(false), 3000);
    } else {
      onClose();
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
        onClick={handleBackdropClick}
        style={{ background: "rgba(0,0,0,0.4)" }}
      />
      {showNotification && (
        <div
          className="fixed bottom-4 left-4 px-4 py-2 rounded-lg text-sm z-[60]"
          style={{
            backgroundColor: "var(--color-surface)",
            border: "1px solid var(--color-border)",
            color: "var(--color-foreground)",
            boxShadow: "0 4px 6px rgba(0, 0, 0, 0.3)",
            animation: "fadeIn 0.3s ease-in-out"
          }}
        >
          Please save or cancel to close this form
        </div>
      )}
      <form
        onSubmit={handleSubmit}
        className="relative z-10 w-full max-w-4xl p-6 rounded-lg max-h-[90vh] flex flex-col"
        style={{
          background: "var(--color-surface)",
          border: "1px solid var(--color-border)",
          color: "var(--color-foreground)",
          overflow: "visible",
        }}
      >
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-lg font-medium">Import Historical Castle Rush Entry</h3>
            <p className="text-xs mt-1" style={{ color: "var(--color-muted)" }}>
              For past events with different member rosters
            </p>
          </div>
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

        <div className="flex-1 space-y-4" style={{ overflow: "visible" }}>
          <div style={{ maxHeight: "calc(90vh - 200px)", overflowY: "auto", paddingRight: "4px" }}>
          {/* Date Selection */}
          <div>
            <label htmlFor="historical-date" className="block text-sm mb-1">Event Date</label>
            <input
              id="historical-date"
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="w-full px-3 py-2 rounded border"
              required
              style={{
                background: "rgba(128, 128, 128, 0.1)",
                borderColor: "var(--color-border)",
                color: "var(--color-foreground)",
                colorScheme: "dark",
              }}
            />
          </div>

          {/* Castle Info */}
          {castleInfo && (
            <div 
              className="p-4 rounded-lg"
              style={{
                backgroundColor: "rgba(128, 128, 128, 0.05)",
                border: "1px solid var(--color-border)",
              }}
            >
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
          )}

          {/* New Search-based Entry System */}
          <div>
            <label className="block text-sm mb-2">Members & Scores</label>
            <MemberSearchBar
              searchQuery={searchQuery}
              onSearchChange={setSearchQuery}
              allMembers={allMembers}
              enteredMembers={enteredMembers}
              isEditMode={false}
              onAddMember={handleAddMemberToEntry}
              onScoreChange={handleScoreChange}
            />

            {participants.length === 0 ? (
              <div className="text-sm p-6 rounded border text-center" style={{ 
                color: "var(--color-muted)",
                borderColor: "var(--color-border)",
                backgroundColor: "rgba(128, 128, 128, 0.05)"
              }}>
                <div className="mb-2">No members entered yet</div>
                <div className="text-xs">Use the search bar above to quickly add members with scores</div>
              </div>
            ) : (
              <div>
                <div className="flex items-center justify-between mb-2">
                  <div className="text-sm font-medium">
                    Entered Members ({participants.length})
                  </div>
                  {totalScore > 0 && (
                    <div className="text-sm font-mono font-semibold" style={{ color: "var(--color-primary)" }}>
                      Total: {totalScore.toLocaleString()} ({membersWithScores.length} scored)
                    </div>
                  )}
                </div>
                <div 
                  className="border rounded-lg overflow-auto"
                  style={{ 
                    borderColor: "var(--color-border)",
                    maxHeight: "350px"
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
                        <th className="text-right px-3 py-2 text-xs font-medium" style={{ width: "120px" }}>Score</th>
                        <th className="text-center px-3 py-2 text-xs font-medium" style={{ width: "70px" }}>Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {displayedEntries.map((participant) => {
                        const hasScore = entries[participant.memberId || ''] && parseInt(entries[participant.memberId || '']) > 0;
                        const member = allMembers.find(m => m.id === participant.memberId);
                        
                        return (
                          <tr 
                            key={participant.memberId}
                            className="border-b"
                            style={{ 
                              borderColor: "var(--color-border)",
                              opacity: member?.kicked ? 0.6 : 1,
                              backgroundColor: hasScore ? "rgba(34, 197, 94, 0.05)" : "transparent"
                            }}
                          >
                            <td className="px-3 py-2 text-sm">
                              {participant.memberName}
                              {member?.kicked && <span className="ml-1 text-xs" style={{ color: "var(--color-muted)" }}>(kicked)</span>}
                            </td>
                            <td className="px-3 py-2" style={{ width: "120px" }}>
                              <input
                                type="number"
                                value={entries[participant.memberId || ''] || ""}
                                onChange={(e) => handleScoreChange(participant.memberId || '', e.target.value)}
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
                            <td className="px-3 py-2 text-center" style={{ width: "70px" }}>
                              <button
                                type="button"
                                onClick={() => handleDeleteEntry(participant.memberId || '')}
                                className="px-2 py-1 rounded text-xs"
                                style={{
                                  backgroundColor: "#ef4444",
                                  color: "white",
                                }}
                              >
                                Del
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between mt-4 pt-4 border-t" style={{ borderColor: "var(--color-border)" }}>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-lg"
            style={{
              backgroundColor: "rgba(128, 128, 128, 0.1)",
              border: "1px solid var(--color-border)",
              color: "var(--color-foreground)",
            }}
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={!selectedDate || participants.length === 0 || submitting}
            className="px-6 py-2 rounded-lg transition-colors hover:opacity-90"
            style={{
              backgroundColor: (!selectedDate || participants.length === 0 || submitting) 
                ? "rgba(128, 128, 128, 0.3)" 
                : "var(--color-primary)",
              color: "white",
              opacity: (!selectedDate || participants.length === 0 || submitting) ? 0.5 : 1,
              cursor: (!selectedDate || participants.length === 0 || submitting) ? "not-allowed" : "pointer",
            }}
          >
            {submitting ? "Creating..." : `Import ${participants.length} Participant${participants.length !== 1 ? 's' : ''}`}
          </button>
        </div>
      </form>
    </div>
  );
}
