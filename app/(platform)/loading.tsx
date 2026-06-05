/**
 * Route-level loading fallback for every platform page. Next renders this
 * instantly while the destination's server component resolves its data
 * (Supabase fetches), so navigation feels immediate even when the page is slow.
 *
 * Cinematic but light: a pulsing wordmark over an indeterminate brass track.
 */
export default function Loading() {
  return (
    <div className="st-loader" aria-busy="true" aria-label="Loading">
      <div
        className="st-pulse-mark font-poppins"
        style={{ fontSize: "clamp(32px, 8vw, 56px)" }}
      >
        STATIONS<span className="st-dot">.</span>
      </div>
      <div className="st-track" />
    </div>
  );
}
