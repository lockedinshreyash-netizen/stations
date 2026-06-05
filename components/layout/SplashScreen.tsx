"use client";

import { useEffect, useState } from "react";

const WORD = "STATIONS";

/**
 * Cinematic cold-load splash. Mounts once per full document load (it lives in
 * the root layout, which persists across client navigation, so it does not
 * replay on in-app page switches). The wordmark cascades in, a brass hairline
 * sweeps, then the whole stage lifts away.
 *
 * Tap-to-skip for the impatient. Honors prefers-reduced-motion (shortened).
 */
export default function SplashScreen() {
  const [leaving, setLeaving] = useState(false);
  const [gone, setGone] = useState(false);

  useEffect(() => {
    const reduce =
      typeof window !== "undefined" &&
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    const holdMs = reduce ? 500 : 1700;
    const exitMs = reduce ? 200 : 700;

    const t1 = setTimeout(() => setLeaving(true), holdMs);
    const t2 = setTimeout(() => setGone(true), holdMs + exitMs);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, []);

  if (gone) return null;

  return (
    <div
      className={`st-stage ${leaving ? "st-splash-out" : ""}`}
      aria-hidden="true"
      onClick={() => setLeaving(true)}
    >
      <div
        className="st-word font-poppins"
        style={{ fontSize: "clamp(40px, 11vw, 92px)" }}
      >
        {WORD.split("").map((ch, i) => (
          <span key={i} style={{ animationDelay: `${i * 70}ms` }}>
            {ch}
          </span>
        ))}
        <span className="st-dot" style={{ animationDelay: `${WORD.length * 70}ms` }}>
          .
        </span>
      </div>
      <div className="st-sweep" />
    </div>
  );
}
