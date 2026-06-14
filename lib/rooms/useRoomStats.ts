"use client";

import { useState, useEffect } from "react";
import {
  subscribeMessages,
  subscribeOnlineCount,
  isRecent,
  type RoomName,
} from "@/lib/firebase/rooms";
import { getRoomMemberCount } from "@/lib/rooms/membership";

const SEEN_PREFIX = "room_lastseen_";

/** Records that the user has just viewed a room — clears its unread count. */
export function markRoomSeen(roomName: RoomName) {
  try {
    localStorage.setItem(SEEN_PREFIX + roomName, String(Date.now()));
  } catch {
    /* ignore storage failures */
  }
}

function getLastSeen(roomName: RoomName): number {
  try {
    return Number(localStorage.getItem(SEEN_PREFIX + roomName)) || 0;
  } catch {
    return 0;
  }
}

export interface RoomStats {
  memberCount: number;
  onlineCount: number;
  unread: number;
}

/**
 * Live member/online counts plus an unread count (recent messages newer than
 * the last time this room was opened). Set `trackUnread` to false for cards in
 * EXPLORE STATIONS where unread is meaningless.
 */
export function useRoomStats(roomName: RoomName, trackUnread = true): RoomStats {
  const [memberCount, setMemberCount] = useState(0);
  const [onlineCount, setOnlineCount] = useState(0);
  const [unread, setUnread] = useState(0);

  useEffect(() => {
    // Member count comes from Supabase room_memberships (the source of truth),
    // not the partial Firebase /members mirror. Online + unread stay live from
    // Firebase. `cancelled` guards against a late resolve after roomName change.
    let cancelled = false;
    getRoomMemberCount(roomName).then((c) => {
      if (!cancelled) setMemberCount(c);
    });

    const unsubOnline = subscribeOnlineCount(roomName, setOnlineCount);

    let unsubMsg = () => {};
    if (trackUnread) {
      const lastSeen = getLastSeen(roomName);
      const counted = new Set<string>();
      unsubMsg = subscribeMessages(roomName, (msg) => {
        if (counted.has(msg.id)) return;
        counted.add(msg.id);
        if (isRecent(msg) && msg.created_at > lastSeen) {
          setUnread((n) => n + 1);
        }
      });
    }

    return () => {
      cancelled = true;
      unsubOnline();
      unsubMsg();
    };
  }, [roomName, trackUnread]);

  return { memberCount, onlineCount, unread };
}
