// Server-safe room primitives. NO "use client" directive — this file contains
// only pure data + functions (no Firebase SDK), so it can be imported from
// Server Components (e.g. the [roomName] route) as well as client code.

export const ROOM_NAMES = [
  "scholar",
  "builder",
  "creator",
  "athlete",
  "collective",
  // Private — only Founding Cohort members are ever added (see
  // claim_founder_code). Never surfaced in "Explore Stations".
  "founding",
] as const;

export type RoomName = (typeof ROOM_NAMES)[number];

export const COLLECTIVE: RoomName = "collective";

export function isRoomName(value: string): value is RoomName {
  return (ROOM_NAMES as readonly string[]).includes(value);
}
