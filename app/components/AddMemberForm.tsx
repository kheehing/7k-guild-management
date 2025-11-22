"use client";

import { useState, useRef, useEffect } from "react";
import { FaTimes } from "react-icons/fa";
import { supabase } from "../../lib/supabaseClient";

interface AddMemberFormProps {
  isOpen: boolean;
  onClose: () => void;
  onMemberAdded?: (member: any) => void;
}

export default function AddMemberForm({ isOpen, onClose, onMemberAdded }: AddMemberFormProps) {
  const [newName, setNewName] = useState("");
  const [newRole, setNewRole] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const newNameRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => newNameRef.current?.focus(), 50);
      setError(null);
    }
  }, [isOpen]);

  async function handleAddMember(e?: React.FormEvent) {
    e?.preventDefault();
    setError(null);
    const name = newName.trim();
    const role = newRole.trim() || "Member";
    if (!name) {
      setError("Name is required");
      return;
    }

    setSubmitting(true);
    try {
      // Step 1: Get current user information
      const { data: authData } = await supabase.auth.getUser();
      const currentUser = authData?.user ?? null;
      const userIdentifier = currentUser?.email ?? currentUser?.id ?? null;

      if (!userIdentifier) {
        throw new Error("Unable to identify current user");
      }

      // Step 2: Create a new logger record for each new member
      const { data: newLogger, error: loggerErr } = await supabase
        .from("logger")
        .insert([{ logged_by: userIdentifier }])
        .select("id")
        .single();

      if (loggerErr) {
        throw new Error(`Failed to create logger: ${loggerErr.message}`);
      }

      const logger_id = newLogger?.id;

      if (!logger_id) {
        throw new Error("Failed to obtain logger ID");
      }

      // Step 3: Create the member with the logger_id
      const { data: created, error: memberErr } = await supabase
        .from("members")
        .insert([{ name, role, logger_id, kicked: false }])
        .select("id,name,role,created_at,logger_id,kicked")
        .single();

      if (memberErr) {
        throw new Error(`Failed to add member: ${memberErr.message}`);
      }

      // Notify parent component
      if (onMemberAdded && created) {
        onMemberAdded(created);
      }

      // Reset form and close
      setNewName("");
      setNewRole("");
      onClose();
    } catch (err: any) {
      setError(err?.message ?? "Failed to add member");
    } finally {
      setSubmitting(false);
    }
  }

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      aria-modal="true"
      role="dialog"
    >
      <div
        className="absolute inset-0"
        onClick={() => !submitting && onClose()}
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
            onClick={() => !submitting && onClose()}
            className="p-2 rounded"
            aria-label="Close"
            style={{ color: "var(--color-foreground)" }}
          >
            <FaTimes />
          </button>
        </div>

        <div className="space-y-3">
          <div>
            <label htmlFor="new-name" className="block text-sm mb-1">Name</label>
            <input
              id="new-name"
              name="name"
              ref={newNameRef}
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              className="w-full px-3 py-2 rounded border"
              placeholder="Member's name"
              required
              style={{
                background: "transparent",
                borderColor: "var(--color-border)",
                color: "var(--color-foreground)",
              }}
            />
          </div>

          <div>
            <label htmlFor="new-role" className="block text-sm mb-1">Role</label>
            <input
              id="new-role"
              name="role"
              value={newRole}
              onChange={(e) => setNewRole(e.target.value)}
              className="w-full px-3 py-2 rounded border"
              placeholder="leave blank for 'Member'"
              style={{
                background: "transparent",
                borderColor: "var(--color-border)",
                color: "var(--color-foreground)",
              }}
            />
          </div>

          <div aria-live="polite">
            {error && <div className="text-sm text-red-500">{error}</div>}
          </div>
        </div>

        <div className="mt-4 flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={() => !submitting && onClose()}
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
  );
}
