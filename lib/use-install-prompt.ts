"use client";

import { useCallback, useEffect, useState } from "react";
import {
  isIOSDevice,
  isStandalone,
  type BeforeInstallPromptEvent,
} from "@/lib/pwa";

/**
 * Encapsulates the PWA install lifecycle so every install surface shares one
 * implementation:
 *  - captures the Chromium `beforeinstallprompt` so we can fire the native
 *    dialog on demand (`promptInstall`)
 *  - tracks installed state via the `appinstalled` event + standalone check
 *  - reports `isIOS` (no programmatic prompt — callers show manual A2HS steps)
 *
 * `mounted` lets callers avoid an SSR/first-paint flash, mirroring how the
 * existing banner gates its render.
 */
export function useInstallPrompt() {
  const [mounted, setMounted] = useState(false);
  const [installed, setInstalled] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);

  useEffect(() => {
    setMounted(true);
    setInstalled(isStandalone());
    setIsIOS(isIOSDevice());

    const onBeforeInstall = (e: Event) => {
      // Keep the event so we can fire the native dialog on demand.
      e.preventDefault();
      setDeferred(e as BeforeInstallPromptEvent);
    };
    const onInstalled = () => {
      setInstalled(true);
      setDeferred(null);
    };

    window.addEventListener("beforeinstallprompt", onBeforeInstall);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onBeforeInstall);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  /**
   * Fire the native install dialog. Returns the outcome, or `"unavailable"`
   * when no prompt was captured (iOS, or a browser that never fired the event)
   * so callers can fall back to manual instructions instead of a dead button.
   */
  const promptInstall = useCallback(async (): Promise<
    "accepted" | "dismissed" | "unavailable"
  > => {
    if (!deferred) return "unavailable";
    await deferred.prompt();
    const { outcome } = await deferred.userChoice;
    setDeferred(null);
    if (outcome === "accepted") setInstalled(true);
    return outcome;
  }, [deferred]);

  return {
    mounted,
    installed,
    isIOS,
    /** A native install dialog is ready to fire right now. */
    canPrompt: deferred !== null,
    promptInstall,
  };
}
