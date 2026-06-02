"use client";

import { createClient } from "@/lib/supabase/client";
import {
  addSessionMember,
  postSystemMessage,
} from "@/lib/firebase/work-chat";
import type {
  WorkCategory,
  WorkSession,
  WorkSessionMember,
  WorkSessionStatus,
  WorkSessionWithMeta,
} from "@/types";

/* ------------------------------------------------------------------ */
/* Reads                                                               */
/* ------------------------------------------------------------------ */

/** Raw shape returned by the joined select below. */
type SessionRow = WorkSession & {
  host: { username: string; avatar_url: string | null } | null;
  members: { count: number }[] | null;
};

function toMeta(row: SessionRow): WorkSessionWithMeta {
  const { host, members, ...session } = row;
  return {
    ...(session as WorkSession),
    member_count: members?.[0]?.count ?? 0,
    host_username: host?.username ?? "unknown",
    host_avatar_url: host?.avatar_url ?? null,
  };
}

const SESSION_SELECT =
  "*, host:users!work_sessions_host_id_fkey(username, avatar_url), members:work_session_members(count)";

/**
 * Active + scheduled sessions for the feed. Active first, then scheduled
 * sorted by start time ascending. Cancelled/completed are excluded.
 */
export async function getActiveAndScheduledSessions(): Promise<
  WorkSessionWithMeta[]
> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("work_sessions")
    .select(SESSION_SELECT)
    .in("status", ["active", "scheduled"])
    .order("scheduled_start_time", { ascending: true });

  if (error) throw new Error(error.message);
  return ((data as SessionRow[]) ?? []).map(toMeta);
}

export async function getSessionById(
  sessionId: string
): Promise<WorkSessionWithMeta | null> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("work_sessions")
    .select(SESSION_SELECT)
    .eq("id", sessionId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  return data ? toMeta(data as SessionRow) : null;
}

/** All member rows for a session, host implicitly first via joined_at. */
export async function getSessionMembers(
  sessionId: string
): Promise<(WorkSessionMember & { username: string; avatar_url: string | null })[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("work_session_members")
    .select(
      "*, user:users!work_session_members_user_id_fkey(username, avatar_url)"
    )
    .eq("session_id", sessionId)
    .order("joined_at", { ascending: true });

  if (error) throw new Error(error.message);
  return (
    (data as (WorkSessionMember & {
      user: { username: string; avatar_url: string | null } | null;
    })[]) ?? []
  ).map((m) => ({
    ...m,
    username: m.user?.username ?? "unknown",
    avatar_url: m.user?.avatar_url ?? null,
  }));
}

/** The caller's own membership row, if any. */
export async function getOwnMembership(
  sessionId: string,
  userId: string
): Promise<WorkSessionMember | null> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("work_session_members")
    .select("*")
    .eq("session_id", sessionId)
    .eq("user_id", userId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  return (data as WorkSessionMember) ?? null;
}

/* ------------------------------------------------------------------ */
/* Writes                                                              */
/* ------------------------------------------------------------------ */

export interface CreateSessionInput {
  hostId: string;
  title: string;
  category: WorkCategory;
  durationMinutes: number;
  /** When true: starts immediately (status='active', start = now). */
  startNow: boolean;
  /** Required when startNow is false — ISO string of scheduled start. */
  scheduledStartTime?: string;
}

export async function createSession(
  input: CreateSessionInput
): Promise<WorkSession> {
  const supabase = createClient();

  const start = input.startNow
    ? new Date()
    : new Date(input.scheduledStartTime ?? "");
  if (Number.isNaN(start.getTime())) {
    throw new Error("Invalid start time.");
  }
  const end = new Date(start.getTime() + input.durationMinutes * 60_000);

  const row = {
    host_id: input.hostId,
    title: input.title.trim().slice(0, 100),
    category: input.category,
    duration_minutes: input.durationMinutes,
    scheduled_start_time: start.toISOString(),
    scheduled_end_time: end.toISOString(),
    status: (input.startNow ? "active" : "scheduled") as WorkSessionStatus,
    actual_start_time: input.startNow ? start.toISOString() : null,
    // Chat is open by default; the host can lock it from within the room.
    chat_closed: false,
  };

  const { data, error } = await supabase
    .from("work_sessions")
    .insert(row)
    .select("*")
    .single();

  if (error) throw new Error(error.message);

  // Host auto-joins their own session.
  await joinSession(data.id, input.hostId).catch(() => {});

  return data as WorkSession;
}

/**
 * Joins a session. Sessions lock once they leave the 'scheduled' state, so
 * this refuses to join active/completed/cancelled sessions (host already
 * joined at creation). Idempotent on the unique (session_id, user_id).
 */
export async function joinSession(
  sessionId: string,
  userId: string
): Promise<void> {
  const supabase = createClient();

  const { error } = await supabase
    .from("work_session_members")
    .upsert(
      { session_id: sessionId, user_id: userId },
      { onConflict: "session_id,user_id", ignoreDuplicates: true }
    );

  if (error) throw new Error(error.message);

  // Best-effort Firebase membership mirror.
  await addSessionMember(sessionId, userId).catch(() => {});
}

/**
 * Host-only: toggle chat read-only state for everyone. Pass true to lock
 * (read-only), false to unlock. Propagates to all clients via the realtime
 * work_sessions subscription.
 */
export async function updateSessionChatStatus(
  sessionId: string,
  chatClosed: boolean
): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase
    .from("work_sessions")
    .update({ chat_closed: chatClosed })
    .eq("id", sessionId);
  if (error) throw new Error(error.message);
}

/** Host-only: cancel the session for everyone. */
export async function cancelSession(sessionId: string): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase
    .from("work_sessions")
    .update({ status: "cancelled" })
    .eq("id", sessionId);
  if (error) throw new Error(error.message);
}

/**
 * Transitions a session's status (client-driven, since there is no backend
 * job): scheduled→active when start is reached, active→completed when end is
 * reached. Stamps actual_start_time / actual_end_time accordingly.
 */
export async function updateSessionStatus(
  sessionId: string,
  status: WorkSessionStatus
): Promise<void> {
  const supabase = createClient();
  const patch: Record<string, unknown> = { status };
  const now = new Date().toISOString();
  if (status === "active") patch.actual_start_time = now;
  if (status === "completed") patch.actual_end_time = now;

  const { error } = await supabase
    .from("work_sessions")
    .update(patch)
    .eq("id", sessionId);
  if (error) throw new Error(error.message);
}

export async function leaveEarlySession(
  sessionId: string,
  userId: string,
  username: string,
  reason: string
): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase
    .from("work_session_members")
    .update({
      left_early: true,
      leave_reason: reason.trim(),
      left_at: new Date().toISOString(),
    })
    .eq("session_id", sessionId)
    .eq("user_id", userId);
  if (error) throw new Error(error.message);

  // Post the reason to the session chat (best-effort).
  await postSystemMessage(sessionId, `${username} left early: ${reason.trim()}`).catch(
    () => {}
  );
}

export interface FocusRecap {
  duration_minutes: number;
  others_count: number;
  focus_quality_rating: number;
  focus_streak_days: number;
}

/**
 * Records the caller's focus rating and atomically updates their stats
 * (hours, sessions, streak) via the submit_focus_rating RPC. Returns the
 * recap for the UI.
 */
export async function submitFocusRating(
  sessionId: string,
  userId: string,
  rating: number
): Promise<FocusRecap> {
  const supabase = createClient();
  const { data, error } = await supabase
    .rpc("submit_focus_rating", {
      p_session_id: sessionId,
      p_user_id: userId,
      p_rating: rating,
    })
    .single();

  if (error) throw new Error(error.message);
  return data as FocusRecap;
}
