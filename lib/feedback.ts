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

function buzz(pattern: number | number[]): void {
  if (typeof window === "undefined" || !("vibrate" in navigator)) return;
  try {
    navigator.vibrate(pattern);
  } catch {
    /* no-op */
  }
}

/** Light tick — navigation, toggles, secondary taps. */
export function tap(): void {
  buzz(12);
  play(() => tone(1250, 0, 0.06, 0.22, "triangle"));
}

/** Affirmative two-note rise — win posted, session completed, key wins. */
export function success(): void {
  buzz([14, 30, 22]);
  play(() => {
    tone(660, 0, 0.13, 0.28, "sine");
    tone(990, 0.1, 0.24, 0.26, "sine");
  });
}

/** Soft low thud — errors, destructive confirmations. */
export function error(): void {
  buzz([24, 40, 24]);
  play(() => tone(196, 0, 0.2, 0.3, "sine"));
}

/** Haptic-only nudge for press feedback where sound would be too much. */
export function tick(): void {
  buzz(10);
}
