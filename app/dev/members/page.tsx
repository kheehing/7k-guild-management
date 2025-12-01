"use client";

import { useState, useEffect } from "react";
import { supabase } from "../../../lib/supabaseClient";
import { useRouter } from "next/navigation";

export default function DevMembersPage() {
  const [members, setMembers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editFields, setEditFields] = useState<any>({});
  const [sortKey, setSortKey] = useState<string>('created_at');
  const [sortAsc, setSortAsc] = useState<boolean>(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const router = useRouter();

  useEffect(() => {
    checkAuth();
  }, []);

  async function checkAuth() {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      router.push("/");
    } else {
      setIsAuthenticated(true);
      loadMembers();
    }
    setLoading(false);
  }

  async function loadMembers() {
    setLoading(true);
    try {
      const response = await fetch("/api/members");
      const data = await response.json();
      setMembers(data.members || []);
    } finally {
      setLoading(false);
    }
  }

  function startEdit(member: any) {
    setEditingId(member.id);
    setEditFields({ ...member });
  }

  function cancelEdit() {
    setEditingId(null);
    setEditFields({});
  }

  async function saveEdit(memberId: string) {
    try {
      const { error } = await supabase
        .from("members")
        .update({
          name: editFields.name,
          role: editFields.role,
          kicked: editFields.kicked,
          kick_date: editFields.kick_date,
          created_at: editFields.created_at,
        })
        .eq("id", memberId);
      if (error) throw error;
      setMembers(members.map(m => m.id === memberId ? { ...editFields } : m));
      cancelEdit();
    } catch (error) {
      alert("Failed to update member");
    }
  }

  function formatDatetimeLocal(isoString: string) {
    const d = new Date(isoString);
    const pad = (n: number) => n.toString().padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  }

  function handleCreatedAtChange(e: React.ChangeEvent<HTMLInputElement>) {
    const value = e.target.value;
    if (value) {
      const local = new Date(value);
      if (!isNaN(local.getTime())) {
        setEditFields({ ...editFields, created_at: local.toISOString() });
      }
    }
  }

  function renderHeader(key: string, label: string) {
    const isActive = sortKey === key;
    return (
      <th
        className="text-left px-4 py-3 text-sm font-medium cursor-pointer select-none"
        style={{ color: isActive ? "var(--color-primary)" : "var(--color-foreground)" }}
        onClick={() => {
          if (sortKey === key) {
            setSortAsc(!sortAsc);
          } else {
            setSortKey(key);
            setSortAsc(true);
          }
        }}
      >
        {label}
        {isActive && (
          <span className="ml-1 text-xs">
            {sortAsc ? "▲" : "▼"}
          </span>
        )}
      </th>
    );
  }

  function getSortedMembers() {
    const sorted = [...members];
    sorted.sort((a, b) => {
      let aVal = a[sortKey];
      let bVal = b[sortKey];
      if (sortKey === "created_at" || sortKey === "kick_date") {
        aVal = aVal ? new Date(aVal).getTime() : 0;
        bVal = bVal ? new Date(bVal).getTime() : 0;
      }
      if (sortKey === "kicked") {
        aVal = !!aVal ? 1 : 0;
        bVal = !!bVal ? 1 : 0;
      }
      if (aVal < bVal) return sortAsc ? -1 : 1;
      if (aVal > bVal) return sortAsc ? 1 : -1;
      return 0;
    });
    return sorted;
  }

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: "var(--color-bg)" }}>
        <div style={{ color: "var(--color-muted)" }}>Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen p-8" style={{ backgroundColor: "var(--color-bg)" }}>
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-3xl font-bold" style={{ color: "var(--color-foreground)" }}>Members Admin</h1>
          <button
            onClick={() => router.push("/dev")}
            className="px-4 py-2 rounded"
            style={{
              backgroundColor: "var(--color-surface)",
              border: "1px solid var(--color-border)",
              color: "var(--color-foreground)",
            }}
          >
            ← Back to Dev Tools
          </button>
        </div>

        <div className="space-y-4">
          <h2 className="text-xl font-bold mb-4" style={{ color: "var(--color-foreground)" }}>All Members</h2>
          {loading ? (
            <div className="text-center py-8" style={{ color: "var(--color-muted)" }}>Loading...</div>
          ) : (
            <div className="rounded-lg border overflow-x-auto" style={{ borderColor: "var(--color-border)", backgroundColor: "var(--color-surface)" }}>
              <table className="w-full">
                <thead>
                  <tr className="border-b" style={{ borderColor: "var(--color-border)", backgroundColor: "rgba(128, 128, 128, 0.1)" }}>
                    {renderHeader("name", "Name")}
                    {renderHeader("role", "Role")}
                    {renderHeader("kicked", "Kicked")}
                    {renderHeader("kick_date", "Kick Date")}
                    {renderHeader("created_at", "Created At")}
                    <th className="text-left px-4 py-3 text-sm font-medium" style={{ color: "var(--color-foreground)" }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {getSortedMembers().map((member, idx) => (
                    <tr key={member.id} className="border-b" style={{ borderColor: "var(--color-border)", backgroundColor: idx % 2 === 0 ? "transparent" : "rgba(128, 128, 128, 0.03)" }}>
                      <td className="px-4 py-3 text-sm" style={{ color: "var(--color-foreground)" }}>
                        {editingId === member.id ? (
                          <input
                            type="text"
                            value={editFields.name}
                            onChange={e => setEditFields({ ...editFields, name: e.target.value })}
                            className="px-2 py-1 rounded border w-32"
                            style={{ backgroundColor: "var(--color-bg)", borderColor: "var(--color-border)", color: "var(--color-foreground)" }}
                          />
                        ) : member.name}
                      </td>
                      <td className="px-4 py-3 text-sm" style={{ color: "var(--color-foreground)" }}>
                        {editingId === member.id ? (
                          <input
                            type="text"
                            value={editFields.role}
                            onChange={e => setEditFields({ ...editFields, role: e.target.value })}
                            className="px-2 py-1 rounded border w-32"
                            style={{ backgroundColor: "var(--color-bg)", borderColor: "var(--color-border)", color: "var(--color-foreground)" }}
                          />
                        ) : member.role}
                      </td>
                      <td className="px-4 py-3 text-sm">
                        {editingId === member.id ? (
                          <input
                            type="checkbox"
                            checked={!!editFields.kicked}
                            onChange={e => setEditFields({ ...editFields, kicked: e.target.checked })}
                            className="w-4 h-4"
                          />
                        ) : (
                          member.kicked ? (
                            <span className="px-2 py-1 rounded text-xs" style={{ backgroundColor: "rgba(239, 68, 68, 0.2)", color: "#EF4444" }}>Kicked</span>
                          ) : (
                            <span className="px-2 py-1 rounded text-xs" style={{ backgroundColor: "rgba(34, 197, 94, 0.2)", color: "#22C55E" }}>Active</span>
                          )
                        )}
                      </td>
                      <td className="px-4 py-3 text-sm" style={{ color: "var(--color-foreground)" }}>
                        {editingId === member.id ? (
                          <input
                            type="date"
                            value={editFields.kick_date || ""}
                            onChange={e => setEditFields({ ...editFields, kick_date: e.target.value })}
                            className="px-2 py-1 rounded border w-32"
                            style={{ backgroundColor: "var(--color-bg)", borderColor: "var(--color-border)", color: "var(--color-foreground)" }}
                          />
                        ) : (member.kick_date ? new Date(member.kick_date).toLocaleDateString() : "-")}
                      </td>
                      <td className="px-4 py-3 text-sm" style={{ color: "var(--color-foreground)" }}>
                        {editingId === member.id ? (
                          <input
                            type="datetime-local"
                            value={editFields.created_at ? formatDatetimeLocal(editFields.created_at) : ""}
                            onChange={e => handleCreatedAtChange(e)}
                            className="px-2 py-1 rounded border w-48 mb-1"
                            style={{ backgroundColor: "var(--color-bg)", borderColor: "var(--color-border)", color: "var(--color-foreground)" }}
                          />
                        ) : (
                          member.created_at ? (
                            <>
                              {new Date(member.created_at).toLocaleDateString()}<br />
                              <span className="text-xs opacity-80">{new Date(member.created_at).toLocaleTimeString()}</span>
                            </>
                          ) : "-"
                        )}
                      </td>
                      <td className="px-4 py-3 text-sm">
                        {editingId === member.id ? (
                          <div className="flex gap-2">
                            <button
                              onClick={() => saveEdit(member.id)}
                              className="px-3 py-1 rounded text-xs font-medium"
                              style={{ backgroundColor: "#22C55E", color: "white" }}
                            >
                              Save
                            </button>
                            <button
                              onClick={cancelEdit}
                              className="px-3 py-1 rounded text-xs font-medium"
                              style={{ backgroundColor: "var(--color-muted)", color: "white" }}
                            >
                              Cancel
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => startEdit(member)}
                            className="px-3 py-1 rounded text-xs font-medium"
                            style={{ backgroundColor: "var(--color-primary)", color: "white" }}
                          >
                            Edit
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
