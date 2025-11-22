"use client";

import React, { useEffect, useMemo, useState, useCallback, memo } from "react";
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
        const res = await fetch("/api/members");
        if (!res.ok) throw new Error("Failed to fetch members");
        const json = await res.json();
        if (!cancelled) {
          const memberData = Array.isArray(json) ? json : json.members ?? [];
          console.log("Loaded members:", memberData);
          setMembers(memberData);
        }
      } catch (err) {
        console.error("Error loading members:", err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    loadMembers();
    return () => {
      cancelled = true;
    };
  }, []);



  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    // Filter out kicked members (kicked === true), keep members where kicked is false or null/undefined
    const activeMembers = members.filter((m) => m.kicked !== true);
    
    // Apply search filter
    const searchFiltered = !q 
      ? activeMembers 
      : activeMembers.filter((m) => (m.name ?? "").toLowerCase().includes(q));
    
    // Sort: non-Members first, then by role alphabetically, then by name alphabetically
    return searchFiltered.sort((a, b) => {
      const roleA = (a.role ?? "Member").toLowerCase();
      const roleB = (b.role ?? "Member").toLowerCase();
      const nameA = (a.name ?? "").toLowerCase();
      const nameB = (b.name ?? "").toLowerCase();
      
      // Check if roles are "member"
      const isAMember = roleA === "member";
      const isBMember = roleB === "member";
      
      // Non-members come first
      if (isAMember && !isBMember) return 1;
      if (!isAMember && isBMember) return -1;
      
      // If both are members or both are non-members, sort by role alphabetically
      if (roleA !== roleB) {
        return roleA.localeCompare(roleB);
      }
      
      // If roles are the same, sort by name alphabetically
      return nameA.localeCompare(nameB);
    });
  }, [members, search]);

  const openProfile = useCallback((m: Member) => {
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("openProfile", { detail: m }));
    }
  }, []);

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
      console.error("Error kicking member:", err);
      alert(err?.message ?? "Failed to kick member");
    }
  }, []);

  const handleSignOut = useCallback(async () => {
    try {
      setSigningOut(true);
      const { error } = await supabase.auth.signOut();
      if (error) {
        console.error("Sign out error:", error);
      }
      // redirect to login/root after sign out
      router.push("/");
    } catch (err) {
      console.error("Sign out failed:", err);
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
                    <div
                      className="text-xs truncate"
                      style={{ color: "var(--color-muted)" }}
                    >
                      {m.role ?? "Member"}
                    </div>
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

