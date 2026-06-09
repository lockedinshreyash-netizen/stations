/* Stations push service worker — standalone, committed, no build step.
 *
 * Deliberately independent of next-pwa/workbox: it has no precache manifest, so
 * it installs and activates immediately in BOTH `next dev` and production. Its
 * only jobs are receiving Web Push messages and handling notification clicks.
 * Registered at a dedicated narrow scope so it never collides with the PWA
 * service worker. */

self.addEventListener("install", () => {
  // Activate right away instead of waiting for old workers to be released.
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("push", (event) => {
  if (!event.data) return;
  let payload;
  try {
    payload = event.data.json();
  } catch (e) {
    payload = { title: "Stations", body: event.data.text(), url: "/" };
  }

  event.waitUntil(
    self.registration.showNotification(payload.title || "Stations", {
      body: payload.body || "",
      tag: payload.tag,
      icon: "/icon-192.png",
      badge: "/icon-192.png",
      data: { url: payload.url || "/" },
    })
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const targetUrl = (event.notification.data && event.notification.data.url) || "/";

  event.waitUntil(
    self.clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((clientList) => {
        for (const client of clientList) {
          if ("focus" in client) {
            client.focus();
            if ("navigate" in client) client.navigate(targetUrl);
            return;
          }
        }
        return self.clients.openWindow(targetUrl);
      })
  );
});
