"use client";

import React, { useEffect, useMemo, useState } from "react";
import { FaSignOutAlt, FaSearch, FaPlus, FaTimes } from "react-icons/fa";
import { useRouter } from "next/navigation";
import { supabase } from "../../lib/supabaseClient";

interface Member {
  id: string;
  name: string;
  role?: string;
  groups?: string | null;
  created_at?: string;
  log_by?: string;
  [key: string]: any;
}

interface SidebarProps {
  children?: React.ReactNode;
}

export default function Sidebar({ children }: SidebarProps) {
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  // modal state + form
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const [newRole, setNewRole] = useState("");
  const [newGroups, setNewGroups] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
          setMembers(Array.isArray(json) ? json : json.members ?? []);
        }
      } catch (err) {
        if (!cancelled) {
          // fallback sample members
          setMembers([
            { id: "1", name: "Member1", role: "Healer", groups: null },
            { id: "2", name: "Member2", role: "DPS", groups: null },
            { id: "3", name: "Member3", role: "Tank", groups: null },
          ]);
        }
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
    if (!q) return members;
    return members.filter((m) => (m.name ?? "").toLowerCase().includes(q));
  }, [members, search]);

  function openProfile(m: Member) {
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("openProfile", { detail: m }));
    }
  }

  async function handleAddMember(e?: React.FormEvent) {
    e?.preventDefault();
    setError(null);
    const name = newName.trim();
    const role = newRole.trim() || "Member";
    const groups = newGroups.trim() || null;
    if (!name) {
      setError("Name is required");
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch("/api/members", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, role, groups, log_by: "web" }),
      });

      if (!res.ok) {
        const txt = await res.text();
        throw new Error(txt || "Failed to add member");
      }

      const created = await res.json();
      // assume API returns created member or { id, name, role }
      const member: Member = Array.isArray(created) ? created[0] : created;
      setMembers((s) => [member, ...s]);
      setNewName("");
      setNewRole("");
      setNewGroups("");
      setIsAddOpen(false);
    } catch (err: any) {
      setError(err?.message ?? "Failed to add member");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleSignOut() {
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
  }

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
              className="ml-1 p-2 rounded-md"
              style={{
                backgroundColor: "var(--color-primary)",
                color: "white",
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
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
              <button
                key={m.id}
                onClick={() => openProfile(m)}
                className="w-full text-left flex items-center gap-3 px-3 py-2 rounded-md transition-colors hover:bg-[rgba(0,0,0,0.03)]"
                style={{ color: "var(--color-foreground)" }}
              >
                <div
                  className="h-8 w-8 rounded-full flex items-center justify-center text-sm font-medium"
                  style={{
                    backgroundColor: "var(--seed-4)",
                    color: "var(--color-foreground)",
                  }}
                >
                  {m.name?.charAt(0) ?? "?"}
                </div>
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
      {isAddOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center"
          aria-modal="true"
          role="dialog"
        >
          <div
            className="absolute inset-0"
            onClick={() => !submitting && setIsAddOpen(false)}
            style={{ background: "rgba(0,0,0,0.4)" }}
          />
          <form
            onSubmit={handleAddMember}
            className="relative z-10 w-full max-w-md p-6 rounded-md"
            style={{
              background: "var(--color-surface)",
              border: "1px solid var(--color-border)",
              color: "var(--color-foreground)",
            }}
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-medium">Add Member</h3>
              <button
                type="button"
                onClick={() => !submitting && setIsAddOpen(false)}
                className="p-2 rounded"
                aria-label="Close"
                style={{ color: "var(--color-foreground)" }}
              >
                <FaTimes />
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-sm mb-1">Name</label>
                <input
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  className="w-full px-3 py-2 rounded border"
                  placeholder="Member name"
                  required
                  style={{
                    background: "transparent",
                    borderColor: "var(--color-border)",
                    color: "var(--color-foreground)",
                  }}
                />
              </div>

              <div>
                <label className="block text-sm mb-1">Role</label>
                <input
                  value={newRole}
                  onChange={(e) => setNewRole(e.target.value)}
                  className="w-full px-3 py-2 rounded border"
                  placeholder="e.g. DPS, Healer"
                  style={{
                    background: "transparent",
                    borderColor: "var(--color-border)",
                    color: "var(--color-foreground)",
                  }}
                />
              </div>

              <div>
                <label className="block text-sm mb-1">Groups</label>
                <input
                  value={newGroups}
                  onChange={(e) => setNewGroups(e.target.value)}
                  className="w-full px-3 py-2 rounded border"
                  placeholder="comma-separated groups"
                  style={{
                    background: "transparent",
                    borderColor: "var(--color-border)",
                    color: "var(--color-foreground)",
                  }}
                />
              </div>

              {error && <div className="text-sm text-red-500">{error}</div>}
            </div>

            <div className="mt-4 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => !submitting && setIsAddOpen(false)}
                className="px-3 py-2 rounded"
                style={{
                  border: "1px solid var(--color-border)",
                  color: "var(--color-foreground)",
                }}
                disabled={submitting}
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
                disabled={submitting}
              >
                {submitting ? "Adding…" : "Add Member"}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
