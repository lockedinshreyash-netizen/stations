/**
 * Split-flap / Solari-board style clock. Each digit is a vertical reel of
 * 0–9; changing the value rolls the reel to the new digit with a mechanical
 * ease. Separators (":") render static. Drop-in for a formatted time string.
 */

const L = 1.18; // cell height in em — a little taller than the glyph so nothing clips

function Reel({ digit, color }: { digit: number; color: string }) {
  return (
    <span
      style={{
        display: "inline-block",
        height: `${L}em`,
        width: "0.62em",
        overflow: "hidden",
        verticalAlign: "top",
      }}
    >
      <span
        style={{
          display: "block",
          transform: `translateY(${(-digit * L).toFixed(3)}em)`,
          transition: "transform 0.55s cubic-bezier(0.2, 0.85, 0.2, 1)",
          color,
        }}
      >
        {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => (
          <span
            key={n}
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              height: `${L}em`,
            }}
          >
            {n}
          </span>
        ))}
      </span>
    </span>
  );
}

export default function SplitFlapClock({
  value,
  fontSize,
  color,
  className,
}: {
  value: string;
  fontSize: string;
  color: string;
  className?: string;
}) {
  return (
    <span
      className={className}
      style={{
        display: "inline-flex",
        alignItems: "flex-start",
        fontSize,
        lineHeight: 1,
        fontVariantNumeric: "tabular-nums",
      }}
      aria-label={value}
    >
      {value.split("").map((ch, i) =>
        /\d/.test(ch) ? (
          <Reel key={i} digit={Number(ch)} color={color} />
        ) : (
          <span
            key={i}
            aria-hidden
            style={{ display: "inline-block", padding: "0 0.02em", color }}
          >
            {ch}
          </span>
        )
      )}
    </span>
  );
}
