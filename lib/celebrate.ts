/**
 * Fire the app-wide celebration (silver/gold party-popper + sound + haptics).
 * Decoupled via a window event so any component can trigger it without
 * importing the canvas. The <Celebration/> layer (mounted in the root layout)
 * listens and handles visuals + audio.
 */
export const CELEBRATE_EVENT = "stations:celebrate";

export function fireCelebration(): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(CELEBRATE_EVENT));
}
