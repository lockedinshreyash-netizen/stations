import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createSubscription, type BillingPlan } from "@/lib/razorpay/server";

/**
 * Creates a Razorpay subscription for the authenticated user. Called
 * cross-origin from the marketing site with the user's access token, so the
 * route does its own auth check and returns CORS headers for that origin.
 */

const LANDING_ORIGINS = (process.env.LANDING_ORIGINS ?? "http://localhost:5173")
  .split(",")
  .map((o) => o.trim());

function corsHeaders(origin: string | null) {
  const allowed = origin && LANDING_ORIGINS.includes(origin) ? origin : LANDING_ORIGINS[0];
  return {
    "Access-Control-Allow-Origin": allowed,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Authorization, Content-Type",
  };
}

export async function OPTIONS(req: NextRequest) {
  return new NextResponse(null, { status: 204, headers: corsHeaders(req.headers.get("origin")) });
}

export async function POST(req: NextRequest) {
  const headers = corsHeaders(req.headers.get("origin"));

  // FOUNDING 100 PHASE: payments are disabled. Entry is by founder code only and
  // founders never pay, so no subscription may be created. Flip PAYMENTS_ENABLED
  // to "true" in the environment to re-open paid checkout after the founding
  // window. This fails closed: anything other than the exact string "true" keeps
  // payments off.
  if (process.env.PAYMENTS_ENABLED !== "true") {
    return NextResponse.json(
      { error: "Stations is invite-only right now. Payments are disabled during the Founding 100." },
      { status: 403, headers }
    );
  }

  const token = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!token) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401, headers });
  }

  const admin = createAdminClient();
  const {
    data: { user },
    error: authError,
  } = await admin.auth.getUser(token);
  if (authError || !user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401, headers });
  }

  const body = (await req.json().catch(() => null)) as { plan?: string } | null;
  const plan = body?.plan;
  if (plan !== "monthly" && plan !== "annual") {
    return NextResponse.json({ error: "Invalid plan" }, { status: 400, headers });
  }

  try {
    const { subscriptionId, keyId } = await createSubscription(plan as BillingPlan, user.id);
    return NextResponse.json({ subscriptionId, keyId }, { headers });
  } catch (e) {
    console.error("[billing] subscribe failed:", e);
    return NextResponse.json({ error: "Could not start checkout" }, { status: 502, headers });
  }
}
