"use client";

import React, { useEffect, useMemo, useState, useCallback } from "react";
import { FaSignOutAlt, FaSearch, FaPlus } from "react-icons/fa";
import { useRouter } from "next/navigation";
import { supabase } from "../../lib/supabaseClient";
import AddMemberForm from "./AddMemberForm";

interface Member {
  id: string;
  name: string;
  role?: string;
  created_at?: string;
  logger_id?: string;
  kicked?: boolean;
  [key: string]: any;
}

interface SidebarProps {
  children?: React.ReactNode;
}

export default function Sidebar({ children }: SidebarProps) {
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  // modal state
  const [isAddOpen, setIsAddOpen] = useState(false);

  // sign-out state & router
  const [signingOut, setSigningOut] = useState(false);
  const router = useRouter();

  useEffect(() => {
    let cancelled = false;

    async function loadMembers() {
      setLoading(true);
      try {
        // Fetch directly from Supabase with only needed fields
        const { data, error } = await supabase
          .from('members')
          .select('id, name, role, kicked, created_at')
          .order('created_at', { ascending: false });
        
        if (error) throw error;
        if (!cancelled) {
          setMembers(data || []);
        }
      } catch (err) {
        // Error loading members
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    loadMembers();

    // Set up real-time subscription
    const membersChannel = supabase
      .channel('sidebar-members-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'members' }, () => {
        if (!cancelled) loadMembers();
      })
      .subscribe();

    return () => {
      cancelled = true;
      supabase.removeChannel(membersChannel);
    };
  }, []);



  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    
    // Filter out kicked members
    const activeMembers = members.filter((m) => !m.kicked);
    
    // Apply search filter
    const searchFiltered = !q 
      ? activeMembers 
      : activeMembers.filter((m) => (m.name ?? "").toLowerCase().includes(q));
    
    // Sort by name alphabetically only
    return searchFiltered.sort((a, b) => {
      const nameA = (a.name ?? "").toLowerCase();
      const nameB = (b.name ?? "").toLowerCase();
      return nameA.localeCompare(nameB);
    });
  }, [members, search]);

  const openProfile = useCallback((m: Member) => {
    router.push(`/dashboard/members/${m.id}`);
  }, [router]);

  const handleMemberAdded = useCallback((member: Member) => {
    setMembers((s) => [member, ...s]);
  }, []);

  const handleKickMember = useCallback(async (memberId: string, memberName: string) => {
    if (!confirm(`Are you sure you want to kick ${memberName}?`)) {
      return;
    }

    try {
      const { error } = await supabase
        .from("members")
        .update({ kicked: true })
        .eq("id", memberId);

      if (error) {
        throw new Error(`Failed to kick member: ${error.message}`);
      }

      // Update local state to reflect the kick
      setMembers((s) => s.map((m) => m.id === memberId ? { ...m, kicked: true } : m));
    } catch (err: any) {
      alert(err?.message ?? "Failed to kick member");
    }
  }, []);

  const handleSignOut = useCallback(async () => {
    try {
      setSigningOut(true);
      const { error } = await supabase.auth.signOut();
      if (error) {
        // Sign out error
      }
      // redirect to login/root after sign out
      router.push("/");
    } catch (err) {
      // Sign out failed
    } finally {
      setSigningOut(false);
    }
  }, [router]);

  return (
    <div className="flex h-screen w-full">
      {/* Fixed modern sidebar — use CSS variables from globals.css for colors */}
      <aside
        className="w-72 shadow-lg flex flex-col"
        style={{
          backgroundColor: "var(--color-surface)",
          color: "var(--color-foreground)",
          borderRight: "1px solid var(--color-border)",
        }}
      >
        <div
          className="px-6 py-5 flex items-center gap-3"
          style={{ borderBottom: "1px solid var(--color-border)" }}
        >
          <div>
            <div className="text-lg font-semibold">Ap0theosis</div>
            <div className="text-xs" style={{ color: "var(--color-muted)" }}>
              Guild Management
            </div>
          </div>
        </div>

        {/* search + add button (plus on the right of the search bar) */}
        <div className="px-4 py-3">
          <div className="flex items-center gap-2">
            <label className="relative flex-1">
              <span className="sr-only">Search</span>
              <span
                className="absolute inset-y-0 left-3 flex items-center"
                style={{ color: "var(--color-muted)" }}
              >
                <FaSearch />
              </span>
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-10 pr-3 py-2 rounded-md border focus:outline-none"
                placeholder="Search members..."
                aria-label="Search members"
                style={{
                  backgroundColor: "rgba(0,0,0,0.03)",
                  borderColor: "transparent",
                  color: "var(--color-foreground)",
                }}
              />
            </label>

            {/* plus button to open add-member popup */}
            <button
              aria-label="Add member"
              onClick={() => setIsAddOpen(true)}
              className="ml-1 p-2 rounded-md transition-all"
              style={{
                backgroundColor: "var(--color-primary)",
                color: "white",
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = "var(--color-primary)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = "var(--color-primary)";
              }}
            >
              <FaPlus />
            </button>
          </div>
        </div>

        <nav className="flex-1 px-2 py-3 space-y-1 overflow-auto">
          {loading ? (
            <div className="px-3 text-sm text-slate-500">Loading members…</div>
          ) : filtered.length === 0 ? (
            <div className="px-3 text-sm text-slate-500">No members found</div>
          ) : (
            filtered.map((m) => (
              <div
                key={m.id}
                className="w-full flex items-center gap-2 px-3 py-2 rounded-md transition-colors group"
                style={{
                  transition: "background-color 0.2s ease",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = "rgba(128,128,128,0.15)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = "transparent";
                }}
              >
                <button
                  onClick={() => openProfile(m)}
                  className="flex-1 text-left select-none"
                  style={{ color: "var(--color-foreground)" }}
                >
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium truncate">{m.name}</div>
                  </div>
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleKickMember(m.id, m.name);
                  }}
                  className="opacity-0 group-hover:opacity-100 px-2 py-1 text-xs rounded transition-opacity"
                  style={{
                    backgroundColor: "var(--color-primary)",
                    color: "white",
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = "var(--color-primary)";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = "var(--color-primary)";
                  }}
                  aria-label={`Kick ${m.name}`}
                >
                  Kick
                </button>
              </div>
            ))
          )}
        </nav>

        <div className="px-4 py-4">
          <button
            onClick={handleSignOut}
            disabled={signingOut}
            aria-label="sign out"
            className="w-full flex items-center justify-center gap-2 px-4 py-2 rounded-full 
               hover:bg-red-600 transition disabled:opacity-60"
            style={{ color: "var(--color-foreground)" }}
          >
            <span className="text-sm font-medium">Logout</span>
            <FaSignOutAlt />
          </button>
        </div>
      </aside>

      {/* Main content — follows theme tokens */}
      <main
        className="flex-1 min-h-screen p-8"
        style={{
          backgroundColor: "var(--color-bg)",
          color: "var(--color-foreground)",
        }}
      >
        {children}
      </main>

      {/* Add Member Modal */}
      <AddMemberForm
        isOpen={isAddOpen}
        onClose={() => setIsAddOpen(false)}
        onMemberAdded={handleMemberAdded}
      />
    </div>
  );
}

