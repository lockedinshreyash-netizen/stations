import "server-only";
import webpush from "web-push";
import { createAdminClient } from "@/lib/supabase/admin";

/** The shape we serialize into every push message; the SW reads this. */
export type PushPayload = {
  title: string;
  body: string;
  /** Relative URL to open when the notification is clicked. */
  url: string;
  /** Coalesces notifications of the same kind (e.g. one tag per conversation). */
  tag?: string;
};

let vapidConfigured = false;

function ensureVapid() {
  if (vapidConfigured) return;
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  const subject = process.env.VAPID_SUBJECT || "mailto:hello@lockinstations.space";
  if (!publicKey || !privateKey) {
    throw new Error("VAPID keys are not configured");
  }
  webpush.setVapidDetails(subject, publicKey, privateKey);
  vapidConfigured = true;
}

/**
 * Deliver a push to every subscription belonging to the given users. Dead
 * subscriptions (404/410) are pruned. Never throws for individual failures —
 * the caller (a fire-and-forget trigger) should not be blocked by one bad
 * endpoint.
 */
export async function sendPushToUsers(
  userIds: string[],
  payload: PushPayload
): Promise<{ sent: number; pruned: number }> {
  const targets = [...new Set(userIds)].filter(Boolean);
  if (targets.length === 0) return { sent: 0, pruned: 0 };

  ensureVapid();
  const supabase = createAdminClient();

  const { data: subs, error } = await supabase
    .from("push_subscriptions")
    .select("id, endpoint, p256dh, auth")
    .in("user_id", targets);
  if (error) throw new Error(error.message);
  if (!subs || subs.length === 0) return { sent: 0, pruned: 0 };

  const body = JSON.stringify(payload);
  const dead: string[] = [];
  let sent = 0;

  await Promise.all(
    subs.map(async (s) => {
      try {
        await webpush.sendNotification(
          { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
          body
        );
        sent += 1;
      } catch (err: unknown) {
        const status = (err as { statusCode?: number }).statusCode;
        if (status === 404 || status === 410) dead.push(s.id);
      }
    })
  );

  let pruned = 0;
  if (dead.length > 0) {
    const { error: delErr } = await supabase
      .from("push_subscriptions")
      .delete()
      .in("id", dead);
    if (!delErr) pruned = dead.length;
  }

  return { sent, pruned };
}
