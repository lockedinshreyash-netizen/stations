"use client";

/**
 * Browser-side Web Push helpers: feature detection, permission + subscription
 * lifecycle, and a small @mention extractor for room chat. The subscription is
 * created against our standalone push worker (public/push-sw.js) — independent
 * of next-pwa, so it works identically in dev and production.
 */

export function pushSupported(): boolean {
  return (
    typeof window !== "undefined" &&
    "serviceWorker" in navigator &&
    "PushManager" in window &&
    "Notification" in window
  );
}

export function permissionState(): NotificationPermission {
  if (typeof Notification === "undefined") return "denied";
  return Notification.permission;
}

/** VAPID public key as a Uint8Array, as the PushManager wants it. */
function urlBase64ToUint8Array(base64: string): Uint8Array<ArrayBuffer> {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const normalized = (base64 + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(normalized);
  const out = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

/**
 * Request permission (if needed), subscribe via the active service worker, and
 * persist the subscription server-side. Returns true on success. Safe to call
 * repeatedly — re-subscribing upserts by endpoint.
 */

/** Carries a message safe to show the user when enabling push fails. */
export class PushError extends Error {}

// Standalone push worker (public/push-sw.js), registered at a dedicated scope
// so it never collides with the PWA worker. It has no precache step, so it
// activates immediately in both dev and production.
const PUSH_SW_URL = "/push-sw.js";
const PUSH_SW_SCOPE = "/push-scope/";

/**
 * Register the standalone push worker and resolve once it's ACTIVE. We don't
 * use navigator.serviceWorker.ready (that tracks the page-controlling worker);
 * we wait on this specific registration's lifecycle, with a timeout so a broken
 * worker surfaces an error instead of hanging the UI.
 */
export async function getPushRegistration(): Promise<ServiceWorkerRegistration> {
  const reg = await navigator.serviceWorker.register(PUSH_SW_URL, {
    scope: PUSH_SW_SCOPE,
  });
  if (reg.active) return reg;

  const worker = reg.installing ?? reg.waiting;
  if (!worker) return reg;

  await new Promise<void>((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new PushError("The notification service worker didn't start. Please retry.")),
      8000
    );
    worker.addEventListener("statechange", () => {
      if (worker.state === "activated") {
        clearTimeout(timer);
        resolve();
      }
    });
  });
  return reg;
}

export async function enablePush(): Promise<boolean> {
  if (!pushSupported()) {
    throw new PushError("This browser doesn't support push notifications.");
  }
  const vapidKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  if (!vapidKey) {
    throw new PushError("Push isn't configured (missing VAPID key).");
  }

  const permission =
    Notification.permission === "default"
      ? await Notification.requestPermission()
      : Notification.permission;
  if (permission !== "granted") {
    throw new PushError(
      permission === "denied"
        ? "Notifications are blocked. Enable them for this site in your browser settings."
        : "Notification permission wasn't granted."
    );
  }

  const reg = await getPushRegistration();
  let sub = await reg.pushManager.getSubscription();
  if (!sub) {
    sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(vapidKey),
    });
  }

  const res = await fetch("/api/push/subscribe", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(sub.toJSON()),
  });
  if (!res.ok) {
    throw new PushError("Couldn't save your subscription. Please try again.");
  }
  return true;
}

/** Unsubscribe locally and tell the server to forget the subscription. */
export async function disablePush(): Promise<boolean> {
  if (!pushSupported()) return false;
  const reg = await getPushRegistration();
  const sub = await reg.pushManager.getSubscription();
  if (!sub) return true;
  const endpoint = sub.endpoint;
  await sub.unsubscribe();
  await fetch("/api/push/unsubscribe", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ endpoint }),
  });
  return true;
}

/** True if this browser currently holds a push subscription. */
export async function isSubscribed(): Promise<boolean> {
  if (!pushSupported()) return false;
  // Look up the existing registration without creating one (cheap, mount-safe).
  const reg = await navigator.serviceWorker.getRegistration(PUSH_SW_SCOPE);
  if (!reg) return false;
  return !!(await reg.pushManager.getSubscription());
}

/**
 * Fire-and-forget push request to the unified, session-authed endpoint. Called
 * AFTER the underlying write succeeds; failures are swallowed so a push can
 * never affect the action that triggered it.
 */
function fireNotify(payload: Record<string, unknown>): void {
  void fetch("/api/push/notify", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  }).catch(() => {});
}

/** Notify the other participant that a DM was sent. */
export function notifyNewDm(conversationId: string): void {
  fireNotify({ kind: "dm", conversationId });
}

/** Notify a member that the caller sent them a DM request. */
export function notifyDmRequest(addresseeId: string): void {
  fireNotify({ kind: "dm_request", addresseeId });
}

/** Notify the original requester that the caller accepted their DM request. */
export function notifyDmRequestAccepted(
  requesterId: string,
  conversationId: string
): void {
  fireNotify({ kind: "dm_request_accepted", requesterId, conversationId });
}

/** Notify a win's author that it was reacted to (server skips self-reactions). */
export function notifyNewReaction(winId: string): void {
  fireNotify({ kind: "reaction", winId });
}

/** Host broadcast: a work session just went live. */
export function notifySessionStarted(sessionId: string): void {
  fireNotify({ kind: "session_start", sessionId });
}

/** Notify a member that the caller sent them an accountability partner request. */
export function notifyPartnerRequest(addresseeId: string): void {
  fireNotify({ kind: "partner_request", addresseeId });
}

/** Notify the original requester that the caller accepted their partner request. */
export function notifyPartnerAccepted(requesterId: string): void {
  fireNotify({ kind: "partner_accepted", requesterId });
}

/**
 * Notify the caller's partners that they finished everything on today's plan.
 * Fire only after the write that completed the last task has committed; the
 * server re-verifies completion and dedupes to once per day.
 */
export function notifyDailyComplete(): void {
  fireNotify({ kind: "daily_complete" });
}

/** Pull @usernames out of a message body (lowercased, deduped). */
export function extractMentions(content: string): string[] {
  const matches = content.match(/@([a-zA-Z0-9_]{2,32})/g) ?? [];
  return [...new Set(matches.map((m) => m.slice(1).toLowerCase()))];
}

/** Notify @mentioned room members. No-op when there are no mentions. */
export function notifyMentions(room: string, content: string): void {
  const usernames = extractMentions(content);
  if (usernames.length === 0) return;
  fireNotify({ kind: "mention", room, usernames });
}

/** Send a diagnostic push to the caller's own devices. Returns true on 200. */
export async function sendTestPush(): Promise<boolean> {
  const res = await fetch("/api/push/notify", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ kind: "test" }),
  });
  return res.ok;
}
