"use client";

import Link from "next/link";
import { ROOM_META, type RoomName } from "@/lib/firebase/rooms";
import { useRoomStats } from "@/lib/rooms/useRoomStats";

/** Card for the MY STATIONS section — click anywhere to open the room. */
export default function RoomCard({ roomName }: { roomName: RoomName }) {
  const meta = ROOM_META[roomName];
  const { memberCount, onlineCount, unread } = useRoomStats(roomName);

  return (
    <Link
      href={`/network/rooms/${roomName}`}
      className="st-card st-card-hover group relative block p-5 overflow-hidden hover:bg-[rgba(var(--fg-rgb),0.03)]"
      style={{
        background: "var(--bg-surface)",
        border: "0.5px solid rgba(var(--fg-rgb),0.1)",
      }}
    >
      {unread > 0 && (
        <span
          className="absolute top-4 right-4 flex items-center justify-center font-poppins font-bold rounded-full"
          style={{
            minWidth: "18px",
            height: "18px",
            padding: "0 5px",
            fontSize: "10px",
            background: "var(--accent)",
            color: "var(--bg-primary)",
          }}
        >
          {unread > 99 ? "99+" : unread}
        </span>
      )}

      <h3
        className="font-poppins font-black uppercase text-[rgb(var(--fg-rgb))]"
        style={{ fontSize: "14px", letterSpacing: "0.02em" }}
      >
        {meta.title}
      </h3>

      <div className="mt-3 flex items-center gap-3">
        <span
          className="font-poppins text-[rgba(var(--fg-rgb),0.35)]"
          style={{ fontSize: "11px" }}
        >
          {memberCount} {memberCount === 1 ? "member" : "members"}
        </span>
        <span className="font-poppins" style={{ fontSize: "11px", color: "var(--accent)" }}>
          {onlineCount} online now
        </span>
      </div>
    </Link>
  );
}
