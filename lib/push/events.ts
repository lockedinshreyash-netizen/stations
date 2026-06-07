import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendPushToUsers, type PushPayload } from "@/lib/push/send";

/**
 * Server-side push event resolvers. Each function takes the ids for a domain
 * event, resolves the recipients with the service role, and sends the push.
 * These are invoked by the API routes AFTER the route has authorized the
 * caller — they do no auth themselves.
 *
 * Crucially, none of this runs inside a database transaction or a user's write
 * path: a failure here can never roll back a reaction, message, or session.
 */

function preview(text: string): string {
  const t = (text ?? "").trim();
  return t.length > 120 ? `${t.slice(0, 117)}…` : t || "New message";
}

/** A direct message was sent — notify the other participant. */
export async function notifyDm(conversationId: string, senderId: string) {
  const supabase = createAdminClient();
  const { data: convo } = await supabase
    .from("conversations")
    .select("user_low, user_high")
    .eq("id", conversationId)
    .maybeSingle();
  if (!convo) return;
  const recipient =
    convo.user_low === senderId ? convo.user_high : convo.user_low;

  // Pull the latest message for an accurate preview (don't trust client text).
  const { data: last } = await supabase
    .from("direct_messages")
    .select("content, sender_id")
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!last || last.sender_id !== senderId) return;

  const { data: sender } = await supabase
    .from("users")
    .select("username")
    .eq("id", senderId)
    .maybeSingle();

  const payload: PushPayload = {
    title: sender?.username ?? "New message",
    body: preview(last.content),
    url: `/messages/${conversationId}`,
    tag: `dm-${conversationId}`,
  };
  await sendPushToUsers([recipient], payload);
}

/** A win got a new reaction — notify its author (never the actor). */
export async function notifyReaction(winId: string, actorId: string) {
  const supabase = createAdminClient();
  const { data: win } = await supabase
    .from("wins")
    .select("user_id, title")
    .eq("id", winId)
    .maybeSingle();
  if (!win || win.user_id === actorId) return;

  // Confirm the actor really has a reaction on this win, and read its emoji.
  const { data: reaction } = await supabase
    .from("win_reactions")
    .select("emoji")
    .eq("win_id", winId)
    .eq("user_id", actorId)
    .maybeSingle();
  if (!reaction) return;

  const { data: actor } = await supabase
    .from("users")
    .select("username")
    .eq("id", actorId)
    .maybeSingle();

  const payload: PushPayload = {
    title: `${reaction.emoji} ${actor?.username ?? "Someone"} reacted`,
    body: win.title,
    url: `/wins/${winId}`,
    tag: `reaction-${winId}`,
  };
  await sendPushToUsers([win.user_id], payload);
}

/**
 * A work session went live — notify the whole matching category cohort plus
 * anyone who already joined, excluding the host who started it.
 */
export async function notifySessionStart(sessionId: string) {
  const supabase = createAdminClient();
  const { data: session } = await supabase
    .from("work_sessions")
    .select("title, category, host_id, status")
    .eq("id", sessionId)
    .maybeSingle();
  if (!session || session.status !== "active") return;

  const { data: cohort } = await supabase
    .from("users")
    .select("id, category")
    .eq("status", "active");
  const byCategory = (cohort ?? [])
    .filter((u) => (u.category ?? "").toLowerCase() === session.category)
    .map((u) => u.id);

  const { data: members } = await supabase
    .from("work_session_members")
    .select("user_id")
    .eq("session_id", sessionId);
  const joined = (members ?? []).map((m) => m.user_id);

  const recipients = [...byCategory, ...joined].filter(
    (id) => id !== session.host_id
  );
  const payload: PushPayload = {
    title: "A session is starting",
    body: session.title,
    url: `/work/${sessionId}`,
    tag: `session-${sessionId}`,
  };
  await sendPushToUsers(recipients, payload);
}

/** Timed reminder (cron) — notify the host + joined members ahead of start. */
export async function notifySessionReminder(sessionId: string) {
  const supabase = createAdminClient();
  const { data: session } = await supabase
    .from("work_sessions")
    .select("title, host_id, scheduled_start_time, status")
    .eq("id", sessionId)
    .maybeSingle();
  if (!session || session.status !== "scheduled") return;

  const { data: members } = await supabase
    .from("work_session_members")
    .select("user_id")
    .eq("session_id", sessionId);
  const recipients = [
    session.host_id,
    ...(members ?? []).map((m) => m.user_id),
  ];

  const mins = Math.max(
    1,
    Math.round(
      (new Date(session.scheduled_start_time).getTime() - Date.now()) / 60000
    )
  );
  const payload: PushPayload = {
    title: `Starting in ${mins} min`,
    body: session.title,
    url: `/work/${sessionId}`,
    tag: `session-${sessionId}`,
  };
  await sendPushToUsers(recipients, payload);
}

/** @mentions in a Network room — notify each mentioned active member. */
export async function notifyMention(
  room: string,
  usernames: string[],
  senderId: string
) {
  const supabase = createAdminClient();
  const cleaned = [...new Set(usernames.map((u) => u.toLowerCase()))]
    .filter(Boolean)
    .slice(0, 10);
  if (cleaned.length === 0) return;

  const { data: sender } = await supabase
    .from("users")
    .select("username")
    .eq("id", senderId)
    .maybeSingle();
  const { data: targets } = await supabase
    .from("users")
    .select("id, username")
    .in("username", cleaned)
    .eq("status", "active");

  const recipients = (targets ?? [])
    .filter((t) => t.id !== senderId)
    .map((t) => t.id);
  if (recipients.length === 0) return;

  const payload: PushPayload = {
    title: `${sender?.username ?? "Someone"} mentioned you in #${room}`,
    body: "Tap to open the room",
    url: `/network/rooms/${room}`,
    tag: `room-${room}`,
  };
  await sendPushToUsers(recipients, payload);
}

/** A diagnostic push the caller sends to their own devices. */
export async function notifyTest(userId: string) {
  const payload: PushPayload = {
    title: "Stations notifications are on ✅",
    body: "You'll be pinged for DMs, reactions, sessions, and mentions.",
    url: "/home",
    tag: "test",
  };
  await sendPushToUsers([userId], payload);
}
