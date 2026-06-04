"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { createClient } from "@/lib/supabase/client";
import { getActiveAndScheduledSessions } from "@/lib/work/sessions";
import { isFirebaseConfigured } from "@/lib/firebase/config";
import SessionCard from "@/components/stations/SessionCard";
import CreateSessionModal from "@/components/stations/CreateSessionModal";
import type { User, WorkCategory, WorkSessionWithMeta } from "@/types";

/** Maps a user's (possibly capitalized) category to a Work category. */
function defaultWorkCategory(category: string): WorkCategory {
  const lower = category.toLowerCase();
  if (lower === "builder" || lower === "creator" || lower === "athlete") {
    return lower as WorkCategory;
  }
  return "scholar"; // Scholar + Grinder fall back to scholar
}

interface WorkStationProps {
  user: User;
  initialSessions: WorkSessionWithMeta[];
  initialMemberIds: string[];
}

export default function WorkStation({
  user,
  initialSessions,
  initialMemberIds,
}: WorkStationProps) {
  const [sessions, setSessions] = useState<WorkSessionWithMeta[]>(initialSessions);
  const [memberIds, setMemberIds] = useState<Set<string>>(
    () => new Set(initialMemberIds)
  );
  const [showCreate, setShowCreate] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refetch = useCallback(async () => {
    try {
      const [list, memberships] = await Promise.all([
        getActiveAndScheduledSessions(),
        fetchMyMemberships(user.id),
      ]);
      setSessions(list);
      setMemberIds(memberships);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load sessions.");
    }
  }, [user.id]);

  // Realtime: refetch whenever sessions or memberships change.
  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel("work_feed")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "work_sessions" },
        () => refetch()
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "work_session_members" },
        () => refetch()
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [refetch]);

  const active = useMemo(
    () => sessions.filter((s) => s.status === "active"),
    [sessions]
  );
  const scheduled = useMemo(
    () => sessions.filter((s) => s.status === "scheduled"),
    [sessions]
  );

  return (
    <div className="px-5 md:px-10 py-12 flex flex-col gap-12">
      {/* Stats + action bar */}
      <div className="flex flex-wrap items-end justify-between gap-6">
        <div className="flex gap-8">
          <Stat label="Focus Hours" value={user.total_focus_hours ?? 0} />
          <Stat label="Sessions" value={user.total_sessions_completed ?? 0} />
          <Stat label="Streak" value={`${user.focus_streak_days ?? 0}d`} />
        </div>
        <button
          type="button"
          onClick={() => setShowCreate(true)}
          className="st-btn font-poppins font-bold uppercase"
          style={{
            fontSize: "12px",
            letterSpacing: "0.12em",
            background: "var(--accent)",
            color: "var(--bg-primary)",
            padding: "14px 24px",
          }}
        >
          Start New Session
        </button>
      </div>

      {!isFirebaseConfigured && (
        <div
          className="st-card p-4 font-poppins"
          style={{ fontSize: "12px", border: "0.5px solid var(--accent)", color: "var(--accent)" }}
        >
          Realtime chat isn&apos;t configured yet. Add your Firebase keys to{" "}
          <code>.env.local</code> to enable session chat.
        </div>
      )}

      {error && (
        <p className="font-poppins" style={{ fontSize: "13px", color: "var(--accent)" }}>
          {error}
        </p>
      )}

      {/* ACTIVE */}
      <section>
        <SectionLabel>Active Sessions</SectionLabel>
        {active.length === 0 ? (
          <Empty>No active sessions right now.</Empty>
        ) : (
          <Grid>
            {active.map((s) => (
              <SessionCard
                key={s.id}
                session={s}
                userId={user.id}
                isMember={memberIds.has(s.id)}
                onJoined={refetch}
              />
            ))}
          </Grid>
        )}
      </section>

      {/* SCHEDULED */}
      <section>
        <SectionLabel>Scheduled Sessions</SectionLabel>
        {scheduled.length === 0 ? (
          <div className="flex flex-col gap-3">
            <Empty>No sessions scheduled.</Empty>
            <button
              type="button"
              onClick={() => setShowCreate(true)}
              className="st-btn self-start font-poppins font-bold uppercase"
              style={{
                fontSize: "11px",
                letterSpacing: "0.1em",
                border: "0.5px solid rgba(var(--fg-rgb),0.2)",
                color: "rgba(var(--fg-rgb),0.6)",
                padding: "10px 20px",
              }}
            >
              Start a work session
            </button>
          </div>
        ) : (
          <Grid>
            {scheduled.map((s) => (
              <SessionCard
                key={s.id}
                session={s}
                userId={user.id}
                isMember={memberIds.has(s.id)}
                onJoined={refetch}
              />
            ))}
          </Grid>
        )}
      </section>

      {showCreate && (
        <CreateSessionModal
          hostId={user.id}
          defaultCategory={defaultWorkCategory(user.category)}
          onClose={() => setShowCreate(false)}
          onCreated={() => {
            setShowCreate(false);
            refetch();
          }}
        />
      )}
    </div>
  );
}

async function fetchMyMemberships(userId: string): Promise<Set<string>> {
  const supabase = createClient();
  const { data } = await supabase
    .from("work_session_members")
    .select("session_id")
    .eq("user_id", userId);
  return new Set((data ?? []).map((r) => r.session_id as string));
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <h2
      className="font-poppins font-black uppercase text-[rgb(var(--fg-rgb))] mb-6"
      style={{ fontSize: "13px", letterSpacing: "0.25em" }}
    >
      {children}
    </h2>
  );
}

function Grid({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="grid gap-4"
      style={{ gridTemplateColumns: "repeat(auto-fill,minmax(280px,1fr))" }}
    >
      {children}
    </div>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return (
    <p className="font-playfair italic text-[rgba(var(--fg-rgb),0.3)]" style={{ fontSize: "14px" }}>
      {children}
    </p>
  );
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="flex flex-col gap-1">
      <span
        className="font-poppins font-bold uppercase text-[rgba(var(--fg-rgb),0.3)]"
        style={{ fontSize: "10px", letterSpacing: "0.18em" }}
      >
        {label}
      </span>
      <span
        className="font-poppins font-black text-[rgb(var(--fg-rgb))] leading-none"
        style={{ fontSize: "28px" }}
      >
        {value}
      </span>
    </div>
  );
}
