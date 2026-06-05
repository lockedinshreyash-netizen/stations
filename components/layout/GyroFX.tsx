"use client";

import { useEffect } from "react";
import { isMotionEnabled, MOTION_EVENT } from "@/lib/motion";

/**
 * Gyroscope parallax: when motion is enabled, the phone's tilt drives a global
 * --gyro-rx/--gyro-ry that every `.st-card-hover` inherits into its transform,
 * so the whole feed subtly leans as you move the device. One style write per
 * frame on <html>; cards inherit. Toggled live via MOTION_EVENT.
 */
const MAX = 7; // max degrees of lean

function clamp(n: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, n));
}

export default function GyroFX() {
  useEffect(() => {
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;

    const root = document.documentElement;
    let active = false;
    let raf: number | null = null;
    let last: DeviceOrientationEvent | null = null;

    function apply() {
      raf = null;
      if (!last) return;
      const beta = last.beta ?? 0; // front-back tilt (~45° when held naturally)
      const gamma = last.gamma ?? 0; // left-right tilt
      const rx = clamp((beta - 45) / 6, -MAX, MAX);
      const ry = clamp(gamma / 6, -MAX, MAX);
      root.style.setProperty("--gyro-rx", `${rx.toFixed(2)}deg`);
      root.style.setProperty("--gyro-ry", `${ry.toFixed(2)}deg`);
    }

    function onOrient(e: DeviceOrientationEvent) {
      last = e;
      if (raf == null) raf = requestAnimationFrame(apply);
    }

    function start() {
      if (active || !("DeviceOrientationEvent" in window)) return;
      active = true;
      window.addEventListener("deviceorientation", onOrient);
    }
    function stop() {
      active = false;
      window.removeEventListener("deviceorientation", onOrient);
      if (raf != null) cancelAnimationFrame(raf);
      raf = null;
      root.style.removeProperty("--gyro-rx");
      root.style.removeProperty("--gyro-ry");
    }

    function sync() {
      if (isMotionEnabled()) start();
      else stop();
    }

    sync(); // honor stored preference on load (permission already granted before)
    window.addEventListener(MOTION_EVENT, sync);
    return () => {
      window.removeEventListener(MOTION_EVENT, sync);
      stop();
    };
  }, []);

  return null;
}
