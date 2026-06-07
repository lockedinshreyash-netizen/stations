import { NextResponse } from "next/server";
import { notifySessionReminder } from "@/lib/push/events";

/**
 * Trusted entry point for the Supabase pg_cron job that sends timed session
 * reminders. Authenticated by a shared secret in `x-push-secret` (there is no
 * user session behind a background job). This is the ONLY push path that runs
 * outside the app — and it's a background job, so it can never affect a user's
 * write. Live events (dm/reaction/session_start/mention) go through the
 * session-authed /api/push/notify route instead.
 */
export async function POST(request: Request) {
  const secret = request.headers.get("x-push-secret");
  if (!secret || secret !== process.env.PUSH_WEBHOOK_SECRET) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  let evt: { type?: string; session_id?: string };
  try {
    evt = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid body" }, { status: 400 });
  }

  try {
    if (evt.type === "session_reminder" && evt.session_id) {
      await notifySessionReminder(evt.session_id);
    } else {
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
