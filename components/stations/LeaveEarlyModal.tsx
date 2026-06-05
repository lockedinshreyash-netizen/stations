"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { leaveEarlySession } from "@/lib/work/sessions";
import type { User } from "@/types";

const MIN_REASON = 10;

interface LeaveEarlyModalProps {
  sessionId: string;
  user: User;
  onClose: () => void;
}

export default function LeaveEarlyModal({
  sessionId,
  user,
  onClose,
}: LeaveEarlyModalProps) {
  const router = useRouter();
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleLeave() {
    if (submitting) return;
    if (reason.trim().length < MIN_REASON) {
      setError(`Please give at least ${MIN_REASON} characters.`);
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      await leaveEarlySession(sessionId, user.id, user.username, reason);
      router.push("/work");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to leave.");
      setSubmitting(false);
    }
  }

  return (
    <div
      className="st-overlay fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.6)" }}
      onClick={onClose}
    >
      <div
        className="st-modal w-full max-w-md flex flex-col gap-5 p-8"
        style={{ background: "var(--bg-secondary)", border: "0.5px solid rgba(var(--fg-rgb),0.12)" }}
        onClick={(e) => e.stopPropagation()}
      >
        <h2
          className="font-poppins font-black uppercase text-[rgb(var(--fg-rgb))]"
          style={{ fontSize: "19px", letterSpacing: "0.04em" }}
        >
          Why are you leaving?
        </h2>
        <p className="font-poppins font-light text-[rgba(var(--fg-rgb),0.45)]" style={{ fontSize: "15px" }}>
          Your reason will be posted to the session chat so the group knows.
        </p>

        <textarea
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          rows={4}
          placeholder="Something came up…"
          className="st-field w-full resize-none bg-transparent font-poppins font-light text-[rgb(var(--fg-rgb))] placeholder:text-[rgba(var(--fg-rgb),0.25)] focus:outline-none p-3"
          style={{ fontSize: "16px", border: "0.5px solid rgba(var(--fg-rgb),0.15)", lineHeight: 1.5 }}
        />

        {error && (
          <p className="font-poppins" style={{ fontSize: "15px", color: "var(--accent)" }}>
            {error}
          </p>
        )}

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={handleLeave}
            disabled={submitting || reason.trim().length < MIN_REASON}
            className="st-btn font-poppins font-bold uppercase disabled:opacity-40 flex-1"
            style={{
              fontSize: "15px",
              letterSpacing: "0.12em",
              background: "var(--accent)",
              color: "var(--bg-primary)",
              padding: "12px",
            }}
          >
            {submitting ? "Leaving…" : "Leave Session"}
          </button>
          <button
            type="button"
            onClick={onClose}
            className="font-poppins font-medium uppercase text-[rgba(var(--fg-rgb),0.5)] hover:text-[rgb(var(--fg-rgb))] transition-colors"
            style={{ fontSize: "15px", letterSpacing: "0.1em", padding: "12px" }}
          >
            Stay
          </button>
        </div>
      </div>
    </div>
  );
}
