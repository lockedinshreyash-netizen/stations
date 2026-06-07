import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendPushToUsers, type PushPayload } from "@/lib/push/send";

/**
 * Trusted push entry point invoked by Supabase database triggers (pg_net).
 * Authenticated by a shared secret in the `x-push-secret` header — NOT by a
 * user session. Each event names a domain change by id; this handler resolves
 * the recipients and message with the service role and fans out the push.
 *
 * Keeping recipient resolution here (rather than in SQL) means the triggers
 * stay tiny and the notification copy lives with the rest of the app.
 */
export async function POST(request: Request) {
  const secret = request.headers.get("x-push-secret");
  if (!secret || secret !== process.env.PUSH_WEBHOOK_SECRET) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  let evt: { type?: string; [k: string]: unknown };
  try {
    evt = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid body" }, { status: 400 });
  }

  const supabase = createAdminClient();

  try {
    switch (evt.type) {
      case "dm": {
        // A direct message was inserted. Notify the recipient (the participant
        // who is NOT the sender).
        const { conversation_id, sender_id, content } = evt as {
          conversation_id: string;
          sender_id: string;
          content: string;
        };
        const { data: convo } = await supabase
          .from("conversations")
          .select("user_low, user_high")
          .eq("id", conversation_id)
          .maybeSingle();
        if (!convo) break;
        const recipient =
          convo.user_low === sender_id ? convo.user_high : convo.user_low;
        const { data: sender } = await supabase
          .from("users")
          .select("username")
          .eq("id", sender_id)
          .maybeSingle();
        const payload: PushPayload = {
          title: sender?.username ?? "New message",
          body: preview(content),
          url: `/messages/${conversation_id}`,
          tag: `dm-${conversation_id}`,
        };
        await sendPushToUsers([recipient], payload);
        break;
      }

      case "reaction": {
        // Someone reacted to a win. Notify the win's author (unless self).
        const { win_id, actor_id, emoji } = evt as {
          win_id: string;
          actor_id: string;
          emoji: string;
        };
        const { data: win } = await supabase
          .from("wins")
          .select("user_id, title")
          .eq("id", win_id)
          .maybeSingle();
        if (!win || win.user_id === actor_id) break;
        const { data: actor } = await supabase
          .from("users")
          .select("username")
          .eq("id", actor_id)
          .maybeSingle();
        const payload: PushPayload = {
          title: `${emoji} ${actor?.username ?? "Someone"} reacted`,
          body: win.title,
          url: `/wins/${win_id}`,
          tag: `reaction-${win_id}`,
        };
        await sendPushToUsers([win.user_id], payload);
        break;
      }

      case "session_start": {
        // A work session went live. Notify every active member of its category
        // (e.g. all Scholars when a scholar session starts), plus anyone who
        // already joined — excluding the host who started it.
        const { session_id } = evt as { session_id: string };
        const { data: session } = await supabase
          .from("work_sessions")
          .select("title, category, host_id")
          .eq("id", session_id)
          .maybeSingle();
        if (!session) break;

        // Category match: work_sessions.category is lowercase, users.category
        // is capitalized — compare case-insensitively.
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
          .eq("session_id", session_id);
        const joined = (members ?? []).map((m) => m.user_id);

        const recipients = [...byCategory, ...joined].filter(
          (id) => id !== session.host_id
        );
        const payload: PushPayload = {
          title: "A session is starting",
          body: session.title,
          url: `/work/${session_id}`,
          tag: `session-${session_id}`,
        };
        await sendPushToUsers(recipients, payload);
        break;
      }

      case "session_reminder": {
        // A scheduled session is approaching its start time (fired by the
        // pg_cron job). Remind the people who signed up — the host and everyone
        // who joined — not the whole category cohort.
        const { session_id } = evt as { session_id: string };
        const { data: session } = await supabase
          .from("work_sessions")
          .select("title, host_id, scheduled_start_time, status")
          .eq("id", session_id)
          .maybeSingle();
        // Skip if it already started/was cancelled between scheduling and now.
        if (!session || session.status !== "scheduled") break;

        const { data: members } = await supabase
          .from("work_session_members")
          .select("user_id")
          .eq("session_id", session_id);
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
          url: `/work/${session_id}`,
          tag: `session-${session_id}`,
        };
        await sendPushToUsers(recipients, payload);
        break;
      }

      default:
        return NextResponse.json({ error: "unknown event" }, { status: 400 });
    }
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "send failed" },
      { status: 500 }
    );
  }

  return NextResponse.json({ ok: true });
}

function preview(text: string): string {
  const t = (text ?? "").trim();
  return t.length > 120 ? `${t.slice(0, 117)}…` : t || "New message";
}
