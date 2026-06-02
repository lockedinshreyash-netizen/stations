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
import { ROOM_NAMES, COLLECTIVE, isRoomName, type RoomName } from "./rooms.server";
import type { UserCategory } from "@/types";

// Re-export the server-safe primitives so existing client imports from
// "@/lib/firebase/rooms" keep working unchanged.
export { ROOM_NAMES, COLLECTIVE, isRoomName, type RoomName };

/* ------------------------------------------------------------------ */
/* Room catalogue                                                      */
/* ------------------------------------------------------------------ */

export interface RoomMeta {
  name: RoomName;
  title: string; // "SCHOLAR ROOM"
  description: string;
}

export const ROOM_META: Record<RoomName, RoomMeta> = {
  scholar: {
    name: "scholar",
    title: "SCHOLAR ROOM",
    description: "Where students excel together. Academic wins, study tips, exam prep.",
  },
  builder: {
    name: "builder",
    title: "BUILDER ROOM",
    description: "Founders and developers building companies. Ship fast, move together.",
  },
  creator: {
    name: "creator",
    title: "CREATOR ROOM",
    description: "Creators leveling up. Audience growth, content strategy, collaborations.",
  },
  athlete: {
    name: "athlete",
    title: "ATHLETE ROOM",
    description: "Athletes pushing limits. Training logs, nutrition, competition prep.",
  },
  collective: {
    name: "collective",
    title: "COLLECTIVE ROOM",
    description: "All ambitious people. Cross-category collaboration and connection.",
  },
};

/** Maps a user's capitalized category to its room name, if one exists. */
export function categoryRoom(category: UserCategory): RoomName | null {
  const lower = category.toLowerCase();
  return isRoomName(lower) && lower !== COLLECTIVE ? (lower as RoomName) : null;
}

/**
 * Can this user POST in the given room?
 * - Collective: everyone.
 * - Category room matching their category: yes.
 * - Any room present in their room_memberships array: yes.
 */
export function canPost(
  category: UserCategory,
  roomMemberships: string[],
  roomName: RoomName
): boolean {
  if (roomName === COLLECTIVE) return true;
  if (category.toLowerCase() === roomName) return true;
  return roomMemberships.includes(roomName);
}

/* ------------------------------------------------------------------ */
/* Messages                                                            */
/* ------------------------------------------------------------------ */

export interface ChatMessage {
  id: string;
  user_id: string;
  username: string;
  avatar_url: string | null;
  category: string | null;
  content: string;
  created_at: number; // ms epoch (resolved server timestamp)
}

export const MESSAGE_LIMIT = 100;
export const MAX_MESSAGE_LENGTH = 500;
const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

function messagesRef(roomName: RoomName) {
  return ref(db, `chat_rooms/${roomName}/messages`);
}

function snapshotToMessage(snap: DataSnapshot): ChatMessage | null {
  const v = snap.val();
  if (!v) return null;
  return {
    id: snap.key as string,
    user_id: v.user_id,
    username: v.username,
    avatar_url: v.avatar_url ?? null,
    category: v.category ?? null,
    content: v.content ?? "",
    // serverTimestamp resolves to a number once written; pending writes can be
    // null briefly — treat those as "now" so optimistic ordering holds.
    created_at: typeof v.created_at === "number" ? v.created_at : Date.now(),
  };
}

/** True if the message is within the 7-day retention window. */
export function isRecent(message: ChatMessage): boolean {
  return message.created_at > Date.now() - SEVEN_DAYS_MS;
}

/**
 * Subscribes to the last MESSAGE_LIMIT messages and every subsequent new one.
 * Calls onMessage for each message (initial batch + live). Returns an
 * unsubscribe function. Caller is responsible for de-duping by id and
 * filtering with isRecent().
 */
export function subscribeMessages(
  roomName: RoomName,
  onMessage: (message: ChatMessage) => void
): () => void {
  if (!isFirebaseConfigured) return () => {};
  const q = query(messagesRef(roomName), limitToLast(MESSAGE_LIMIT));
  return onChildAdded(q, (snap) => {
    const msg = snapshotToMessage(snap);
    if (msg) onMessage(msg);
  });
}

export async function sendMessage(
  roomName: RoomName,
  message: Omit<ChatMessage, "id" | "created_at">
): Promise<void> {
  if (!isFirebaseConfigured) throw new Error("Chat is not configured.");
  const newRef = push(messagesRef(roomName));
  await set(newRef, {
    user_id: message.user_id,
    username: message.username,
    avatar_url: message.avatar_url ?? null,
    category: message.category ?? null,
    content: message.content,
    created_at: serverTimestamp(),
  });
}

/* ------------------------------------------------------------------ */
/* Members (persistent) + Presence (online now)                        */
/* ------------------------------------------------------------------ */

function membersRef(roomName: RoomName) {
  return ref(db, `chat_rooms/${roomName}/members`);
}

function presenceRef(roomName: RoomName) {
  return ref(db, `chat_rooms/${roomName}/presence`);
}

/** Subscribes to the total member count. Returns unsubscribe. */
export function subscribeMemberCount(
  roomName: RoomName,
  onCount: (count: number) => void
): () => void {
  if (!isFirebaseConfigured) return () => {};
  return onValue(membersRef(roomName), (snap) => onCount(snap.size));
}

/** Subscribes to the live online count. Returns unsubscribe. */
export function subscribeOnlineCount(
  roomName: RoomName,
  onCount: (count: number) => void
): () => void {
  if (!isFirebaseConfigured) return () => {};
  return onValue(presenceRef(roomName), (snap) => onCount(snap.size));
}

/** Persistent membership — kept in sync with Supabase room_memberships. */
export async function addMember(roomName: RoomName, userId: string): Promise<void> {
  if (!isFirebaseConfigured) return;
  await set(ref(db, `chat_rooms/${roomName}/members/${userId}`), true);
}

export async function removeMember(roomName: RoomName, userId: string): Promise<void> {
  if (!isFirebaseConfigured) return;
  await remove(ref(db, `chat_rooms/${roomName}/members/${userId}`));
}

/**
 * Marks the user online in a room and auto-clears on disconnect/unmount.
 * Returns a cleanup function that removes presence immediately.
 */
export function markPresent(roomName: RoomName, userId: string): () => void {
  if (!isFirebaseConfigured) return () => {};
  const r = ref(db, `chat_rooms/${roomName}/presence/${userId}`);
  set(r, true);
  onDisconnect(r).remove();
  return () => {
    remove(r);
  };
}
