/** Pure formatting helpers for the Archive station. No client/server deps. */

/** Total runtime in seconds → "45m" / "1h 20m" / "2h". "—" when unknown. */
export function formatRuntime(totalSeconds: number): string {
  if (!totalSeconds || totalSeconds <= 0) return "—";
  const mins = Math.round(totalSeconds / 60);
  if (mins < 60) return `${mins}m`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m ? `${h}h ${m}m` : `${h}h`;
}

/** "1 lesson" / "8 lessons". */
export function formatLessonCount(n: number): string {
  return `${n} ${n === 1 ? "lesson" : "lessons"}`;
}
