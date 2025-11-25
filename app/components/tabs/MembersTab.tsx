"use client";

import { useState, useEffect, useMemo } from "react";
import { supabase } from "../../../lib/supabaseClient";
import { FaFileImport, FaPlus, FaSearch, FaEdit } from "react-icons/fa";
import ImportMembersModal from "../ImportMembersModal";
import AddMemberForm from "../AddMemberForm";

interface Member {
  id: string;
  name: string;
  role?: string;
  kicked?: boolean;
  created_at?: string;
}

export default function MembersTab() {
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [showKicked, setShowKicked] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [showAddMember, setShowAddMember] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterRole, setFilterRole] = useState<string>("all");

  useEffect(() => {
    loadMembers();
  }, []);

  async function loadMembers() {
    try {
      const { data, error } = await supabase
        .from('members')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setMembers(data || []);
    } catch (err) {
    } finally {
      setLoading(false);
    }
  }

  const handleMemberAdded = (newMember: Member) => {
    setMembers(prev => [newMember, ...prev]);
    setShowAddMember(false);
  };

  const displayedMembers = useMemo(() => {
    let filtered = showKicked ? members : members.filter(m => !m.kicked);
    
    // Apply search filter
    if (searchQuery.trim()) {
      filtered = filtered.filter(m => 
        m.name.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }
    
    // Apply role filter
    if (filterRole !== "all") {
      filtered = filtered.filter(m => (m.role || "Member").toLowerCase() === filterRole.toLowerCase());
    }
    
    return filtered;
  }, [members, showKicked, searchQuery, filterRole]);

  // Get unique roles for filter dropdown
  const roles = useMemo(() => {
    const roleSet = new Set(members.map(m => m.role || "Member"));
    return Array.from(roleSet).sort();
  }, [members]);

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

      loadMembers();
    } catch (error) {
      alert('Failed to update member status');
    }
  };

  if (loading) {
    return (
      <div className="p-8">
        <div className="text-lg" style={{ color: "var(--color-muted)" }}>Loading members...</div>
      </div>
    );
  }

  const activeMembersCount = members.filter(m => !m.kicked).length;
  const kickedMembersCount = members.filter(m => m.kicked).length;

  return (
    <div className="p-4">
      {/* Header */}
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold mb-1" style={{ color: "var(--color-foreground)" }}>
            Members
          </h1>
          <p className="text-sm" style={{ color: "var(--color-muted)" }}>
            {activeMembersCount} active {activeMembersCount === 1 ? 'member' : 'members'}
            {kickedMembersCount > 0 && `, ${kickedMembersCount} kicked`}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowKicked(!showKicked)}
            className="px-3 py-1.5 rounded text-sm font-medium flex items-center gap-2 hover:opacity-90 transition-all"
            style={{
              backgroundColor: showKicked ? "#ef4444" : "rgba(128, 128, 128, 0.2)",
              color: showKicked ? "white" : "var(--color-foreground)",
              border: showKicked ? "none" : "1px solid var(--color-border)",
            }}
          >
            {showKicked ? "Hide Kicked" : "Show Kicked"}
          </button>
          <button
            onClick={() => setShowAddMember(true)}
            className="px-3 py-1.5 rounded text-sm font-medium flex items-center gap-2 hover:opacity-90"
            style={{
              backgroundColor: "var(--color-primary)",
              color: "white",
            }}
          >
            <FaPlus />
            Add Member
          </button>
          <button
            onClick={() => setShowImport(true)}
            className="px-3 py-1.5 rounded text-sm font-medium flex items-center gap-2 hover:opacity-90"
            style={{
              backgroundColor: "var(--color-secondary)",
              color: "white",
            }}
          >
            <FaFileImport />
            Import
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="mb-4 flex gap-2 items-center">
        <div className="flex-1 relative">
          <FaSearch 
            className="absolute left-3 top-1/2 transform -translate-y-1/2" 
            style={{ color: "var(--color-muted)" }}
          />
          <input
            type="text"
            placeholder="Search members..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-3 py-2 rounded text-sm"
            style={{
              backgroundColor: "var(--color-background)",
              border: "1px solid var(--color-border)",
              color: "var(--color-foreground)",
            }}
          />
        </div>
        <select
          value={filterRole}
          onChange={(e) => setFilterRole(e.target.value)}
          className="px-3 py-2 rounded text-sm"
          style={{
            backgroundColor: "var(--color-background)",
            border: "1px solid var(--color-border)",
            color: "var(--color-foreground)",
          }}
        >
          <option value="all">All Roles</option>
          {roles.map(role => (
            <option key={role} value={role}>{role}</option>
          ))}
        </select>
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
              <th className="text-left px-4 py-2 text-xs font-medium">Member Name</th>
              <th className="text-center px-4 py-2 text-xs font-medium">Role</th>
              <th className="text-center px-4 py-2 text-xs font-medium">Status</th>
              <th className="text-center px-4 py-2 text-xs font-medium">Joined</th>
              <th className="text-center px-4 py-2 text-xs font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {displayedMembers.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center" style={{ color: "var(--color-muted)" }}>
                  {searchQuery || filterRole !== "all" 
                    ? "No members found matching your filters" 
                    : "No members yet"}
                </td>
              </tr>
            ) : (
              displayedMembers
                .sort((a, b) => {
                  const aCannotKick = a.role === 'cannot kick';
                  const bCannotKick = b.role === 'cannot kick';
                  if (aCannotKick !== bCannotKick) {
                    return bCannotKick ? 1 : -1;
                  }
                  return a.name.localeCompare(b.name);
                })
                .map((member) => (
                  <tr
                    key={member.id}
                    className="border-b cursor-pointer hover:bg-opacity-50 transition-colors"
                    style={{
                      borderColor: "var(--color-border)",
                      backgroundColor: "transparent",
                      opacity: member.kicked ? 0.5 : 1,
                    }}
                    onClick={() => openMemberProfile(member.id)}
                  >
                    <td className="px-4 py-3">
                      <div className="font-medium">{member.name}</div>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span 
                        className="px-2 py-1 rounded text-xs font-medium"
                        style={{
                          backgroundColor: "rgba(var(--color-primary-rgb, 107, 33, 168), 0.1)",
                          color: "var(--color-primary)",
                        }}
                      >
                        {member.role || 'Member'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span
                        className="px-2 py-1 rounded text-xs font-medium"
                        style={{
                          backgroundColor: member.kicked ? "rgba(239, 68, 68, 0.2)" : "rgba(16, 185, 129, 0.2)",
                          color: member.kicked ? "#ef4444" : "#10b981",
                        }}
                      >
                        {member.kicked ? "Kicked" : "Active"}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center text-xs" style={{ color: "var(--color-muted)" }}>
                      {member.created_at 
                        ? new Date(member.created_at).toLocaleDateString('en-US', { 
                            year: 'numeric', 
                            month: 'short', 
                            day: 'numeric' 
                          })
                        : 'N/A'}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <div className="flex items-center justify-center gap-2">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            openMemberProfile(member.id);
                          }}
                          className="px-2 py-1 rounded text-xs hover:opacity-80"
                          style={{
                            backgroundColor: "rgba(59, 130, 246, 0.8)",
                            color: "white",
                          }}
                          title="View profile"
                        >
                          <FaEdit />
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleToggleKick(member.id, member.kicked || false);
                          }}
                          className="px-2 py-1 rounded text-xs hover:opacity-80"
                          style={{
                            backgroundColor: member.kicked ? "#10b981" : "#f59e0b",
                            color: "white",
                          }}
                          disabled={member.role === 'cannot kick'}
                        >
                          {member.kicked ? "Restore" : "Kick"}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
            )}
          </tbody>
        </table>
      </div>

      {/* Footer Options */}
      <div className="mt-3 flex items-center justify-end">
        <div className="text-xs" style={{ color: "var(--color-muted)" }}>
          Showing {displayedMembers.length} of {members.length} members
        </div>
      </div>

      {/* Modals */}
      <ImportMembersModal
        isOpen={showImport}
        onClose={() => setShowImport(false)}
        onMembersImported={() => {
          loadMembers();
        }}
      />
      
      <AddMemberForm
        isOpen={showAddMember}
        onClose={() => setShowAddMember(false)}
        onMemberAdded={handleMemberAdded}
      />
    </div>
  );
}
