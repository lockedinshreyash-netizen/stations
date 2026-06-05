/**
 * Tactile + audio feedback — the "little things" that make Stations feel
 * premium. All synthesized via the Web Audio API (no audio files to ship)
 * and paired with haptics on supported devices.
 *
 * Sounds are deliberately quiet and short. They only ever fire inside a user
 * gesture (tap / submit), so the AudioContext is allowed to start.
 *
 * Preference is stored in localStorage ('stations-sound'); default ON.
 * Haptics respect the same preference. Honors prefers-reduced-motion for
 * vibration (we treat strong motion sensitivity as "no buzz").
 */

const SOUND_KEY = "stations-sound";

let ctx: AudioContext | null = null;
let masterGain: GainNode | null = null;

function getCtx(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (!ctx) {
    const AC =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext })
        .webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
    masterGain = ctx.createGain();
    masterGain.gain.value = 0.5; // global ceiling — keep it subtle
    masterGain.connect(ctx.destination);
  }
  // Browsers suspend the context until a gesture; resume on demand.
  if (ctx.state === "suspended") void ctx.resume();
  return ctx;
}

export function isSoundEnabled(): boolean {
  if (typeof window === "undefined") return false;
  return localStorage.getItem(SOUND_KEY) !== "off";
}

export function setSoundEnabled(on: boolean): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(SOUND_KEY, on ? "on" : "off");
  if (on) {
    // Confirm the new state audibly + warm up the context within the gesture.
    tap();
  }
}

/** A single shaped tone. */
function tone(
  freq: number,
  start: number,
  duration: number,
  peak: number,
  type: OscillatorType = "sine"
): void {
  const c = getCtx();
  if (!c || !masterGain) return;
  const t0 = c.currentTime + start;
  const osc = c.createOscillator();
  const g = c.createGain();
  osc.type = type;
  osc.frequency.value = freq;
  // Fast attack, smooth exponential release — no clicks.
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(peak, t0 + 0.008);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + duration);
  osc.connect(g);
  g.connect(masterGain);
  osc.start(t0);
  osc.stop(t0 + duration + 0.02);
}

function buzz(pattern: number | number[]): void {
  if (typeof window === "undefined") return;
  if (!("vibrate" in navigator)) return;
  if (
    window.matchMedia &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  )
    return;
  try {
    navigator.vibrate(pattern);
  } catch {
    /* no-op */
  }
}

/** Light tick — navigation, toggles, secondary taps. */
export function tap(): void {
  buzz(8);
  if (!isSoundEnabled()) return;
  tone(1300, 0, 0.05, 0.05, "triangle");
}

/** Affirmative two-note rise — win posted, session completed, key wins. */
export function success(): void {
  buzz([12, 30, 18]);
  if (!isSoundEnabled()) return;
  tone(660, 0, 0.12, 0.06, "sine");
  tone(990, 0.09, 0.22, 0.055, "sine");
}

/** Soft low thud — errors, destructive confirmations. */
export function error(): void {
  buzz([20, 40, 20]);
  if (!isSoundEnabled()) return;
  tone(200, 0, 0.18, 0.07, "sine");
}

/** Haptic-only nudge for press feedback where sound would be too much. */
export function tick(): void {
  buzz(6);
}
