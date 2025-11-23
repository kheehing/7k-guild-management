"use client";

import { useState, useEffect, useMemo } from "react";
import { supabase } from "../../../lib/supabaseClient";
import { FaFileImport } from "react-icons/fa";
import ImportMembersModal from "../ImportMembersModal";

interface Member {
  id: string;
  name: string;
  role?: string;
  kicked?: boolean;
  created_at?: string;
}

interface MemberStats {
  memberId: string;
  memberName: string;
  role: string;
  kicked: boolean;
  totalEntries: number;
  attendanceRate: number; // percentage of entries where they attended
  averageScore: number;
  bestScore: number;
  lastEntry: string | null;
  daysSinceLastEntry: number | null;
  weeklyActivity: number[]; // 7 days, score per day
}

export default function MembersTab() {
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [showKicked, setShowKicked] = useState(false);
  const [showImport, setShowImport] = useState(false);

  useEffect(() => {
    loadMembers();
  }, []);

  async function loadMembers() {
    try {
      // Simple, fast query - just get members
      const { data, error } = await supabase
        .from('members')
        .select('*')
        .order('name');

      if (error) throw error;
      setMembers(data || []);
    } catch (err) {
      console.error("Error loading members:", err);
    } finally {
      setLoading(false);
    }
  }

  const displayedMembers = useMemo(() => {
    return showKicked ? members : members.filter(m => !m.kicked);
  }, [members, showKicked]);

  const openMemberProfile = (memberId: string) => {
    const member = members.find(m => m.id === memberId);
    if (member) {
      window.dispatchEvent(new CustomEvent("openProfile", { detail: member }));
    }
  };

  const handleToggleKick = async (memberId: string, currentKickedStatus: boolean) => {
    try {
      const response = await fetch(`/api/members/${memberId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          kicked: !currentKickedStatus,
        }),
      });

      if (!response.ok) throw new Error('Failed to update member status');

      // Reload data
      loadMembers();
    } catch (error) {
      console.error('Error updating member status:', error);
      alert('Failed to update member status');
    }
  };

  if (loading) {
    return (
      <div className="p-8">
        <div className="text-lg">Loading member statistics...</div>
      </div>
    );
  }

  return (
    <div className="p-4">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold mb-1">Members</h1>
          <p className="text-sm" style={{ color: "var(--color-muted)" }}>
            View and manage guild members
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowImport(true)}
            className="px-3 py-1.5 rounded text-sm font-medium flex items-center gap-2"
            style={{
              backgroundColor: "var(--color-secondary)",
              color: "white",
            }}
          >
            <FaFileImport />
            Import Members
          </button>
        </div>
      </div>

      {/* Members Table */}
      <div 
        className="rounded-lg overflow-hidden"
        style={{ 
          border: "1px solid var(--color-border)",
          backgroundColor: "var(--color-surface)"
        }}
      >
        <table className="w-full text-sm">
          <thead>
            <tr 
              className="border-b"
              style={{ 
                borderColor: "var(--color-border)",
                backgroundColor: "rgba(128, 128, 128, 0.1)"
              }}
            >
              <th className="text-left px-3 py-1.5 text-xs font-medium">Member</th>
              <th className="text-center px-3 py-1.5 text-xs font-medium">Role</th>
              <th className="text-center px-3 py-1.5 text-xs font-medium">Status</th>
              <th className="text-center px-3 py-1.5 text-xs font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {displayedMembers
              .sort((a, b) => {
                // Put "cannot kick" members at the top
                const aCannotKick = a.role === 'cannot kick' ? 1 : 0;
                const bCannotKick = b.role === 'cannot kick' ? 1 : 0;
                if (aCannotKick !== bCannotKick) {
                  return bCannotKick - aCannotKick;
                }
                // Then sort alphabetically
                return a.name.localeCompare(b.name);
              })
              .map((member) => (
                <tr
                  key={member.id}
                  className="border-b cursor-pointer hover:bg-opacity-50"
                  style={{
                    borderColor: "var(--color-border)",
                    backgroundColor: "transparent",
                    opacity: member.kicked ? 0.5 : 1,
                  }}
                  onClick={() => openMemberProfile(member.id)}
                >
                  <td className="px-3 py-1.5">
                    <div className="font-medium text-sm">{member.name}</div>
                  </td>
                  <td className="px-3 py-1.5 text-center text-xs">{member.role || 'Member'}</td>
                  <td className="px-3 py-1.5 text-center">
                    <span
                      className="px-2 py-0.5 rounded text-xs"
                      style={{
                        backgroundColor: member.kicked ? "rgba(239, 68, 68, 0.2)" : "rgba(16, 185, 129, 0.2)",
                        color: member.kicked ? "#ef4444" : "#10b981",
                      }}
                    >
                      {member.kicked ? "Kicked" : "Active"}
                    </span>
                  </td>
                  <td className="px-3 py-1.5 text-center">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleToggleKick(member.id, member.kicked || false);
                      }}
                      className="px-2 py-0.5 rounded text-xs"
                      style={{
                        backgroundColor: member.kicked ? "#10b981" : "#f59e0b",
                        color: "white",
                      }}
                      disabled={member.role === 'cannot kick'}
                    >
                      {member.kicked ? "Restore" : "Kick"}
                    </button>
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>

      <div className="mt-3">
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={showKicked}
            onChange={(e) => setShowKicked(e.target.checked)}
            className="rounded"
          />
          Show kicked members
        </label>
      </div>

      {/* Import Members Modal */}
      <ImportMembersModal
        isOpen={showImport}
        onClose={() => setShowImport(false)}
        onMembersImported={() => {
          loadMembers();
        }}
      />
    </div>
  );
}
