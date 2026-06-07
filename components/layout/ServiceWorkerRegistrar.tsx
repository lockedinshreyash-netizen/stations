"use client";

import { useEffect } from "react";

/**
 * Registers the PWA service worker on every page load. next-pwa's built-in
 * auto-register does not reliably run under the App Router, so we register
 * `/sw.js` ourselves — this is what makes push (and offline) work in
 * production. No-op where service workers aren't supported (and the file isn't
 * generated in dev, so it simply fails quietly there).
 */
export default function ServiceWorkerRegistrar() {
  useEffect(() => {
    if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) {
      return;
    }
    navigator.serviceWorker.register("/sw.js").catch(() => {
      // Expected in `next dev` (no sw.js generated). Harmless.
    });
  }, []);

  return null;
}
