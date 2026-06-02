// Pure formatting helpers for the Work station. No client directive — usable
// from server or client.

/** 30 → "30 min", 60 → "1 hour", 90 → "1.5 hours", 120 → "2 hours". */
export function formatDuration(minutes: number): string {
  if (minutes < 60) return `${minutes} min`;
  const hours = minutes / 60;
  const label = Number.isInteger(hours) ? String(hours) : hours.toFixed(1);
  return `${label} ${hours === 1 ? "hour" : "hours"}`;
}

/**
 * Human "starts in" countdown from now to an ISO target.
 * Returns e.g. "Starts in 13 minutes", "Starts in 2 hours", or "Starting…"
 * once the target has passed.
 */
export function formatStartsIn(targetIso: string, nowMs: number): string {
  const diff = new Date(targetIso).getTime() - nowMs;
  if (diff <= 0) return "Starting…";
  const mins = Math.round(diff / 60_000);
  if (mins < 1) return "Starts in <1 minute";
  if (mins < 60) return `Starts in ${mins} ${mins === 1 ? "minute" : "minutes"}`;
  const hours = Math.floor(mins / 60);
  const rem = mins % 60;
  if (hours < 24) {
    return rem === 0
      ? `Starts in ${hours} ${hours === 1 ? "hour" : "hours"}`
      : `Starts in ${hours}h ${rem}m`;
  }
  const days = Math.round(hours / 24);
  return `Starts in ${days} ${days === 1 ? "day" : "days"}`;
}

/** Milliseconds → "hh:mm:ss" (clamped at 0). */
export function formatClock(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(h)}:${pad(m)}:${pad(s)}`;
}
