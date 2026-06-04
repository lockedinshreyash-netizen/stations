"use client";

import { useState, useEffect } from "react";
import {
  subscribeMessages,
  isRecent,
  categoryRoom,
  COLLECTIVE,
  isRoomName,
  type RoomName,
} from "@/lib/firebase/rooms";
import type { User } from "@/types";

const SEEN_PREFIX = "room_lastseen_";

function getLastSeen(room: string): number {
  try {
    return Number(localStorage.getItem(SEEN_PREFIX + room)) || 0;
  } catch {
    return 0;
  }
}

/**
 * True when ANY room the user belongs to (collective + their category room +
 * joined rooms) has a message newer than the last time that room was opened.
 *
 * Clearing is implicit: opening a room marks it seen and unmounts the nav
 * (room views are immersive), so the next mount recomputes from localStorage.
 */
export function useNetworkUnread(user: User): boolean {
  const [hasUnread, setHasUnread] = useState(false);

  const membershipsKey = (user.room_memberships ?? []).join(",");

  useEffect(() => {
    const rooms = new Set<RoomName>([COLLECTIVE]);
    const cat = categoryRoom(user.category);
    if (cat) rooms.add(cat);
    for (const r of user.room_memberships ?? []) {
      if (isRoomName(r)) rooms.add(r as RoomName);
    }

    const lastSeen: Record<string, number> = {};
    rooms.forEach((r) => {
      lastSeen[r] = getLastSeen(r);
    });

    const counted = new Set<string>();
    const unsubs = Array.from(rooms).map((room) =>
      subscribeMessages(room, (msg) => {
        if (counted.has(msg.id)) return;
        counted.add(msg.id);
        if (msg.user_id === user.id) return; // ignore own messages
        if (!isRecent(msg)) return;
        if (msg.created_at > lastSeen[room]) setHasUnread(true);
      })
    );

    return () => {
      unsubs.forEach((u) => u());
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user.id, user.category, membershipsKey]);

  return hasUnread;
}
