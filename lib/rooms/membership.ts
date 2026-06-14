"use client";

import { createClient } from "@/lib/supabase/client";
import { addMember, removeMember, type RoomName } from "@/lib/firebase/rooms";

/**
 * Keeps Supabase `users.room_memberships` (source of truth) in sync with the
 * Firebase `/members` list. Returns the new memberships array on success.
 */
export async function joinRoom(
  userId: string,
  current: string[],
  roomName: RoomName
): Promise<string[]> {
  if (current.includes(roomName)) return current;
  const next = [...current, roomName];

  const supabase = createClient();
  const { error } = await supabase
    .from("users")
    .update({ room_memberships: next })
    .eq("id", userId);
  if (error) throw new Error(error.message);

  // Firebase membership is best-effort; the Supabase array is authoritative.
  await addMember(roomName, userId).catch(() => {});
  return next;
}

/**
 * Accurate member count for a room, counted from Supabase `room_memberships`
 * (the source of truth). The Firebase `/members` node is only a partial mirror
 * — auto-assigned rooms (collective + a member's category room) are written to
 * the Supabase array at signup and never to Firebase, so counting that mirror
 * reports 0. RLS limits the count to members the caller may see, which is the
 * same set the Network directory exposes.
 */
export async function getRoomMemberCount(roomName: RoomName): Promise<number> {
  const supabase = createClient();
  const { count, error } = await supabase
    .from("users")
    .select("id", { count: "exact", head: true })
    .contains("room_memberships", [roomName]);
  if (error) return 0;
  return count ?? 0;
}

export async function leaveRoom(
  userId: string,
  current: string[],
  roomName: RoomName
): Promise<string[]> {
  const next = current.filter((r) => r !== roomName);

  const supabase = createClient();
  const { error } = await supabase
    .from("users")
    .update({ room_memberships: next })
    .eq("id", userId);
  if (error) throw new Error(error.message);

  await removeMember(roomName, userId).catch(() => {});
  return next;
}
