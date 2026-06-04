import LeafShadow from "@/components/layout/LeafShadow";

interface StationHeaderProps {
  number: string;
  name: string;
  tagline?: string;
}

export default function StationHeader({ number, name, tagline }: StationHeaderProps) {
  return (
    <div className="relative overflow-hidden px-5 md:px-10 pt-12 pb-10 md:pt-16 md:pb-12 border-b border-[rgba(var(--fg-rgb),0.06)]">
      {/* Subtle dappled foliage shadow */}
      <LeafShadow />

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
        {/* Eyebrow */}
        <p
          className="font-playfair italic text-[rgba(var(--fg-rgb),0.4)]"
          style={{ fontSize: "12px", marginBottom: "8px" }}
        >
          {number} —
        </p>

        {/* Station name — scales down on mobile */}
        <style>{`
          .station-name { font-size: clamp(96px, 12vw, 140px); }
          @media (max-width: 767px) {
            .station-name { font-size: clamp(48px, 12vw, 72px); }
          }
        `}</style>
        <h1
          className="station-name font-poppins font-black uppercase text-[rgb(var(--fg-rgb))] leading-none"
          style={{ letterSpacing: "0.03em" }}
        >
          {name}
        </h1>

        {/* Tagline */}
        {tagline && (
          <p
            className="font-playfair italic text-[rgba(var(--fg-rgb),0.35)] mt-12 md:mt-20"
            style={{ fontSize: "17px", lineHeight: 1.6 }}
          >
            {tagline}
          </p>
        )}
      </div>
    </div>
  );
}
