"use client";

import { useState, useEffect, useRef } from "react";
import { formatClock } from "@/lib/work/format";

interface SessionTimerProps {
  /** Eyebrow label, e.g. "Starts in" or "Time remaining". */
  label: string;
  /** ISO target the countdown runs to. Null when there's nothing to count. */
  targetIso: string | null;
  /** When true the timer is frozen and shows the ended message. */
  ended: boolean;
  /** Turn the clock red when remaining drops below this many ms. */
  warnUnderMs?: number;
  /** Fired once when the countdown crosses zero (target reached). */
  onReachZero?: () => void;
}

export default function SessionTimer({
  label,
  targetIso,
  ended,
  warnUnderMs = 0,
  onReachZero,
}: SessionTimerProps) {
  const [now, setNow] = useState(() => Date.now());
  const firedRef = useRef(false);

  useEffect(() => {
    if (ended || !targetIso) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [ended, targetIso]);

  const remaining = targetIso ? new Date(targetIso).getTime() - now : 0;

  // Fire the zero callback exactly once when we cross the target.
  useEffect(() => {
    if (ended || !targetIso) return;
    if (remaining <= 0 && !firedRef.current) {
      firedRef.current = true;
      onReachZero?.();
    }
  }, [remaining, ended, targetIso, onReachZero]);

  const isEnded = ended || (targetIso !== null && remaining <= 0);
  const warn = !isEnded && warnUnderMs > 0 && remaining < warnUnderMs;

  return (
    <div className="flex flex-col items-center justify-center gap-4 text-center">
      <span
        className="font-poppins font-bold uppercase text-[rgba(var(--fg-rgb),0.35)]"
        style={{ fontSize: "11px", letterSpacing: "0.25em" }}
      >
        {isEnded ? "Session ended" : label}
      </span>
      {!isEnded && targetIso && (
        <span
          className="font-playfair leading-none tabular-nums"
          style={{
            fontSize: "clamp(56px, 9vw, 96px)",
            color: warn ? "var(--accent)" : "rgb(var(--fg-rgb))",
          }}
        >
          {formatClock(remaining)}
        </span>
      )}
      {isEnded && (
        <span
          className="font-playfair italic text-[rgba(var(--fg-rgb),0.3)]"
          style={{ fontSize: "18px" }}
        >
          Time&apos;s up.
        </span>
      )}
    </div>
  );
}
