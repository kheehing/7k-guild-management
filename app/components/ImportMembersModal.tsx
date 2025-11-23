import { FaTimes } from "react-icons/fa";
import { useState } from "react";
import { supabase } from "../../lib/supabaseClient";

interface ImportMembersModalProps {
  isOpen: boolean;
  onClose: () => void;
  onMembersImported: () => void;
}

interface MemberImport {
  name: string;
  role: string;
  isInGuild: boolean;
}

export default function ImportMembersModal({ isOpen, onClose, onMembersImported }: ImportMembersModalProps) {
  const [memberName, setMemberName] = useState("");
  const [memberRole, setMemberRole] = useState("Member");
  const [isInGuild, setIsInGuild] = useState(true);
  const [importing, setImporting] = useState(false);
  const [pendingMembers, setPendingMembers] = useState<MemberImport[]>([]);

  if (!isOpen) return null;

  const handleAddToPending = () => {
    if (!memberName.trim()) {
      alert("Please enter a member name");
      return;
    }

    setPendingMembers(prev => [...prev, {
      name: memberName.trim(),
      role: memberRole,
      isInGuild: isInGuild
    }]);

    // Reset form
    setMemberName("");
    setMemberRole("Member");
    setIsInGuild(true);
  };

  const handleRemoveFromPending = (index: number) => {
    setPendingMembers(prev => prev.filter((_, i) => i !== index));
  };

  const handleImportAll = async () => {
    if (pendingMembers.length === 0) {
      alert("No members to import");
      return;
    }

    setImporting(true);
    
    try {
      // Create a logger entry
      const { data: logger, error: loggerError } = await supabase
        .from('logger')
        .insert({ logged_by: 'system' })
        .select()
        .single();

      if (loggerError) throw loggerError;

      // Insert all members
      const membersToInsert = pendingMembers.map(member => ({
        name: member.name,
        role: member.role,
        kicked: !member.isInGuild,
        logger_id: logger.id
      }));

      const { error: membersError } = await supabase
        .from('members')
        .insert(membersToInsert);

      if (membersError) throw membersError;

      alert(`Successfully imported ${pendingMembers.length} member(s)!`);
      setPendingMembers([]);
      onMembersImported();
      onClose();
    } catch (error) {
      console.error('Error importing members:', error);
      alert(`Failed to import members: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setImporting(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleAddToPending();
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
      <div
        className="relative z-10 w-full max-w-2xl p-6 rounded-lg max-h-[90vh] overflow-hidden flex flex-col"
        style={{
          background: "var(--color-surface)",
          border: "1px solid var(--color-border)",
          color: "var(--color-foreground)",
        }}
      >
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-medium">Import Historical Members</h3>
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
          {/* Add Member Form */}
          <div 
            className="p-4 rounded-lg space-y-3"
            style={{
              backgroundColor: "rgba(128, 128, 128, 0.05)",
              border: "1px solid var(--color-border)",
            }}
          >
            <div>
              <label htmlFor="memberName" className="block text-sm mb-1">Member Name</label>
              <input
                id="memberName"
                type="text"
                value={memberName}
                onChange={(e) => setMemberName(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Enter member name"
                className="w-full px-3 py-2 rounded border text-sm"
                style={{
                  background: "rgba(128, 128, 128, 0.1)",
                  borderColor: "var(--color-border)",
                  color: "var(--color-foreground)",
                }}
              />
            </div>

            <div>
              <label htmlFor="memberRole" className="block text-sm mb-1">Role</label>
              <input
                id="memberRole"
                type="text"
                value={memberRole}
                onChange={(e) => setMemberRole(e.target.value)}
                placeholder="e.g., Member, Officer, Leader"
                className="w-full px-3 py-2 rounded border text-sm"
                style={{
                  background: "rgba(128, 128, 128, 0.1)",
                  borderColor: "var(--color-border)",
                  color: "var(--color-foreground)",
                }}
              />
            </div>

            <div className="flex items-center gap-2">
              <input
                id="isInGuild"
                type="checkbox"
                checked={isInGuild}
                onChange={(e) => setIsInGuild(e.target.checked)}
                className="rounded"
              />
              <label htmlFor="isInGuild" className="text-sm">Currently in guild</label>
            </div>

            <button
              type="button"
              onClick={handleAddToPending}
              className="w-full px-4 py-2 rounded-lg transition-colors hover:opacity-90"
              style={{
                backgroundColor: "var(--color-primary)",
                color: "white",
              }}
            >
              Add to List
            </button>
          </div>

          {/* Pending Members List */}
          {pendingMembers.length > 0 && (
            <div>
              <div className="flex items-center justify-between mb-2">
                <h4 className="text-sm font-medium">Members to Import ({pendingMembers.length})</h4>
                <button
                  onClick={() => setPendingMembers([])}
                  className="text-xs px-2 py-1 rounded"
                  style={{ 
                    color: "var(--color-alert)",
                    border: "1px solid var(--color-alert)",
                  }}
                >
                  Clear All
                </button>
              </div>
              <div 
                className="border rounded-lg overflow-hidden"
                style={{ borderColor: "var(--color-border)" }}
              >
                <table className="w-full">
                  <thead>
                    <tr 
                      className="border-b text-xs"
                      style={{ 
                        borderColor: "var(--color-border)",
                        backgroundColor: "rgba(128, 128, 128, 0.05)",
                      }}
                    >
                      <th className="text-left px-3 py-2">Name</th>
                      <th className="text-left px-3 py-2">Role</th>
                      <th className="text-center px-3 py-2">Status</th>
                      <th className="text-center px-3 py-2" style={{ width: "60px" }}>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pendingMembers.map((member, index) => (
                      <tr 
                        key={index}
                        className="border-b text-sm"
                        style={{ borderColor: "var(--color-border)" }}
                      >
                        <td className="px-3 py-2">{member.name}</td>
                        <td className="px-3 py-2">{member.role}</td>
                        <td className="px-3 py-2 text-center">
                          <span 
                            className="text-xs px-2 py-0.5 rounded"
                            style={{ 
                              backgroundColor: member.isInGuild ? "rgba(34, 197, 94, 0.1)" : "rgba(239, 68, 68, 0.1)",
                              color: member.isInGuild ? "#22C55E" : "#EF4444",
                            }}
                          >
                            {member.isInGuild ? "Active" : "Left"}
                          </span>
                        </td>
                        <td className="px-3 py-2 text-center">
                          <button
                            onClick={() => handleRemoveFromPending(index)}
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
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-between mt-4 pt-4 border-t" style={{ borderColor: "var(--color-border)" }}>
          <button
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
            onClick={handleImportAll}
            disabled={pendingMembers.length === 0 || importing}
            className="px-6 py-2 rounded-lg transition-colors hover:opacity-90"
            style={{
              backgroundColor: pendingMembers.length === 0 || importing ? "rgba(128, 128, 128, 0.3)" : "var(--color-primary)",
              color: "white",
              opacity: pendingMembers.length === 0 || importing ? 0.5 : 1,
              cursor: pendingMembers.length === 0 || importing ? "not-allowed" : "pointer",
            }}
          >
            {importing ? "Importing..." : `Import ${pendingMembers.length} Member${pendingMembers.length !== 1 ? 's' : ''}`}
          </button>
        </div>
      </div>
    </div>
  );
}
