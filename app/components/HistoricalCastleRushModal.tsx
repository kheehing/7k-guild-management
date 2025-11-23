import { FaTimes, FaPlus } from "react-icons/fa";
import { useState, useEffect } from "react";
import { supabase } from "../../lib/supabaseClient";

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
  const [currentName, setCurrentName] = useState("");
  const [currentScore, setCurrentScore] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [loading, setLoading] = useState(true);
  const [showSuggestions, setShowSuggestions] = useState(false);

  // Filter members based on current name input
  const filteredMembers = allMembers.filter(m => 
    currentName.trim() && 
    m.name.toLowerCase().includes(currentName.trim().toLowerCase()) &&
    !participants.some(p => p.memberId === m.id) // Exclude already added members
  ).slice(0, 5); // Limit to 5 suggestions

  useEffect(() => {
    if (isOpen) {
      loadMembers();
      setSelectedDate("");
      setParticipants([]);
      setCurrentName("");
      setCurrentScore("");
      setCastleInfo(null);
      setShowSuggestions(false);
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
      console.error("Error loading members:", err);
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

  const handleAddParticipant = () => {
    if (!currentName.trim()) {
      alert("Please enter a member name");
      return;
    }

    const score = parseInt(currentScore) || 0;
    if (score <= 0) {
      alert("Please enter a valid score greater than 0");
      return;
    }

    // Check if this name matches an existing member
    const existingMember = allMembers.find(m => 
      m.name.toLowerCase() === currentName.trim().toLowerCase()
    );

    const newParticipant: ParticipantEntry = {
      memberName: currentName.trim(),
      score,
      isExistingMember: !!existingMember,
      memberId: existingMember?.id,
    };

    setParticipants(prev => [...prev, newParticipant]);
    setCurrentName("");
    setCurrentScore("");
    setShowSuggestions(false);
  };

  const handleSelectMember = (member: Member) => {
    setCurrentName(member.name);
    setShowSuggestions(false);
    // Focus on score input after selection
    setTimeout(() => {
      document.getElementById('participant-score')?.focus();
    }, 0);
  };

  const handleRemoveParticipant = (index: number) => {
    setParticipants(prev => prev.filter((_, i) => i !== index));
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleAddParticipant();
    }
  };

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

      // Create entries for all participants (with scores)
      const participantEntries = participants.map(p => ({
        member_id: p.memberId || newMemberIds[p.memberName],
        castle_rush_id: castleRush.id,
        attendance: true,
        score: p.score,
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
      console.error('Error creating historical entry:', error);
      alert(`Failed to create entry: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setSubmitting(false);
    }
  };

  if (!isOpen) return null;

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

          {/* Add Participant Form */}
          <div 
            className="p-4 rounded-lg"
            style={{
              backgroundColor: "rgba(128, 128, 128, 0.05)",
              border: "1px solid var(--color-border)",
            }}
          >
            <h4 className="text-sm font-medium mb-3">Add Participant</h4>
            <div className="grid grid-cols-2 gap-3">
              <div className="relative">
                <label htmlFor="participant-name" className="block text-xs mb-1">Member Name</label>
                <input
                  id="participant-name"
                  type="text"
                  value={currentName}
                  onChange={(e) => {
                    setCurrentName(e.target.value);
                    setShowSuggestions(true);
                  }}
                  onKeyDown={handleKeyDown}
                  onFocus={() => setShowSuggestions(true)}
                  onBlur={() => {
                    // Delay to allow click on suggestion
                    setTimeout(() => setShowSuggestions(false), 200);
                  }}
                  placeholder="Type member name..."
                  className="w-full px-3 py-2 rounded border text-sm"
                  style={{
                    background: "rgba(128, 128, 128, 0.1)",
                    borderColor: "var(--color-border)",
                    color: "var(--color-foreground)",
                  }}
                />
                {/* Autocomplete Suggestions */}
                {showSuggestions && filteredMembers.length > 0 && (
                  <div 
                    className="fixed z-50 mt-1 rounded border shadow-lg overflow-hidden"
                    style={{
                      backgroundColor: "var(--color-surface)",
                      borderColor: "var(--color-border)",
                      maxHeight: "200px",
                      overflowY: "auto",
                      width: document.getElementById('participant-name')?.offsetWidth || 'auto',
                      top: (document.getElementById('participant-name')?.getBoundingClientRect().bottom || 0) + 4,
                      left: document.getElementById('participant-name')?.getBoundingClientRect().left || 0,
                    }}
                  >
                    {filteredMembers.map(member => (
                      <button
                        key={member.id}
                        type="button"
                        onClick={() => handleSelectMember(member)}
                        className="w-full px-3 py-2 text-left text-sm hover:opacity-80 border-b"
                        style={{
                          backgroundColor: "var(--color-surface)",
                          borderColor: "var(--color-border)",
                          color: "var(--color-foreground)",
                        }}
                      >
                        <div className="flex items-center justify-between">
                          <span>{member.name}</span>
                          <span 
                            className="text-xs px-2 py-0.5 rounded"
                            style={{
                              backgroundColor: member.kicked ? "rgba(239, 68, 68, 0.1)" : "rgba(16, 185, 129, 0.1)",
                              color: member.kicked ? "#ef4444" : "#10b981",
                            }}
                          >
                            {member.kicked ? "Kicked" : "Active"}
                          </span>
                        </div>
                        {member.role && (
                          <div className="text-xs mt-0.5" style={{ color: "var(--color-muted)" }}>
                            {member.role}
                          </div>
                        )}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <div>
                <label htmlFor="participant-score" className="block text-xs mb-1">Score</label>
                <input
                  id="participant-score"
                  type="number"
                  value={currentScore}
                  onChange={(e) => setCurrentScore(e.target.value)}
                  onKeyDown={handleKeyDown}
                  onWheel={(e) => e.currentTarget.blur()}
                  placeholder="Enter score..."
                  className="w-full px-3 py-2 rounded border text-sm"
                  min="0"
                  style={{
                    background: "rgba(128, 128, 128, 0.1)",
                    borderColor: "var(--color-border)",
                    color: "var(--color-foreground)",
                  }}
                />
              </div>
            </div>
            <button
              type="button"
              onClick={handleAddParticipant}
              className="w-full mt-3 px-3 py-2 rounded text-sm flex items-center justify-center gap-2"
              style={{
                backgroundColor: "var(--color-primary)",
                color: "white",
              }}
            >
              <FaPlus size={12} />
              Add Participant
            </button>
          </div>

          {/* Participants List */}
          {participants.length > 0 && (
            <div>
              <h4 className="text-sm font-medium mb-2">
                Participants ({participants.length})
              </h4>
              <div 
                className="border rounded-lg overflow-hidden"
                style={{ borderColor: "var(--color-border)" }}
              >
                <table className="w-full text-sm">
                  <thead>
                    <tr 
                      className="border-b"
                      style={{ 
                        borderColor: "var(--color-border)",
                        backgroundColor: "rgba(128, 128, 128, 0.05)",
                      }}
                    >
                      <th className="text-left px-3 py-2 text-xs">Member</th>
                      <th className="text-center px-3 py-2 text-xs">Status</th>
                      <th className="text-right px-3 py-2 text-xs">Score</th>
                      <th className="text-center px-3 py-2 text-xs" style={{ width: "80px" }}>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {participants.map((p, index) => (
                      <tr 
                        key={index}
                        className="border-b"
                        style={{ borderColor: "var(--color-border)" }}
                      >
                        <td className="px-3 py-2">{p.memberName}</td>
                        <td className="px-3 py-2 text-center">
                          <span 
                            className="text-xs px-2 py-0.5 rounded"
                            style={{
                              backgroundColor: p.isExistingMember ? "rgba(16, 185, 129, 0.1)" : "rgba(245, 158, 11, 0.1)",
                              color: p.isExistingMember ? "#10b981" : "#f59e0b",
                            }}
                          >
                            {p.isExistingMember ? "Current" : "Historical"}
                          </span>
                        </td>
                        <td className="px-3 py-2 text-right font-mono">
                          {p.score.toLocaleString()}
                        </td>
                        <td className="px-3 py-2 text-center">
                          <button
                            type="button"
                            onClick={() => handleRemoveParticipant(index)}
                            className="text-xs px-2 py-1 rounded hover:opacity-80"
                            style={{
                              backgroundColor: "rgba(239, 68, 68, 0.8)",
                              color: "white",
                            }}
                          >
                            Remove
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="text-xs mt-2" style={{ color: "var(--color-muted)" }}>
                Note: Only listed participants will be included in this historical entry.
                Historical members will be added to the database and marked as "kicked".
              </p>
            </div>
          )}
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
