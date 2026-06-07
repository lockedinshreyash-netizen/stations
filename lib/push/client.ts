"use client";

/**
 * Browser-side Web Push helpers: feature detection, permission + subscription
 * lifecycle, and a small @mention extractor for room chat. The subscription is
 * created against the service worker that next-pwa registers (public/sw.js,
 * which importScripts our custom push handler).
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

/**
 * Resolve the active service-worker registration, registering it ourselves if
 * next-pwa hasn't (it doesn't in development). Races `ready` against a timeout
 * so a missing/broken worker surfaces an error instead of hanging the UI.
 */
async function getReadyRegistration(): Promise<ServiceWorkerRegistration> {
  let reg = await navigator.serviceWorker.getRegistration();
  if (!reg) reg = await navigator.serviceWorker.register("/sw.js");

  const timeout = new Promise<never>((_, reject) =>
    setTimeout(
      () =>
        reject(
          new PushError(
            "The service worker isn't active. In local dev run a production build (npm run build && npm start), or test on the deployed site."
          )
        ),
      8000
    )
  );
  return Promise.race([navigator.serviceWorker.ready, timeout]);
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

  const reg = await getReadyRegistration();
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
  const reg = await navigator.serviceWorker.ready;
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
  const reg = await navigator.serviceWorker.ready;
  return !!(await reg.pushManager.getSubscription());
}

/** Pull @usernames out of a message body (lowercased, deduped). */
export function extractMentions(content: string): string[] {
  const matches = content.match(/@([a-zA-Z0-9_]{2,32})/g) ?? [];
  return [...new Set(matches.map((m) => m.slice(1).toLowerCase()))];
}

/** Fire-and-forget: ask the server to push @mentioned room members. */
export function notifyMentions(room: string, content: string): void {
  const usernames = extractMentions(content);
  if (usernames.length === 0) return;
  void fetch("/api/push/mention", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ room, usernames, content }),
  }).catch(() => {});
}
