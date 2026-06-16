import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendPushToUsers } from "@/lib/push/send";

/**
 * Publish a global announcement. Admin-only: RLS already blocks non-admin
 * writes, and we re-check is_admin here as defense in depth. Optionally
 * broadcasts the announcement as a Web Push to every subscribed member.
 */
export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  }

  const { data: profile } = await supabase
    .from("users")
    .select("is_admin")
    .eq("id", user.id)
    .maybeSingle();
  if (!profile?.is_admin) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  let payload: { title?: string; body?: string; url?: string; push?: boolean };
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid body" }, { status: 400 });
  }

  const title = payload.title?.trim();
  const body = payload.body?.trim();
  const url = payload.url?.trim() || null;
  if (!title || !body) {
    return NextResponse.json(
      { error: "title and body are required" },
      { status: 400 }
    );
  }

  const { data: row, error } = await supabase
    .from("announcements")
    .insert({ title, body, url, created_by: user.id })
    .select("id")
    .single();
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Optional broadcast push — best-effort; the announcement is saved regardless.
  let push = { sent: 0, pruned: 0 };
  if (payload.push) {
    try {
      const admin = createAdminClient();
      const { data: subs } = await admin
        .from("push_subscriptions")
        .select("user_id");
      const userIds = [...new Set((subs ?? []).map((s) => s.user_id as string))];
      if (userIds.length > 0) {
        push = await sendPushToUsers(userIds, {
          title,
          body,
          url: url || "/home",
          tag: "announcement",
        });
      }
    } catch {
      /* swallow — push must never fail the publish */
    }
  }

  return NextResponse.json({ ok: true, id: row.id, push });
}
