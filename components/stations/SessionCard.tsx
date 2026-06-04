"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { joinSession } from "@/lib/work/sessions";
import { formatDuration, formatStartsIn } from "@/lib/work/format";
import type { WorkSessionWithMeta } from "@/types";

interface SessionCardProps {
  session: WorkSessionWithMeta;
  userId: string;
  /** True if the current user is already a member. */
  isMember: boolean;
  /** Called after a successful join so the parent can refresh. */
  onJoined?: (sessionId: string) => void;
}

export default function SessionCard({
  session,
  userId,
  isMember,
  onJoined,
}: SessionCardProps) {
  const router = useRouter();
  const [now, setNow] = useState(() => Date.now());
  const [joining, setJoining] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Tick once a minute for the "starts in" countdown on scheduled cards.
  useEffect(() => {
    if (session.status !== "scheduled") return;
    const id = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(id);
  }, [session.status]);

  const open = () => router.push(`/work/${session.id}`);

  async function handleJoin(e: React.MouseEvent) {
    e.stopPropagation();
    if (joining) return;
    setJoining(true);
    setError(null);
    try {
      await joinSession(session.id, userId);
      onJoined?.(session.id);
      router.push(`/work/${session.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to join.");
      setJoining(false);
    }
  }

  // Joinable while scheduled OR live — a co-working room you can't enter is
  // useless. Completed/cancelled sessions are not joinable.
  const canJoin =
    (session.status === "scheduled" || session.status === "active") && !isMember;

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={open}
      onKeyDown={(e) => {
        if (e.key === "Enter") open();
      }}
      className="st-card st-card-hover group flex flex-col gap-4 p-5 cursor-pointer overflow-hidden hover:bg-[rgba(var(--fg-rgb),0.03)]"
      style={{
        background: "var(--bg-surface)",
        border: "0.5px solid rgba(var(--fg-rgb),0.1)",
      }}
    >
      {/* Top row: category + status */}
      <div className="flex items-center justify-between">
        <span
          className="font-poppins font-bold uppercase text-[rgba(var(--fg-rgb),0.35)]"
          style={{ fontSize: "10px", letterSpacing: "0.18em" }}
        >
          {session.category}
        </span>
        <StatusPill session={session} now={now} />
      </div>

      {/* Title */}
      <h3
        className="font-poppins font-bold text-[rgb(var(--fg-rgb))] leading-snug"
        style={{ fontSize: "16px" }}
      >
        {session.title}
      </h3>

      {/* Meta */}
      <div className="flex flex-col gap-1">
        <span
          className="font-poppins text-[rgba(var(--fg-rgb),0.4)]"
          style={{ fontSize: "12px" }}
        >
          {session.host_username}
        </span>
        <span
          className="font-poppins text-[rgba(var(--fg-rgb),0.4)]"
          style={{ fontSize: "12px" }}
        >
          {formatDuration(session.duration_minutes)} ·{" "}
          {session.member_count}{" "}
          {session.member_count === 1 ? "person" : "people"}
        </span>
      </div>

      {error && (
        <span className="font-poppins" style={{ fontSize: "11px", color: "var(--accent)" }}>
          {error}
        </span>
      )}

      {/* Action */}
      <div className="mt-1">
        {canJoin ? (
          <button
            type="button"
            onClick={handleJoin}
            disabled={joining}
            className="st-btn font-poppins font-bold uppercase disabled:opacity-50"
            style={{
              fontSize: "11px",
              letterSpacing: "0.1em",
              background: "var(--accent)",
              color: "var(--bg-primary)",
              padding: "8px 18px",
            }}
          >
            {joining ? "Joining…" : "Join"}
          </button>
        ) : (
          <button
            type="button"
            onClick={open}
            className="st-btn font-poppins font-bold uppercase"
            style={{
              fontSize: "11px",
              letterSpacing: "0.1em",
              background: "transparent",
              color: "rgba(var(--fg-rgb),0.6)",
              padding: "8px 18px",
              border: "0.5px solid rgba(var(--fg-rgb),0.2)",
            }}
          >
            {isMember ? "Enter" : "View"}
          </button>
        )}
      </div>
    </div>
  );
}

function StatusPill({
  session,
  now,
}: {
  session: WorkSessionWithMeta;
  now: number;
}) {
  if (session.status === "active") {
    return (
      <span
        className="font-poppins font-black uppercase flex items-center gap-1.5"
        style={{ fontSize: "10px", letterSpacing: "0.12em", color: "var(--accent)" }}
      >
        <span
          className="inline-block rounded-full"
          style={{ width: "6px", height: "6px", background: "var(--accent)" }}
        />
        Live
      </span>
    );
  }
  if (session.status === "completed") {
    return (
      <span
        className="font-poppins uppercase text-[rgba(var(--fg-rgb),0.3)]"
        style={{ fontSize: "10px", letterSpacing: "0.12em" }}
      >
        Completed
      </span>
    );
  }
  if (session.status === "cancelled") {
    return (
      <span
        className="font-poppins uppercase text-[rgba(var(--fg-rgb),0.3)]"
        style={{ fontSize: "10px", letterSpacing: "0.12em" }}
      >
        Cancelled
      </span>
    );
  }
  // scheduled
  return (
    <span
      className="font-poppins text-[rgba(var(--fg-rgb),0.5)]"
      style={{ fontSize: "11px" }}
    >
      {formatStartsIn(session.scheduled_start_time, now)}
    </span>
  );
}
