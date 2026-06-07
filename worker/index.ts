/// <reference lib="webworker" />
/**
 * Custom service-worker code merged into the next-pwa generated worker
 * (next-pwa importScripts the compiled worker-*.js into public/sw.js).
 * Handles incoming Web Push messages and notification clicks.
 */
declare const self: ServiceWorkerGlobalScope;

type PushPayload = {
  title: string;
  body: string;
  url: string;
  tag?: string;
};

self.addEventListener("push", (event: PushEvent) => {
  if (!event.data) return;
  let payload: PushPayload;
  try {
    payload = event.data.json() as PushPayload;
  } catch {
    payload = { title: "Stations", body: event.data.text(), url: "/" };
  }

  event.waitUntil(
    self.registration.showNotification(payload.title, {
      body: payload.body,
      tag: payload.tag,
      icon: "/icon-192.png",
      badge: "/icon-192.png",
      data: { url: payload.url || "/" },
    })
  );
});

self.addEventListener("notificationclick", (event: NotificationEvent) => {
  event.notification.close();
  const targetUrl = (event.notification.data?.url as string) || "/";

  event.waitUntil(
    self.clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((clients) => {
        // Focus an existing tab and route it there if one is open.
        for (const client of clients) {
          if ("focus" in client) {
            void client.focus();
            if ("navigate" in client) {
              void (client as WindowClient).navigate(targetUrl);
            }
            return;
          }
        }
        return self.clients.openWindow(targetUrl);
      })
  );
});

export {};
