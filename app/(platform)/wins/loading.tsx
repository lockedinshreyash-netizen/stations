/**
 * Wins-specific loading state: branded shimmer skeleton cards instead of a
 * blank screen, so navigating into the feed feels instant. Overrides the
 * generic platform loader for this route.
 */
function SkeletonCard() {
  return (
    <div
      className="st-card flex flex-col"
      style={{
        padding: "22px 24px",
        background: "var(--bg-surface)",
        border: "0.5px solid rgba(var(--fg-rgb),0.08)",
        gap: "12px",
      }}
    >
      <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
        <div className="st-shimmer" style={{ width: "90px", height: "14px", borderRadius: "6px" }} />
        <div className="st-shimmer" style={{ width: "60px", height: "12px", borderRadius: "6px" }} />
      </div>
      <div className="st-shimmer" style={{ width: "70%", height: "22px", borderRadius: "8px" }} />
      <div className="st-shimmer" style={{ width: "100%", height: "14px", borderRadius: "6px" }} />
      <div className="st-shimmer" style={{ width: "85%", height: "14px", borderRadius: "6px" }} />
      <div style={{ display: "flex", gap: "8px", marginTop: "6px" }}>
        {[44, 44, 44, 44, 44].map((w, i) => (
          <div key={i} className="st-shimmer" style={{ width: w, height: "30px", borderRadius: "8px" }} />
        ))}
      </div>
    </div>
  );
}

export default function Loading() {
  return (
    <div
      aria-busy="true"
      aria-label="Loading wins"
      style={{
        display: "flex",
        flexDirection: "column",
        gap: "16px",
        padding: "20px",
        maxWidth: "640px",
        margin: "0 auto",
      }}
    >
      {[0, 1, 2, 3].map((i) => (
        <SkeletonCard key={i} />
      ))}
    </div>
  );
}
