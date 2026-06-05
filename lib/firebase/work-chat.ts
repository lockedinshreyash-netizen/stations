"use client";

import {
  ref,
  push,
  set,
  remove,
  query,
  limitToLast,
  onChildAdded,
  onValue,
  serverTimestamp,
  onDisconnect,
  type DataSnapshot,
} from "firebase/database";
import { db, isFirebaseConfigured } from "./config";

/* ------------------------------------------------------------------ */
/* Work-session chat — mirrors the Network room chat, but keyed by the */
/* Supabase work_sessions.id under /work_sessions/{sessionId}.         */
/*                                                                     */
/*   /work_sessions/{sessionId}/messages/{messageId}                   */
/*   /work_sessions/{sessionId}/members/{userId}                       */
/*   /work_sessions/{sessionId}/presence/{userId}  (online-now)        */
/* ------------------------------------------------------------------ */

export interface WorkChatMessage {
  id: string;
  user_id: string;
  username: string;
  avatar_url: string | null;
  // Denormalized so the Founding Cohort marker renders in chat without a
  // per-message user lookup. Null/absent for non-founders and system rows.
  founder_number?: number | null;
  content: string;
  /** true for "X left early: …" system notices, rendered muted/italic. */
  system?: boolean;
  created_at: number; // ms epoch (resolved server timestamp)
}

export const MESSAGE_LIMIT = 100;
export const MAX_MESSAGE_LENGTH = 500;

function messagesRef(sessionId: string) {
  return ref(db, `work_sessions/${sessionId}/messages`);
}
function presenceRef(sessionId: string) {
  return ref(db, `work_sessions/${sessionId}/presence`);
}

function snapshotToMessage(snap: DataSnapshot): WorkChatMessage | null {
  const v = snap.val();
  if (!v) return null;
  return {
    id: snap.key as string,
    user_id: v.user_id,
    username: v.username,
    avatar_url: v.avatar_url ?? null,
    founder_number: typeof v.founder_number === "number" ? v.founder_number : null,
    content: v.content ?? "",
    system: v.system === true,
    created_at: typeof v.created_at === "number" ? v.created_at : Date.now(),
  };
}

/**
 * Subscribes to the last MESSAGE_LIMIT messages and each subsequent one.
 * Returns an unsubscribe fn. Caller de-dupes by id.
 */
export function subscribeSessionMessages(
  sessionId: string,
  onMessage: (message: WorkChatMessage) => void
): () => void {
  if (!isFirebaseConfigured) return () => {};
  const q = query(messagesRef(sessionId), limitToLast(MESSAGE_LIMIT));
  return onChildAdded(q, (snap) => {
    const msg = snapshotToMessage(snap);
    if (msg) onMessage(msg);
  });
}

export async function sendSessionMessage(
  sessionId: string,
  message: Omit<WorkChatMessage, "id" | "created_at">
): Promise<void> {
  if (!isFirebaseConfigured) throw new Error("Chat is not configured.");
  const newRef = push(messagesRef(sessionId));
  await set(newRef, {
    user_id: message.user_id,
    username: message.username,
    avatar_url: message.avatar_url ?? null,
    founder_number: message.founder_number ?? null,
    content: message.content,
    system: message.system === true,
    created_at: serverTimestamp(),
  });
}

/** Posts a system notice (e.g. "alice left early: …") to the chat. */
export async function postSystemMessage(
  sessionId: string,
  content: string
): Promise<void> {
  if (!isFirebaseConfigured) return;
  const newRef = push(messagesRef(sessionId));
  await set(newRef, {
    user_id: "system",
    username: "system",
    avatar_url: null,
    content,
    system: true,
    created_at: serverTimestamp(),
  });
}

/** Subscribes to the live online count. Returns unsubscribe. */
export function subscribeSessionOnlineCount(
  sessionId: string,
  onCount: (count: number) => void
): () => void {
  if (!isFirebaseConfigured) return () => {};
  return onValue(presenceRef(sessionId), (snap) => onCount(snap.size));
}

/** Subscribes to the set of online user ids. Returns unsubscribe. */
export function subscribeSessionOnlineIds(
  sessionId: string,
  onIds: (ids: Set<string>) => void
): () => void {
  if (!isFirebaseConfigured) return () => {};
  return onValue(presenceRef(sessionId), (snap) => {
    const ids = new Set<string>();
    snap.forEach((child) => {
      ids.add(child.key as string);
    });
    onIds(ids);
  });
}

export async function addSessionMember(
  sessionId: string,
  userId: string
): Promise<void> {
  if (!isFirebaseConfigured) return;
  await set(ref(db, `work_sessions/${sessionId}/members/${userId}`), true);
}

/**
 * Marks the user online in a session and auto-clears on disconnect/unmount.
 * Returns a cleanup fn that removes presence immediately.
 */
export function markSessionPresent(
  sessionId: string,
  userId: string
): () => void {
  if (!isFirebaseConfigured) return () => {};
  const r = ref(db, `work_sessions/${sessionId}/presence/${userId}`);
  set(r, true);
  onDisconnect(r).remove();
  return () => {
    remove(r);
  };
}
