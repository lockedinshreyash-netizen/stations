import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import ChatRoom from "@/components/stations/ChatRoom";
import { isRoomName, type RoomName } from "@/lib/firebase/rooms.server";
import { createClient } from "@/lib/supabase/server";
import type { User } from "@/types";

export default async function RoomPage({
  params,
}: {
  params: Promise<{ roomName: string }>;
}) {
  const { roomName } = await params;
  if (!isRoomName(roomName)) notFound();

  const supabase = await createClient();
  const {
    data: { user: authUser },
  } = await supabase.auth.getUser();
  if (!authUser) redirect("/login");

  const { data: profile } = await supabase
    .from("users")
    .select("*")
    .eq("id", authUser.id)
    .single();
  if (!profile) redirect("/onboarding/step-2");

  // The Founding Cohort room is private — block direct-URL access for anyone
  // who isn't a member (the room is added on founder-code redemption).
  if (
    roomName === "founding" &&
    !((profile as User).room_memberships ?? []).includes("founding")
  ) {
    notFound();
  }

  return (
    <div className="flex flex-col" style={{ height: "100dvh" }}>
      {/* Back bar */}
      <div
        className="st-glass shrink-0 px-6 py-4 sticky top-0 z-10"
        style={{ borderBottom: "0.5px solid var(--glass-border)" }}
      >
        <Link
          href="/network"
          className="font-poppins font-medium uppercase text-[rgba(var(--fg-rgb),0.4)] hover:text-[rgb(var(--fg-rgb))] transition-colors"
          style={{ fontSize: "11px", letterSpacing: "0.15em" }}
        >
          ← Network
        </Link>
      </div>

      <div className="flex-1 min-h-0">
        <ChatRoom key={roomName} roomName={roomName as RoomName} user={profile as User} />
      </div>
    </div>
  );
}
