"use client";

import { useEffect, useState, useCallback } from "react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import { Download, X } from "lucide-react";
import { tap } from "@/lib/feedback";
import { isStandalone } from "@/lib/pwa";

/**
 * The platform's lightweight "get the app" teaser.
 *
 * Shows a loud, top-anchored banner to any visitor browsing in a normal tab
 * (i.e. has NOT installed the app). The banner can be dismissed — but per
 * product, dismissing does NOT remove it: it collapses to a slim sticky chip
 * pinned to the top that still links to install, so the call to install is
 * always one tap away. That minimized choice is remembered in localStorage so
 * the full banner doesn't re-expand on every navigation.
 *
 * All the actual install mechanics (native prompt, iOS instructions, platform
 * detection) live on the dedicated /download page — this surface is just the
 * teaser that routes there, so there's a single source of truth.
 *
 * Renders nothing once the app is running standalone (already installed) or
 * while the user is already on /download (it'd be redundant).
 */

const MIN_KEY = "stations-install-minimized";

export default function InstallPrompt() {
  const pathname = usePathname();
  const [mounted, setMounted] = useState(false);
  const [installed, setInstalled] = useState(false);
  const [minimized, setMinimized] = useState(false);

  useEffect(() => {
    setMounted(true);
    setInstalled(isStandalone());
    try {
      setMinimized(localStorage.getItem(MIN_KEY) === "1");
    } catch {
      /* localStorage unavailable — default to expanded */
    }

    const onInstalled = () => {
      setInstalled(true);
      try {
        localStorage.removeItem(MIN_KEY);
      } catch {
        /* ignore */
      }
    };
    window.addEventListener("appinstalled", onInstalled);
    return () => window.removeEventListener("appinstalled", onInstalled);
  }, []);

  const minimize = useCallback(() => {
    tap();
    setMinimized(true);
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

  // Avoid SSR/first-paint flash; never show once installed or on /download.
  if (!mounted || installed || pathname === "/download") return null;

  // ── Minimized: slim sticky chip pinned to the top, install one tap away.
  if (minimized) {
    return (
      <div
        className="fixed inset-x-0 top-0 z-[9970] flex justify-center px-3"
        style={{ paddingTop: "calc(env(safe-area-inset-top, 0px) + 8px)" }}
      >
        <Link
          href="/download"
          onClick={() => tap()}
          className="st-glass st-pill flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-medium text-text-primary shadow-lg"
          aria-label="Get the Stations app"
        >
          <Download size={14} className="text-accent-brass" />
          <span>Install app</span>
        </Link>
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
        aria-label="Get the Stations app"
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

        <div className="mt-3 flex items-center gap-2">
          <Link
            href="/download"
            onClick={() => tap()}
            className="st-btn flex flex-1 items-center justify-center gap-2 rounded-xl bg-accent-brass px-4 py-2.5 text-sm font-semibold text-bg-primary"
          >
            <Download size={16} />
            Get the app
          </Link>
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
