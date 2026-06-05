/**
 * Tactile + audio feedback — the "little things" that make Stations feel
 * premium. Sound is synthesized via the Web Audio API (no audio files) and
 * paired with haptics (navigator.vibrate) where the platform supports it.
 *
 * Platform reality (so expectations are honest):
 *   - iOS Safari / iOS PWA: navigator.vibrate is UNSUPPORTED. No web haptics.
 *     Web Audio also respects the hardware silent switch.
 *   - Android Chrome / PWA: vibrate works after a user gesture.
 *   - Desktop: no vibration hardware; sound works.
 *
 * Reliability: browsers create AudioContext "suspended" until a user gesture.
 * We (a) lazily build it, (b) resume it on the first real interaction via a
 * one-time global listener, and (c) resume-then-play so the first cue isn't
 * dropped.
 *
 * Preference stored in localStorage ('stations-sound'); default ON.
 */

const SOUND_KEY = "stations-sound";

let ctx: AudioContext | null = null;
let masterGain: GainNode | null = null;
let unlockBound = false;

function build(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (ctx) return ctx;
  const AC =
    window.AudioContext ||
    (window as unknown as { webkitAudioContext?: typeof AudioContext })
      .webkitAudioContext;
  if (!AC) return null;
  ctx = new AC();
  masterGain = ctx.createGain();
  masterGain.gain.value = 0.9; // loud-but-tasteful ceiling
  masterGain.connect(ctx.destination);
  return ctx;
}

/** Resume the context (must be called from within a user gesture at least once). */
function resume(): Promise<void> {
  const c = build();
  if (!c) return Promise.resolve();
  if (c.state === "suspended") return c.resume().catch(() => {});
  return Promise.resolve();
}

/**
 * Warm up audio on the first interaction anywhere, so by the time a real cue
 * fires the context is already running. Bound once, client-side only.
 */
function bindUnlock(): void {
  if (unlockBound || typeof window === "undefined") return;
  unlockBound = true;
  const unlock = () => {
    void resume();
  };
  window.addEventListener("pointerdown", unlock, { once: true });
  window.addEventListener("keydown", unlock, { once: true });
  window.addEventListener("touchstart", unlock, { once: true });
}
if (typeof window !== "undefined") bindUnlock();

export function isSoundEnabled(): boolean {
  if (typeof window === "undefined") return false;
  return localStorage.getItem(SOUND_KEY) !== "off";
}

export function setSoundEnabled(on: boolean): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(SOUND_KEY, on ? "on" : "off");
  if (on) tap(); // audible confirm + warms the context inside this gesture
}

/** One shaped tone, scheduled relative to a guaranteed-running context. */
function tone(
  freq: number,
  delay: number,
  duration: number,
  peak: number,
  type: OscillatorType = "sine"
): void {
  const c = ctx;
  if (!c || !masterGain) return;
  const t0 = c.currentTime + delay;
  const osc = c.createOscillator();
  const g = c.createGain();
  osc.type = type;
  osc.frequency.value = freq;
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(peak, t0 + 0.006);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + duration);
  osc.connect(g);
  g.connect(masterGain);
  osc.start(t0);
  osc.stop(t0 + duration + 0.03);
}

/** Resume first (so the first cue isn't dropped), then play the tones. */
function play(tones: () => void): void {
  if (!isSoundEnabled()) return;
  void resume().then(tones);
}

function buzz(pattern: number | number[]): boolean {
  if (typeof window === "undefined" || !("vibrate" in navigator)) return false;
  try {
    // navigator.vibrate returns false if the call was blocked (no user
    // activation, battery saver, DND, etc.) or unsupported.
    return navigator.vibrate(pattern);
  } catch {
    return false;
  }
}

/**
 * Diagnostic: a long, unmistakable buzz + a report of what the platform
 * actually supports. Used by the "Test" control in settings so we can tell a
 * code problem from a device/OS limitation.
 */
export function testHaptics(): { supported: boolean; accepted: boolean } {
  const supported =
    typeof navigator !== "undefined" && "vibrate" in navigator;
  const accepted = buzz([120, 60, 120, 60, 200]);
  return { supported, accepted };
}

/* Pulse lengths are kept >= ~16ms — shorter pulses don't physically register
   on most Android vibration motors (they barely spin up). */

/**
 * Distinct haptic "textures", loosely mirroring iOS's impact styles so
 * different interactions feel different under the thumb:
 *   selection — the lightest crisp tick (general touches)
 *   light / medium / heavy — escalating impact
 *   rigid — a sharp double-tap
 *   soft — a gentle longer pulse
 */
export type HapticStyle =
  | "selection"
  | "light"
  | "medium"
  | "heavy"
  | "rigid"
  | "soft";

const HAPTICS: Record<HapticStyle, number | number[]> = {
  selection: 16,
  light: 22,
  medium: 32,
  heavy: 55,
  rigid: [14, 16, 14],
  soft: 45,
};

/** Fire a haptic by style. Gated by the shared sound/haptics preference. */
export function haptic(style: HapticStyle = "selection"): void {
  if (!isSoundEnabled()) return;
  buzz(HAPTICS[style]);
}

/** Light tick — navigation, toggles, secondary taps. */
export function tap(): void {
  // Haptic is handled globally on press (see HapticsProvider); here we add sound.
  play(() => tone(1250, 0, 0.06, 0.22, "triangle"));
}

/** Affirmative two-note rise — win posted, session completed, key wins. */
export function success(): void {
  buzz([35, 45, 70]);
  play(() => {
    tone(660, 0, 0.13, 0.28, "sine");
    tone(990, 0.1, 0.24, 0.26, "sine");
  });
}

/**
 * Party-popper celebration — a bright ascending major arpeggio + a sparkle
 * tail, with a matching staccato haptic burst. Fired when a win is posted.
 */
export function celebrate(): void {
  // Cheerful rhythmic burst to match the popper.
  buzz([22, 30, 22, 30, 22, 40, 60]);
  play(() => {
    // C5 E5 G5 C6 — major, joyful — then a high sparkle.
    tone(523, 0.0, 0.14, 0.24, "triangle");
    tone(659, 0.08, 0.14, 0.24, "triangle");
    tone(784, 0.16, 0.16, 0.24, "triangle");
    tone(1047, 0.25, 0.28, 0.26, "triangle");
    tone(1568, 0.32, 0.22, 0.16, "sine");
  });
}

/** Bright two-blip pop — reacting to a win. (Haptic handled globally on press.) */
export function pop(): void {
  play(() => {
    tone(880, 0, 0.07, 0.2, "triangle");
    tone(1320, 0.035, 0.09, 0.18, "triangle");
  });
}

/** Soft low thud — errors, destructive confirmations. */
export function error(): void {
  buzz([70, 50, 70]);
  play(() => tone(196, 0, 0.2, 0.3, "sine"));
}

/** Haptic-only nudge for press feedback where sound would be too much. */
export function tick(): void {
  buzz(25);
}
