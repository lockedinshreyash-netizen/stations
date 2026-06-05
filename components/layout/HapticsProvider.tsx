"use client";

import { useEffect } from "react";
import { haptic, type HapticStyle } from "@/lib/feedback";

/**
 * Global tactile layer: a single delegated listener gives every interactive
 * element a haptic on press — no per-component wiring. The texture varies by
 * what was pressed so the whole app feels physical:
 *
 *   switches / reaction pills → rigid (sharp double)
 *   primary / submit buttons  → medium
 *   destructive actions       → heavy
 *   everything else tappable  → selection (lightest)
 *
 * Renders nothing. Respects the shared sound/haptics preference (via haptic()).
 */
const INTERACTIVE =
  'a[href], button, [role="button"], [role="switch"], label, summary, select, .st-pill, .st-btn, .st-card-hover';

function styleFor(el: Element): HapticStyle {
  // Destructive intent — strongest feedback.
  const label = (el.getAttribute("aria-label") || el.textContent || "").toLowerCase();
  if (/log\s?out|delete|remove|leave|end session|sign out/.test(label)) {
    return "heavy";
  }
  if (el.getAttribute("role") === "switch" || el.closest(".reaction-btn")) {
    return "rigid";
  }
  if (
    el.matches('.st-btn, [type="submit"]') ||
    el.closest('.st-btn, [type="submit"]')
  ) {
    return "medium";
  }
  return "selection";
}

export default function HapticsProvider() {
  useEffect(() => {
    function onPointerDown(e: PointerEvent) {
      const target = e.target as Element | null;
      if (!target) return;
      const el = target.closest(INTERACTIVE);
      if (!el) return;
      if (el.hasAttribute("disabled") || el.getAttribute("aria-disabled") === "true") {
        return;
      }
      haptic(styleFor(el));
    }
    // pointerdown fires before navigation/teardown, so the buzz always lands.
    window.addEventListener("pointerdown", onPointerDown);
    return () => window.removeEventListener("pointerdown", onPointerDown);
  }, []);

  return null;
}
