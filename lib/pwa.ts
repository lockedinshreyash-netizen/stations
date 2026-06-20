/**
 * PWA install/runtime detection shared across the install surfaces (the global
 * InstallPrompt banner and the dedicated /download page). Kept framework-free so
 * it can be imported anywhere; all functions guard against SSR.
 */

/** True when the app is running as an installed PWA (home-screen / standalone). */
export function isStandalone(): boolean {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia?.("(display-mode: standalone)").matches ||
    // iOS Safari exposes installed state here rather than via display-mode.
    (window.navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

/** True on iPhone/iPad — where there is no programmatic install prompt. */
export function isIOSDevice(): boolean {
  if (typeof window === "undefined") return false;
  const ua = window.navigator.userAgent;
  const iOS = /iphone|ipad|ipod/i.test(ua);
  // iPadOS 13+ reports as Mac; detect via touch support.
  const iPadOS = /macintosh/i.test(ua) && navigator.maxTouchPoints > 1;
  return iOS || iPadOS;
}

/** The Chromium-only event that lets us fire the native install dialog. */
export type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};
