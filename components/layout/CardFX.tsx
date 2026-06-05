"use client";

import { useEffect } from "react";

/**
 * Desktop-only: gives every `.st-card-hover` a cursor-driven 3D tilt and a
 * light that tracks the pointer. One delegated listener + rAF batching, so it
 * scales to any number of cards with no per-component wiring. CSS consumes the
 * --rx/--ry (tilt) and --mx/--my (sheen position) custom properties.
 */
const MAX_TILT = 6; // degrees

export default function CardFX() {
  useEffect(() => {
    // Pointer-fine devices only — no tilt on touch.
    if (!window.matchMedia?.("(hover: hover)").matches) return;
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;

    let current: HTMLElement | null = null;
    let frame: number | null = null;
    let lastEvent: PointerEvent | null = null;

    function apply() {
      frame = null;
      const e = lastEvent;
      if (!e) return;
      const el = (e.target as Element | null)?.closest<HTMLElement>(
        ".st-card-hover"
      );
      if (el !== current) {
        if (current) reset(current);
        current = el ?? null;
      }
      if (!el) return;
      // Over anything interactive? Flatten and hold still so the target
      // doesn't move under the cursor — tilt only over the card's dead space.
      const overInteractive = (e.target as Element | null)?.closest(
        'a, button, [role="button"], [role="switch"], input, textarea, select, label, .reaction-btn'
      );
      if (overInteractive) {
        reset(el);
        return;
      }
      const r = el.getBoundingClientRect();
      const px = (e.clientX - r.left) / r.width;
      const py = (e.clientY - r.top) / r.height;
      el.style.setProperty("--ry", `${(px - 0.5) * 2 * MAX_TILT}deg`);
      el.style.setProperty("--rx", `${(0.5 - py) * 2 * MAX_TILT}deg`);
      el.style.setProperty("--mx", `${px * 100}%`);
      el.style.setProperty("--my", `${py * 100}%`);
    }

    function reset(el: HTMLElement) {
      el.style.removeProperty("--rx");
      el.style.removeProperty("--ry");
    }

    function onMove(e: PointerEvent) {
      lastEvent = e;
      if (frame == null) frame = requestAnimationFrame(apply);
    }
    function onLeave() {
      if (current) reset(current);
      current = null;
    }

    window.addEventListener("pointermove", onMove, { passive: true });
    window.addEventListener("pointerdown", onLeave); // avoid stuck tilt on click-nav
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerdown", onLeave);
      if (frame != null) cancelAnimationFrame(frame);
    };
  }, []);

  return null;
}
