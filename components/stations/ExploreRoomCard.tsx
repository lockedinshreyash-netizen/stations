"use client";

import { useState } from "react";
import Link from "next/link";
import { Users } from "lucide-react";
import { ROOM_META, type RoomName } from "@/lib/firebase/rooms";
import { ROOM_IDENTITY } from "@/lib/rooms/identity";
import { useRoomStats } from "@/lib/rooms/useRoomStats";
import { joinRoom } from "@/lib/rooms/membership";

interface ExploreRoomCardProps {
  roomName: RoomName;
  userId: string;
  memberships: string[];
  /** Called with the updated memberships array after a successful join. */
  onJoined: (memberships: string[]) => void;
}

/** Card for the EXPLORE STATIONS section — JOIN button + read-only link. */
export default function ExploreRoomCard({
  roomName,
  userId,
  memberships,
  onJoined,
}: ExploreRoomCardProps) {
  const meta = ROOM_META[roomName];
  const identity = ROOM_IDENTITY[roomName];
  const Icon = identity.Icon;
  const { memberCount, onlineCount } = useRoomStats(roomName, false);
  const [joining, setJoining] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleJoin() {
    if (joining) return;
    setJoining(true);
    setError(null);
    try {
      const next = await joinRoom(userId, memberships, roomName);
      onJoined(next); // parent moves the card to MY STATIONS
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to join.");
      setJoining(false);
    }
  }

  return (
    <div
      className="st-card st-card-hover group relative flex flex-col p-5 overflow-hidden"
      style={{
        background: "var(--bg-surface)",
        border: "0.5px solid rgba(var(--fg-rgb),0.1)",
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
          color: "rgba(var(--fg-rgb),0.04)",
        }}
      />

      {/* Glyph tile + platform code */}
      <div className="relative z-10 flex items-center gap-2.5 mb-4">
        <div
          className="flex items-center justify-center rounded-[10px]"
          style={{
            width: "36px",
            height: "36px",
            background: "rgba(var(--fg-rgb),0.05)",
            border: "0.5px solid rgba(var(--fg-rgb),0.1)",
            color: "rgba(var(--fg-rgb),0.6)",
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
          Platform {identity.code}
        </span>
      </div>

      <Link href={`/network/rooms/${roomName}`} className="relative z-10 block">
        <h3
          className="font-poppins font-black uppercase text-[rgb(var(--fg-rgb))] group-hover:text-[var(--accent-2)] transition-colors"
          style={{ fontSize: "17px", letterSpacing: "0.02em" }}
        >
          {meta.title}
        </h3>
      </Link>

      <p
        className="relative z-10 font-poppins font-light text-[rgba(var(--fg-rgb),0.45)] mt-2"
        style={{ fontSize: "14px", lineHeight: 1.5 }}
      >
        {meta.description}
      </p>

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

      {error && (
        <p className="relative z-10 font-poppins mt-2" style={{ fontSize: "13px", color: "var(--accent)" }}>
          {error}
        </p>
      )}

      <button
        type="button"
        onClick={handleJoin}
        disabled={joining}
        className="st-btn relative z-10 mt-4 w-full font-poppins font-bold uppercase disabled:opacity-50"
        style={{
          fontSize: "14px",
          letterSpacing: "0.1em",
          background: "var(--accent)",
          color: "var(--bg-primary)",
          padding: "10px 0",
        }}
      >
        {joining ? "Joining…" : "Join"}
      </button>
    </div>
  );
}
