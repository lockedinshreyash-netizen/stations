"use client";

import { useEffect, useState } from "react";
import {
  pushSupported,
  permissionState,
  isSubscribed,
  enablePush,
  disablePush,
  PushError,
} from "@/lib/push/client";

const labelStyle = { fontSize: "16px", color: "rgba(var(--fg-rgb),0.85)" } as const;

/**
 * Settings row that turns Web Push on/off for this device. Mirrors the sound &
 * haptics toggle styling. Reflects the live subscription + permission state and
 * disables itself when the browser has blocked notifications.
 */
export default function NotificationsToggle() {
  // Lazy initializers read browser-only APIs on the client's first render
  // (this modal never renders on the server), avoiding setState-in-effect.
  const [supported] = useState(() => pushSupported());
  const [on, setOn] = useState(false);
  const [blocked, setBlocked] = useState(() => permissionState() === "denied");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Async external read — the setState runs in a later callback, not the
    // effect body, so it doesn't trigger cascading renders.
    if (supported) void isSubscribed().then(setOn);
  }, [supported]);

  async function toggle() {
    if (busy || blocked) return;
    setBusy(true);
    setError(null);
    try {
      if (on) {
        await disablePush();
        setOn(false);
      } else {
        const ok = await enablePush();
        setOn(ok);
      }
    } catch (e) {
      setBlocked(permissionState() === "denied");
      setError(
        e instanceof PushError
          ? e.message
          : "Couldn't enable notifications. Please try again."
      );
    } finally {
      setBusy(false);
    }
  }

  if (!supported) return null;

  const caption =
    error ??
    (blocked
      ? "Blocked in your browser settings. Re-enable notifications for this site to turn them on."
      : "Get pinged for DMs, reactions, session starts, and mentions — on this device.");

  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "16px" }}>
      <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
        <span className="font-poppins" style={labelStyle}>Push notifications</span>
        <span className="font-poppins font-light" style={{ fontSize: "14px", color: error ? "var(--accent)" : "rgba(var(--fg-rgb),0.3)", maxWidth: "300px", lineHeight: 1.4 }}>
          {caption}
        </span>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={on}
        aria-label="Toggle push notifications"
        disabled={blocked || busy}
        onClick={toggle}
        style={{
          position: "relative",
          width: "46px",
          height: "26px",
          flexShrink: 0,
          borderRadius: "9999px",
          border: "none",
          cursor: blocked || busy ? "default" : "pointer",
          opacity: blocked ? 0.4 : 1,
          background: on ? "var(--accent)" : "rgba(var(--fg-rgb),0.18)",
          transition: "background 200ms var(--ease)",
        }}
      >
        <span
          style={{
            position: "absolute",
            top: "3px",
            left: on ? "23px" : "3px",
            width: "20px",
            height: "20px",
            borderRadius: "50%",
            background: "#fff",
            boxShadow: "0 1px 3px rgba(0,0,0,0.4)",
            transition: "left 200ms var(--ease)",
          }}
        />
      </button>
    </div>
  );
}
