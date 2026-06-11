/**
 * Minimal Razorpay REST helpers for subscriptions. Server-only — uses the
 * key secret. We call the REST API directly rather than pulling in the SDK.
 *
 * Env:
 *   RAZORPAY_KEY_ID / RAZORPAY_KEY_SECRET — API key pair
 *   RAZORPAY_PLAN_MONTHLY / RAZORPAY_PLAN_ANNUAL — plan ids (optional; if
 *     unset, plans are created on first use and their ids logged so they can
 *     be pinned in env)
 */

const BASE = "https://api.razorpay.com/v1";

function authHeader() {
  const id = process.env.RAZORPAY_KEY_ID;
  const secret = process.env.RAZORPAY_KEY_SECRET;
  if (!id || !secret) throw new Error("Razorpay keys not configured");
  return `Basic ${Buffer.from(`${id}:${secret}`).toString("base64")}`;
}

async function rzp<T>(path: string, body?: unknown): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    method: body ? "POST" : "GET",
    headers: { Authorization: authHeader(), "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
  const json = await res.json();
  if (!res.ok) {
    throw new Error(json?.error?.description ?? `Razorpay ${path} failed (${res.status})`);
  }
  return json as T;
}

export type BillingPlan = "monthly" | "annual";

const PLAN_SPECS: Record<BillingPlan, { period: string; amount: number; name: string }> = {
  monthly: { period: "monthly", amount: 9900, name: "Stations+ Monthly" },
  annual: { period: "yearly", amount: 99900, name: "Stations+ Annual" },
};

const planCache: Partial<Record<BillingPlan, string>> = {};

async function getPlanId(plan: BillingPlan): Promise<string> {
  const envId =
    plan === "monthly" ? process.env.RAZORPAY_PLAN_MONTHLY : process.env.RAZORPAY_PLAN_ANNUAL;
  if (envId) return envId;
  if (planCache[plan]) return planCache[plan]!;

  const spec = PLAN_SPECS[plan];
  const created = await rzp<{ id: string }>("/plans", {
    period: spec.period,
    interval: 1,
    item: { name: spec.name, amount: spec.amount, currency: "INR" },
  });
  planCache[plan] = created.id;
  console.log(`[billing] created Razorpay plan ${plan}: ${created.id} — pin this in env`);
  return created.id;
}

/** Create a subscription for a user; user id travels in notes for the webhook. */
export async function createSubscription(plan: BillingPlan, userId: string) {
  const planId = await getPlanId(plan);
  const sub = await rzp<{ id: string; short_url: string }>("/subscriptions", {
    plan_id: planId,
    // Razorpay requires a fixed number of billing cycles; renew handling can
    // extend later. 10 years of months / 10 annual cycles.
    total_count: plan === "monthly" ? 120 : 10,
    customer_notify: 1,
    notes: { user_id: userId, plan },
  });
  return { subscriptionId: sub.id, keyId: process.env.RAZORPAY_KEY_ID! };
}
