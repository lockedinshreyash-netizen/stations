"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import {
  getSessionById,
  getSessionMembers,
  updateSessionStatus,
  cancelSession,
} from "@/lib/work/sessions";
import { markSessionPresent } from "@/lib/firebase/work-chat";
import SessionTimer from "@/components/stations/SessionTimer";
import SessionChat from "@/components/stations/SessionChat";
import SessionMemberList, {
  type SessionMemberRow,
} from "@/components/stations/SessionMemberList";
import LeaveEarlyModal from "@/components/stations/LeaveEarlyModal";
import FocusQualityRating from "@/components/stations/FocusQualityRating";
import type { User, WorkSessionStatus, WorkSessionWithMeta } from "@/types";

const FIVE_MIN_MS = 5 * 60 * 1000;

interface SessionRoomProps {
  user: User;
  initialSession: WorkSessionWithMeta;
  initialMembers: SessionMemberRow[];
}

/**
 * Derives the *displayed* status from wall-clock time, since transitions are
 * client-driven (no backend job). A terminal DB status (completed/cancelled)
 * always wins; otherwise the start/end timestamps decide.
 */
function effectiveStatus(
  session: WorkSessionWithMeta,
  nowMs: number
): WorkSessionStatus {
  if (session.status === "cancelled" || session.status === "completed") {
    return session.status;
  }
  const start = new Date(session.scheduled_start_time).getTime();
  const end = new Date(session.scheduled_end_time).getTime();
  if (nowMs >= end) return "completed";
  if (nowMs >= start) return "active";
  return "scheduled";
}

export default function SessionRoom({
  user,
  initialSession,
  initialMembers,
}: SessionRoomProps) {
  const router = useRouter();
  const [session, setSession] = useState(initialSession);
  const [members, setMembers] = useState<SessionMemberRow[]>(initialMembers);
  const [now, setNow] = useState(() => Date.now());
  const [showLeave, setShowLeave] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isHost = session.host_id === user.id;
  const ownMembership = members.find((m) => m.user_id === user.id) ?? null;
  const isMember = ownMembership !== null;
  const leftEarly = ownMembership?.left_early ?? false;

  const status = effectiveStatus(session, now);

  const refetch = useCallback(async () => {
    try {
      const [s, m] = await Promise.all([
        getSessionById(session.id),
        getSessionMembers(session.id),
      ]);
      if (s) setSession(s);
      setMembers(m);
    } catch {
      /* transient — keep last good state */
    }
  }, [session.id]);

  // Room-local clock for status derivation.
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  // Realtime: session row + members.
  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel(`work_session_${session.id}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "work_sessions",
          filter: `id=eq.${session.id}`,
        },
        () => refetch()
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "work_session_members",
          filter: `session_id=eq.${session.id}`,
        },
        () => refetch()
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [session.id, refetch]);

  // Presence — mark online while a member is in the room.
  useEffect(() => {
    if (!isMember) return;
    return markSessionPresent(session.id, user.id);
  }, [isMember, session.id, user.id]);

  // Host persists time-driven status transitions to the DB.
  useEffect(() => {
    if (!isHost) return;
    if (status === "active" && session.status === "scheduled") {
      updateSessionStatus(session.id, "active").catch(() => {});
    } else if (
      status === "completed" &&
      (session.status === "scheduled" || session.status === "active")
    ) {
      updateSessionStatus(session.id, "completed").catch(() => {});
    }
  }, [status, session.status, session.id, isHost]);

  async function handleCancel() {
    if (cancelling) return;
    if (!confirm("Cancel this session for everyone?")) return;
    setCancelling(true);
    try {
      await cancelSession(session.id);
      router.push("/work");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to cancel.");
      setCancelling(false);
    }
  }

  const othersCount = Math.max(0, members.length - 1);
  const canSend = isMember && !leftEarly && status === "active";

  const timerProps = useMemo(() => {
    if (status === "scheduled") {
      return {
        key: "to-start",
        label: "Starts in",
        targetIso: session.scheduled_start_time,
        ended: false,
        warnUnderMs: 0,
      };
    }
    return {
      key: "to-end",
      label: "Time remaining",
      targetIso: session.scheduled_end_time,
      ended: false,
      warnUnderMs: FIVE_MIN_MS,
    };
  }, [status, session.scheduled_start_time, session.scheduled_end_time]);

  /* ---- Cancelled ---- */
  if (status === "cancelled") {
    return (
      <Shell>
        <div className="flex-1 flex items-center justify-center">
          <p className="font-playfair italic text-[rgba(var(--fg-rgb),0.4)]" style={{ fontSize: "18px" }}>
            This session was cancelled.
          </p>
        </div>
      </Shell>
    );
  }

  /* ---- Completed → rating (members) or ended notice (viewers) ---- */
  if (status === "completed") {
    return (
      <Shell>
        <div className="flex-1 flex items-center justify-center">
          <SessionTimer label="" targetIso={null} ended />
        </div>
        {isMember ? (
          <FocusQualityRating
            sessionId={session.id}
            userId={user.id}
            durationMinutes={session.duration_minutes}
            othersCount={othersCount}
            existingRating={ownMembership?.focus_quality_rating ?? null}
            onDone={() => router.push("/work")}
          />
        ) : null}
      </Shell>
    );
  }

  /* ---- Scheduled / Active — three-column layout ---- */
  return (
    <Shell
      right={
        isHost && (
          <button
            type="button"
            onClick={handleCancel}
            disabled={cancelling}
            className="font-poppins font-bold uppercase text-[rgba(var(--fg-rgb),0.4)] hover:text-[var(--accent)] transition-colors disabled:opacity-50"
            style={{ fontSize: "10px", letterSpacing: "0.1em" }}
          >
            {cancelling ? "Cancelling…" : "Cancel session"}
          </button>
        )
      }
    >
      {error && (
        <div className="px-6 py-2 font-poppins" style={{ fontSize: "11px", color: "var(--accent)" }}>
          {error}
        </div>
      )}

      {leftEarly && (
        <div
          className="px-6 py-3 font-poppins text-center"
          style={{ fontSize: "12px", color: "var(--accent)", borderBottom: "0.5px solid rgba(var(--fg-rgb),0.08)" }}
        >
          You left this session early.
        </div>
      )}

      <div className="flex-1 min-h-0 flex flex-col lg:flex-row">
        {/* Timer (left) */}
        <div
          className="lg:w-[30%] flex flex-col items-center justify-center gap-8 p-8 shrink-0"
          style={{ borderRight: "0.5px solid rgba(var(--fg-rgb),0.08)" }}
        >
          <SessionTimer
            key={timerProps.key}
            label={timerProps.label}
            targetIso={timerProps.targetIso}
            ended={timerProps.ended}
            warnUnderMs={timerProps.warnUnderMs}
            onReachZero={refetch}
          />
          <p
            className="font-poppins text-[rgba(var(--fg-rgb),0.35)] text-center"
            style={{ fontSize: "12px" }}
          >
            {session.title}
          </p>
          {isMember && !leftEarly && status === "active" && (
            <button
              type="button"
              onClick={() => setShowLeave(true)}
              className="font-poppins font-bold uppercase"
              style={{
                fontSize: "10px",
                letterSpacing: "0.1em",
                border: "0.5px solid rgba(var(--fg-rgb),0.2)",
                color: "rgba(var(--fg-rgb),0.5)",
                padding: "8px 18px",
              }}
            >
              Leave early
            </button>
          )}
        </div>

        {/* Chat (center) */}
        <div className="flex-1 min-h-0 min-w-0">
          <SessionChat
            sessionId={session.id}
            user={user}
            chatClosed={session.chat_closed}
            canSend={canSend}
            isHost={isHost}
          />
        </div>

        {/* Members (right) */}
        <div
          className="lg:w-[25%] shrink-0 min-h-0"
          style={{ borderLeft: "0.5px solid rgba(var(--fg-rgb),0.08)" }}
        >
          <SessionMemberList
            sessionId={session.id}
            hostId={session.host_id}
            members={members}
          />
        </div>
      </div>

      {showLeave && (
        <LeaveEarlyModal
          sessionId={session.id}
          user={user}
          onClose={() => setShowLeave(false)}
        />
      )}
    </Shell>
  );
}

function Shell({
  children,
  right,
}: {
  children: React.ReactNode;
  right?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col" style={{ height: "100dvh" }}>
      <div
        className="shrink-0 px-6 py-4 flex items-center justify-between"
        style={{ borderBottom: "0.5px solid rgba(var(--fg-rgb),0.08)" }}
      >
        <Link
          href="/work"
          className="font-poppins font-medium uppercase text-[rgba(var(--fg-rgb),0.4)] hover:text-[rgb(var(--fg-rgb))] transition-colors"
          style={{ fontSize: "11px", letterSpacing: "0.15em" }}
        >
          ← Work
        </Link>
        {right}
      </div>
      {children}
    </div>
  );
}
