"use client";

import { useEffect } from "react";
import { pushSupported, getPushRegistration } from "@/lib/push/client";

/**
 * Warms up the standalone push service worker on app load so it's already
 * active when the user toggles notifications or a push arrives. Idempotent and
 * works in dev and production (the worker has no precache step). No-op where
 * service workers aren't supported.
 */
export default function ServiceWorkerRegistrar() {
  useEffect(() => {
    if (!pushSupported()) return;
    void getPushRegistration().catch(() => {
      // Non-fatal: the toggle will register on demand and surface any error.
    });
  }, []);

  return null;
}
