import { dayLabel } from "@/lib/utils/dayLabel";

/**
 * Centered day divider for chat surfaces (WhatsApp-style). Renders a small
 * brass-tinted pill with the day label, flanked by hairlines.
 */
export default function DateSeparator({ date }: { date: string | Date }) {
  const d = typeof date === "string" ? new Date(date) : date;
  return (
    <div
      className="flex items-center gap-3 select-none"
      style={{ margin: "10px auto", maxWidth: "420px", width: "100%" }}
      aria-hidden="true"
    >
      <span style={{ flex: 1, height: "0.5px", background: "rgba(var(--fg-rgb),0.1)" }} />
      <span
        className="font-poppins uppercase"
        style={{
          fontSize: "11px",
          letterSpacing: "0.14em",
          color: "rgba(var(--accent-2-rgb),0.8)",
          background: "rgba(var(--accent-2-rgb),0.08)",
          border: "0.5px solid rgba(var(--accent-2-rgb),0.2)",
          padding: "4px 12px",
          borderRadius: "9999px",
          whiteSpace: "nowrap",
        }}
      >
        {dayLabel(d)}
      </span>
      <span style={{ flex: 1, height: "0.5px", background: "rgba(var(--fg-rgb),0.1)" }} />
    </div>
  );
}
