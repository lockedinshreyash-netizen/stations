import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendPushToUsers, type PushPayload } from "@/lib/push/send";

const ROOM_RE = /^[a-z]+$/;

/**
 * Notify members @mentioned in a Network room message. Room chat lives in
 * Firebase (not Postgres), so there is no DB trigger to hang this off — the
 * sending client calls this after the message is delivered. Authed by the
 * Supabase session: the caller can only ever attribute a mention to themselves,
 * and we cap the fan-out to avoid abuse.
 */
export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  }

  let body: { room?: string; usernames?: string[]; content?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid body" }, { status: 400 });
  }

  const room = (body.room ?? "").toLowerCase();
  if (!ROOM_RE.test(room)) {
    return NextResponse.json({ error: "invalid room" }, { status: 400 });
  }
  const usernames = [...new Set((body.usernames ?? []).map((u) => u.toLowerCase()))]
    .filter(Boolean)
    .slice(0, 10);
  if (usernames.length === 0) return NextResponse.json({ ok: true });

  // Resolve usernames → ids with the service role (the caller may not be able
  // to read every active member under RLS, but mentions are public-by-design
  // within a room). Never notify the sender about their own mention.
  const admin = createAdminClient();
  const { data: me } = await admin
    .from("users")
    .select("username")
    .eq("id", user.id)
    .maybeSingle();

  const { data: targets } = await admin
    .from("users")
    .select("id, username")
    .in("username", usernames)
    .eq("status", "active");

  const recipients = (targets ?? [])
    .filter((t) => t.id !== user.id)
    .map((t) => t.id);
  if (recipients.length === 0) return NextResponse.json({ ok: true });

  const payload: PushPayload = {
    title: `${me?.username ?? "Someone"} mentioned you in #${room}`,
    body: preview(body.content ?? ""),
    url: `/network/rooms/${room}`,
    tag: `room-${room}`,
  };
  await sendPushToUsers(recipients, payload);

  return NextResponse.json({ ok: true });
}

function preview(text: string): string {
  const t = text.trim();
  return t.length > 120 ? `${t.slice(0, 117)}…` : t || "New mention";
}
