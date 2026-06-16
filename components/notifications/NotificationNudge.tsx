"use client";

import { useEffect, useState } from "react";
import { Bell } from "lucide-react";
import {
  pushSupported,
  permissionState,
  isSubscribed,
  enablePush,
  PushError,
} from "@/lib/push/client";
import { tap } from "@/lib/feedback";

// Frequency cap — nudge "time and again" without nagging. We re-ask at most
// MAX_SHOWS times, no more than once every COOLDOWN_MS, never after the OS-level
// permission was denied (that permanently blocks the browser prompt), and never
// once the device is subscribed.
const DISMISS_KEY = "notif_nudge_dismissed_at";
const COUNT_KEY = "notif_nudge_count";
const MAX_SHOWS = 4;
const COOLDOWN_MS = 3 * 24 * 60 * 60 * 1000; // 3 days

/**
 * Dismissible banner that prompts the user to turn on push notifications — the
 * single highest-leverage retention action (it's the only channel that can pull
 * a lapsed user back). Mirrors NotificationsToggle's enable logic, but capped so
 * it reappears periodically rather than every visit.
 */
export default function NotificationNudge() {
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!pushSupported() || permissionState() === "denied") return;

    let count = 0;
    let dismissedAt = 0;
    try {
      count = parseInt(localStorage.getItem(COUNT_KEY) || "0", 10) || 0;
      dismissedAt = parseInt(localStorage.getItem(DISMISS_KEY) || "0", 10) || 0;
    } catch {
      /* private mode / blocked storage — just treat as first show */
    }
    if (count >= MAX_SHOWS) return;
    if (dismissedAt && Date.now() - dismissedAt < COOLDOWN_MS) return;

    // Only show if this device isn't already subscribed (async, mount-safe).
    void isSubscribed().then((sub) => {
      if (!sub) setShow(true);
    });
  }, []);

  async function handleEnable() {
    if (busy) return;
    tap();
    setBusy(true);
    setError(null);
    try {
      await enablePush();
      setShow(false); // subscribed now — never re-prompt
    } catch (e) {
      if (permissionState() === "denied") {
        setShow(false); // blocked at the OS level; the banner can't help anymore
        return;
      }
      setError(
        e instanceof PushError
          ? e.message
          : "Couldn't enable notifications. Please try again."
      );
    } finally {
      setBusy(false);
    }
  }

  function dismiss() {
    tap();
    try {
      const count =
        (parseInt(localStorage.getItem(COUNT_KEY) || "0", 10) || 0) + 1;
      localStorage.setItem(COUNT_KEY, String(count));
      localStorage.setItem(DISMISS_KEY, String(Date.now()));
    } catch {
      /* ignore */
    }
    setShow(false);
  }

  if (!show) return null;

  return (
    <div
      className="st-card flex flex-col gap-3 px-5 py-4"
      style={{
        background: "rgba(var(--accent-rgb),0.07)",
        border: "0.5px solid rgba(var(--accent-rgb),0.25)",
      }}
    >
      <div className="flex items-start gap-3">
        <Bell size={18} className="text-[var(--accent)] shrink-0 mt-0.5" />
        <div className="flex flex-col gap-1">
          <span
            className="font-poppins text-[rgb(var(--fg-rgb))]"
            style={{ fontSize: "16px", fontWeight: 500 }}
          >
            Turn on notifications
          </span>
          <span
            className="font-poppins font-light"
            style={{
              fontSize: "14px",
              color: error ? "var(--accent)" : "rgba(var(--fg-rgb),0.5)",
              lineHeight: 1.45,
            }}
          >
            {error ??
              "Get pinged the moment your partner replies, a session starts, or someone reacts to your win — one tap."}
          </span>
        </div>
      </div>

      <div className="flex items-center gap-2 pl-7">
        <button
          type="button"
          onClick={handleEnable}
          disabled={busy}
          className="st-btn font-poppins uppercase"
          style={{
            background: "var(--accent)",
            color: "#fff",
            fontSize: "13px",
            fontWeight: 500,
            letterSpacing: "0.12em",
            padding: "8px 18px",
            border: "none",
            cursor: busy ? "default" : "pointer",
            opacity: busy ? 0.6 : 1,
          }}
        >
          {busy ? "Enabling…" : "Enable"}
        </button>
        <button
          type="button"
          onClick={dismiss}
          disabled={busy}
          className="font-poppins uppercase"
          style={{
            fontSize: "13px",
            letterSpacing: "0.12em",
            color: "rgba(var(--fg-rgb),0.4)",
            background: "transparent",
            border: "none",
            padding: "8px 10px",
            cursor: "pointer",
          }}
        >
          Not now
        </button>
      </div>
    </div>
  );
}
