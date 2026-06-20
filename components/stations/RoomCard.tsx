"use client";

import Link from "next/link";
import { Users } from "lucide-react";
import { ROOM_META, type RoomName } from "@/lib/firebase/rooms";
import { ROOM_IDENTITY } from "@/lib/rooms/identity";
import { useRoomStats } from "@/lib/rooms/useRoomStats";

/** Card for the MY STATIONS section — click anywhere to open the room. */
export default function RoomCard({ roomName }: { roomName: RoomName }) {
  const meta = ROOM_META[roomName];
  const identity = ROOM_IDENTITY[roomName];
  const Icon = identity.Icon;
  const { memberCount, onlineCount, unread } = useRoomStats(roomName);

  return (
    <Link
      href={`/network/rooms/${roomName}`}
      className="st-card st-card-hover group relative block p-5 overflow-hidden"
      style={{
        background: "var(--bg-surface)",
        border: identity.sealed
          ? "0.5px solid rgba(var(--accent-2-rgb),0.3)"
          : "0.5px solid rgba(var(--fg-rgb),0.1)",
      }}
    >
      {/* Faint supergraphic glyph bleeding off the bottom-right corner */}
      <Icon
        size={120}
        strokeWidth={1}
        aria-hidden
        className="pointer-events-none absolute select-none"
        style={{
          right: "-26px",
          bottom: "-26px",
          color: identity.sealed
            ? "rgba(var(--accent-2-rgb),0.1)"
            : "rgba(var(--fg-rgb),0.04)",
        }}
      />

      {unread > 0 && (
        <span
          className="absolute top-4 right-4 z-10 flex items-center justify-center font-poppins font-bold rounded-full"
          style={{
            minWidth: "18px",
            height: "18px",
            padding: "0 5px",
            fontSize: "13px",
            background: "var(--accent)",
            color: "var(--bg-primary)",
          }}
        >
          {unread > 99 ? "99+" : unread}
        </span>
      )}

      {/* Glyph tile + platform code */}
      <div className="relative z-10 flex items-center gap-2.5 mb-4">
        <div
          className="flex items-center justify-center rounded-[10px]"
          style={{
            width: "36px",
            height: "36px",
            background: identity.sealed
              ? "rgba(var(--accent-2-rgb),0.14)"
              : "rgba(var(--fg-rgb),0.05)",
            border: `0.5px solid ${
              identity.sealed
                ? "rgba(var(--accent-2-rgb),0.35)"
                : "rgba(var(--fg-rgb),0.1)"
            }`,
            color: identity.sealed ? "var(--accent-2)" : "rgba(var(--fg-rgb),0.6)",
          }}
        >
          <Icon size={18} strokeWidth={1.75} aria-hidden />
        </div>
        <span
          className="font-poppins font-bold uppercase"
          style={{
            fontSize: "10px",
            letterSpacing: "0.18em",
            color: "rgba(var(--accent-2-rgb),0.7)",
          }}
        >
          {identity.sealed ? "Sealed" : `Platform ${identity.code}`}
        </span>
      </div>

      <h3
        className="relative z-10 font-poppins font-black uppercase text-[rgb(var(--fg-rgb))] group-hover:text-[var(--accent-2)] transition-colors"
        style={{ fontSize: "17px", letterSpacing: "0.02em" }}
      >
        {meta.title}
      </h3>

      <div className="relative z-10 mt-3 flex items-center gap-3">
        <span
          className="flex items-center gap-1 font-poppins text-[rgba(var(--fg-rgb),0.35)]"
          style={{ fontSize: "13px" }}
        >
          <Users size={13} strokeWidth={2} aria-hidden />
          {memberCount}
        </span>
        <span className="flex items-center gap-1.5 font-poppins" style={{ fontSize: "13px" }}>
          {onlineCount > 0 && (
            <span className="st-live-dot" style={{ width: "6px", height: "6px" }} />
          )}
          <span
            style={{
              color: onlineCount > 0 ? "var(--accent-2)" : "rgba(var(--fg-rgb),0.3)",
            }}
          >
            {onlineCount} online
          </span>
        </span>
      </div>
    </Link>
  );
}
