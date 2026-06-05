interface StationHeaderProps {
  number: string;
  name: string;
  tagline?: string;
}

export default function StationHeader({ number, name, tagline }: StationHeaderProps) {
  return (
    <div className="relative overflow-hidden px-5 md:px-10 pt-7 pb-5 md:pt-9 md:pb-6 border-b border-[rgba(var(--fg-rgb),0.06)]">
      {/* Oversized station number — supergraphic layered in front, very faint */}
      <span
        aria-hidden
        className="pointer-events-none select-none absolute font-poppins font-black leading-none"
        style={{
          top: "-0.18em",
          right: "0.04em",
          fontSize: "clamp(180px, 26vw, 380px)",
          color: "rgba(var(--fg-rgb),0.05)",
          letterSpacing: "-0.02em",
          zIndex: 20,
        }}
      >
        {number}
      </span>

      {/* Foreground content */}
      <div className="relative z-10">
        {/* Eyebrow — brass, tight to the headline */}
        <p
          className="font-playfair italic text-[rgba(var(--accent-2-rgb),0.55)]"
          style={{ fontSize: "15px", marginBottom: "2px" }}
        >
          {number} —
        </p>

        {/* Station name — scales down on mobile. Tight leading + negative
            tracking so big display type reads confident, not sprawling. */}
        <style>{`
          .station-name { font-size: clamp(96px, 12vw, 140px); }
          @media (max-width: 767px) {
            .station-name { font-size: clamp(48px, 12vw, 72px); }
          }
        `}</style>
        <h1
          className="station-name font-poppins font-black uppercase text-[rgb(var(--fg-rgb))]"
          style={{ letterSpacing: "-0.025em", lineHeight: 0.84 }}
        >
          {name}
        </h1>

        {/* Tagline — asymmetric: indented into a narrow column, sitting
            close under the headline rather than floating far below. */}
        {tagline && (
          <p
            className="font-playfair italic text-[rgba(var(--fg-rgb),0.4)] mt-3 md:mt-4 max-w-md"
            style={{ fontSize: "19px", lineHeight: 1.45 }}
          >
            {tagline}
          </p>
        )}
      </div>
    </div>
  );
}
