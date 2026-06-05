/**
 * Device-orientation ("gyroscope") parallax preference + permission handling.
 *
 * iOS 13+ requires DeviceOrientationEvent.requestPermission() called from a
 * user gesture (the settings toggle). Android exposes the events without a
 * prompt. Default OFF — it needs permission and isn't for everyone.
 */
const MOTION_KEY = "stations-motion";
export const MOTION_EVENT = "stations:motion";

export function isMotionEnabled(): boolean {
  if (typeof window === "undefined") return false;
  return localStorage.getItem(MOTION_KEY) === "on";
}

type DOEWithPermission = typeof DeviceOrientationEvent & {
  requestPermission?: () => Promise<"granted" | "denied">;
};

export async function requestMotionPermission(): Promise<boolean> {
  if (typeof window === "undefined" || !("DeviceOrientationEvent" in window)) {
    return false;
  }
  const DOE = window.DeviceOrientationEvent as DOEWithPermission;
  if (typeof DOE.requestPermission === "function") {
    try {
      return (await DOE.requestPermission()) === "granted";
    } catch {
      return false;
    }
  }
  return true; // Android / no explicit prompt
}

/**
 * Persist + broadcast the preference. Returns the resulting state (may be
 * false if the user denied the permission prompt). Must be called from a
 * user gesture when enabling on iOS.
 */
export async function setMotionEnabled(on: boolean): Promise<boolean> {
  if (typeof window === "undefined") return false;
  let next = on;
  if (on) next = await requestMotionPermission();
  localStorage.setItem(MOTION_KEY, next ? "on" : "off");
  window.dispatchEvent(new CustomEvent(MOTION_EVENT));
  return next;
}
