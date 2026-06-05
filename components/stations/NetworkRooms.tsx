"use client";

import { useState } from "react";
import RoomCard from "@/components/stations/RoomCard";
import ExploreRoomCard from "@/components/stations/ExploreRoomCard";
import { isFirebaseConfigured } from "@/lib/firebase/config";
import { ROOM_NAMES, categoryRoom, COLLECTIVE, type RoomName } from "@/lib/firebase/rooms";
import type { User } from "@/types";

export default function NetworkRooms({ user }: { user: User }) {
  const [memberships, setMemberships] = useState<string[]>(user.room_memberships ?? []);

  const homeRoom = categoryRoom(user.category);

  // A room belongs to MY STATIONS if it's the collective, the user's category
  // room, or anything in their memberships array.
  const isMine = (room: RoomName) =>
    room === COLLECTIVE || room === homeRoom || memberships.includes(room);

  const myRooms = ROOM_NAMES.filter(isMine);
  // The Founding Cohort room is private: it only ever appears under "My
  // Stations" for members who were added on code redemption. Non-members must
  // never see it offered in Explore.
  const exploreRooms = ROOM_NAMES.filter((r) => r !== "founding" && !isMine(r));

  return (
    <div className="px-5 md:px-10 py-12 flex flex-col gap-16">
      {!isFirebaseConfigured && (
        <div
          className="st-card p-4 font-poppins"
          style={{
            fontSize: "12px",
            border: "0.5px solid var(--accent)",
            color: "var(--accent)",
          }}
        >
          Realtime chat isn&apos;t configured yet. Add your Firebase keys to{" "}
          <code>.env.local</code> to enable live rooms.
        </div>
      )}

      {/* SECTION 1 — MY STATIONS */}
      <section>
        <SectionLabel>My Stations</SectionLabel>
        {myRooms.length === 0 ? (
          <p
            className="font-playfair italic text-[rgba(var(--fg-rgb),0.3)]"
            style={{ fontSize: "14px" }}
          >
            You&apos;re in Collective. Explore other stations.
          </p>
        ) : (
          <div className="grid gap-4" style={{ gridTemplateColumns: "repeat(auto-fill,minmax(240px,1fr))" }}>
            {myRooms.map((room) => (
              <RoomCard key={room} roomName={room} />
            ))}
          </div>
        )}
      </section>

      {/* SECTION 2 — EXPLORE STATIONS */}
      {exploreRooms.length > 0 && (
        <section>
          <SectionLabel>Explore Stations</SectionLabel>
          <div className="grid gap-4" style={{ gridTemplateColumns: "repeat(auto-fill,minmax(240px,1fr))" }}>
            {exploreRooms.map((room) => (
              <ExploreRoomCard
                key={room}
                roomName={room}
                userId={user.id}
                memberships={memberships}
                onJoined={setMemberships}
              />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <h2
      className="font-poppins font-black uppercase text-[rgb(var(--fg-rgb))] mb-6"
      style={{ fontSize: "13px", letterSpacing: "0.25em" }}
    >
      {children}
    </h2>
  );
}
