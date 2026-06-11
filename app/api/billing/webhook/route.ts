import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Razorpay webhook — the only place membership_tier transitions paid/free.
 * Configure in the Razorpay dashboard with the Subscriptions event group
 * pointed at /api/billing/webhook, secret in RAZORPAY_WEBHOOK_SECRET.
 */

const ACTIVATE_EVENTS = new Set(["subscription.activated", "subscription.charged", "subscription.resumed"]);
const DEACTIVATE_EVENTS = new Set([
  "subscription.cancelled",
  "subscription.halted",
  "subscription.completed",
  "subscription.expired",
  "subscription.paused",
]);

export async function POST(req: NextRequest) {
  const secret = process.env.RAZORPAY_WEBHOOK_SECRET;
  if (!secret) {
    console.error("[billing] RAZORPAY_WEBHOOK_SECRET not set");
    return NextResponse.json({ error: "Not configured" }, { status: 500 });
  }

  const raw = await req.text();
  const signature = req.headers.get("x-razorpay-signature") ?? "";
  const expected = crypto.createHmac("sha256", secret).update(raw).digest("hex");
  const valid =
    signature.length === expected.length &&
    crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
  if (!valid) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  const event = JSON.parse(raw) as {
    event: string;
    payload?: { subscription?: { entity?: { id: string; notes?: { user_id?: string } } } };
  };

  const userId = event.payload?.subscription?.entity?.notes?.user_id;
  const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!userId || !UUID_RE.test(userId)) {
    // Return 200 so Razorpay doesn't retry events we can never process.
    return NextResponse.json({ ok: true, skipped: "no valid user_id in notes" });
  }

  const isActivate = ACTIVATE_EVENTS.has(event.event);
  const isDeactivate = DEACTIVATE_EVENTS.has(event.event);
  if (!isActivate && !isDeactivate) return NextResponse.json({ ok: true, skipped: event.event });

  const admin = createAdminClient();

  // Founding members keep their tier no matter what billing says.
  const { data: profile } = await admin
    .from("users")
    .select("membership_tier")
    .eq("id", userId)
    .single();
  if (profile?.membership_tier === "founding") return NextResponse.json({ ok: true });

  const tier = isActivate ? "paid" : "free";

  // Stamp auth metadata first — it survives even if the profile row doesn't
  // exist yet (user paid on the landing page before finishing onboarding;
  // step 4 reads this when creating the row).
  await admin.auth.admin.updateUserById(userId, {
    app_metadata: { membership_tier: tier },
  });

  const { error } = await admin
    .from("users")
    .update({ membership_tier: tier })
    .eq("id", userId);
  if (error) {
    console.error("[billing] tier update failed:", error.message);
    return NextResponse.json({ error: "Update failed" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
