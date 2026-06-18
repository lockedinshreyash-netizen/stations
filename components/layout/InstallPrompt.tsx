"use client";

import { useEffect, useState, useCallback } from "react";
import { Download, X, Share, Plus } from "lucide-react";
import { tap } from "@/lib/feedback";

/**
 * The platform's mobile/desktop install (Add to Home Screen) prompt for the PWA.
 *
 * Shows a loud, top-anchored banner to any visitor who is browsing in a normal
 * tab (i.e. has NOT installed the app). The banner can be dismissed — but per
 * product, dismissing does NOT remove it: it collapses to a slim sticky chip
 * pinned to the top of the screen that still carries the install button, so the
 * call to install is always one tap away. That minimized choice is remembered
 * in localStorage so the full banner doesn't re-expand on every navigation.
 *
 * Install mechanics:
 *  - Chromium (Android/desktop): captures `beforeinstallprompt` and fires the
 *    native install dialog on tap.
 *  - iOS Safari: no programmatic prompt exists, so we reveal the manual
 *    "Share → Add to Home Screen" steps instead.
 *
 * Renders nothing once the app is running standalone (already installed) or
 * after the `appinstalled` event fires.
 */

const MIN_KEY = "stations-install-minimized";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

function isStandalone() {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia?.("(display-mode: standalone)").matches ||
    // iOS Safari exposes installed state here rather than via display-mode.
    (window.navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

function isIOSDevice() {
  if (typeof window === "undefined") return false;
  const ua = window.navigator.userAgent;
  const iOS = /iphone|ipad|ipod/i.test(ua);
  // iPadOS 13+ reports as Mac; detect via touch support.
  const iPadOS = /macintosh/i.test(ua) && navigator.maxTouchPoints > 1;
  return iOS || iPadOS;
}

export default function InstallPrompt() {
  const [mounted, setMounted] = useState(false);
  const [installed, setInstalled] = useState(false);
  const [minimized, setMinimized] = useState(false);
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  const [isIOS, setIsIOS] = useState(false);
  const [showIosHelp, setShowIosHelp] = useState(false);

  useEffect(() => {
    setMounted(true);
    setInstalled(isStandalone());
    setIsIOS(isIOSDevice());
    try {
      setMinimized(localStorage.getItem(MIN_KEY) === "1");
    } catch {
      /* localStorage unavailable — default to expanded */
    }

    const onBeforeInstall = (e: Event) => {
      // Keep the event so we can fire the native dialog on demand.
      e.preventDefault();
      setDeferred(e as BeforeInstallPromptEvent);
    };
    const onInstalled = () => {
      setInstalled(true);
      try {
        localStorage.removeItem(MIN_KEY);
      } catch {
        /* ignore */
      }
    };

    window.addEventListener("beforeinstallprompt", onBeforeInstall);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onBeforeInstall);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  const install = useCallback(async () => {
    tap();
    if (isIOS) {
      setShowIosHelp((v) => !v);
      return;
    }
    if (deferred) {
      await deferred.prompt();
      const choice = await deferred.userChoice;
      setDeferred(null);
      if (choice.outcome === "accepted") setInstalled(true);
      return;
    }
    // No captured prompt (e.g. unsupported browser or already eligible later):
    // surface the manual hint so the button is never a dead end.
    setShowIosHelp((v) => !v);
  }, [deferred, isIOS]);

  const minimize = useCallback(() => {
    tap();
    setMinimized(true);
    setShowIosHelp(false);
    try {
      localStorage.setItem(MIN_KEY, "1");
    } catch {
      /* ignore */
    }
  }, []);

  const expand = useCallback(() => {
    tap();
    setMinimized(false);
    try {
      localStorage.removeItem(MIN_KEY);
    } catch {
      /* ignore */
    }
  }, []);

  // Avoid SSR/first-paint flash; never show once installed.
  if (!mounted || installed) return null;

  // ── Minimized: slim sticky chip pinned to the top, install still one tap away.
  if (minimized) {
    return (
      <div
        className="fixed inset-x-0 top-0 z-[9970] flex justify-center px-3"
        style={{ paddingTop: "calc(env(safe-area-inset-top, 0px) + 8px)" }}
      >
        <button
          onClick={expand}
          className="st-glass st-pill flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-medium text-text-primary shadow-lg"
          aria-label="Install the Stations app"
        >
          <Download size={14} className="text-accent-brass" />
          <span>Install app</span>
        </button>
      </div>
    );
  }

  // ── Full banner.
  return (
    <div
      className="fixed inset-x-0 top-0 z-[9970] flex justify-center px-3"
      style={{ paddingTop: "calc(env(safe-area-inset-top, 0px) + 10px)" }}
    >
      <div
        className="st-glass w-full max-w-md rounded-2xl border p-4 shadow-2xl"
        style={{ animation: "st-rise 360ms var(--ease, ease-out)" }}
        role="dialog"
        aria-label="Install the Stations app"
      >
        <div className="flex items-start gap-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/icon-192.png"
            alt="Stations"
            width={44}
            height={44}
            className="h-11 w-11 shrink-0 rounded-xl"
          />
          <div className="min-w-0 flex-1">
            <p className="font-playfair text-base italic leading-tight text-text-primary">
              Get the Stations app
            </p>
            <p className="mt-0.5 text-xs leading-snug text-text-secondary">
              Install it for full-screen, offline-ready access and instant
              notifications — straight from your home screen.
            </p>
          </div>
          <button
            onClick={minimize}
            className="st-pill -mr-1 -mt-1 shrink-0 rounded-full p-1.5 text-text-secondary hover:text-text-primary"
            aria-label="Minimize"
          >
            <X size={16} />
          </button>
        </div>

        {showIosHelp ? (
          <div className="mt-3 rounded-xl border border-border bg-bg-surface/60 p-3 text-xs leading-relaxed text-text-secondary">
            <p className="mb-1.5 font-medium text-text-primary">
              Add to Home Screen
            </p>
            <p className="flex items-center gap-1.5">
              <span>1. Tap</span>
              <Share size={14} className="text-accent-brass" />
              <span>in the toolbar</span>
            </p>
            <p className="mt-1 flex items-center gap-1.5">
              <span>2. Choose</span>
              <Plus size={14} className="text-accent-brass" />
              <span>“Add to Home Screen”</span>
            </p>
          </div>
        ) : null}

        <div className="mt-3 flex items-center gap-2">
          <button
            onClick={install}
            className="st-btn flex flex-1 items-center justify-center gap-2 rounded-xl bg-accent-brass px-4 py-2.5 text-sm font-semibold text-bg-primary"
          >
            <Download size={16} />
            {isIOS ? "How to install" : "Install app"}
          </button>
          <button
            onClick={minimize}
            className="st-pill rounded-xl border border-border px-3 py-2.5 text-sm text-text-secondary hover:text-text-primary"
          >
            Later
          </button>
        </div>
      </div>
    </div>
  );
}
