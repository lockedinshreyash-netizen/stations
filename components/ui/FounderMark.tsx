/**
 * The Founding Cohort marker — a small accent ◆ shown next to a founder's name
 * anywhere people appear (member lists, chat, etc.) so non-founders can see who
 * the founders are. Renders nothing for non-founders.
 */
export default function FounderMark({
  founderNumber,
}: {
  founderNumber?: number | null;
}) {
  if (!founderNumber) return null;
  const label = `Founding Cohort · No. ${String(founderNumber).padStart(3, "0")}`;
  return (
    <span
      title={label}
      aria-label={label}
      className="shrink-0 leading-none"
      style={{ color: "var(--accent)", fontSize: "9px" }}
    >
      ◆
    </span>
  );
}
