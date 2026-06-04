"use client";

import { useState } from "react";
import Link from "next/link";
import { ROOM_META, type RoomName } from "@/lib/firebase/rooms";
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
      className="st-card st-card-hover flex flex-col p-5 overflow-hidden"
      style={{
        background: "var(--bg-surface)",
        border: "0.5px solid rgba(var(--fg-rgb),0.1)",
      }}
    >
      <Link href={`/network/rooms/${roomName}`} className="block group">
        <h3
          className="font-poppins font-black uppercase text-[rgb(var(--fg-rgb))] group-hover:text-[var(--accent)] transition-colors"
          style={{ fontSize: "14px", letterSpacing: "0.02em" }}
        >
          {meta.title}
        </h3>
      </Link>

      <p
        className="font-poppins font-light text-[rgba(var(--fg-rgb),0.45)] mt-2"
        style={{ fontSize: "11px", lineHeight: 1.5 }}
      >
        {meta.description}
      </p>

      <div className="mt-3 flex items-center gap-3">
        <span
          className="font-poppins text-[rgba(var(--fg-rgb),0.35)]"
          style={{ fontSize: "11px" }}
        >
          {memberCount} {memberCount === 1 ? "member" : "members"}
        </span>
        <span className="font-poppins text-[rgba(var(--fg-rgb),0.35)]" style={{ fontSize: "11px" }}>
          {onlineCount} online now
        </span>
      </div>

      {error && (
        <p className="font-poppins mt-2" style={{ fontSize: "10px", color: "var(--accent)" }}>
          {error}
        </p>
      )}

      <button
        type="button"
        onClick={handleJoin}
        disabled={joining}
        className="st-btn mt-4 w-full font-poppins font-bold uppercase disabled:opacity-50"
        style={{
          fontSize: "11px",
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
