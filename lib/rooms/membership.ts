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
