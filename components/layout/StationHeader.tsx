interface StationHeaderProps {
  number: string;
  name: string;
  tagline?: string;
}

export default function StationHeader({ number, name, tagline }: StationHeaderProps) {
  return (
    <div className="px-10 border-b border-[rgba(240,235,224,0.06)]" style={{ paddingTop: "64px", paddingBottom: "48px" }}>
      {/* Eyebrow */}
      <p
        className="font-playfair italic text-[rgba(240,235,224,0.4)]"
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
        className="station-name font-poppins font-black uppercase text-[#f0ebe0] leading-none"
        style={{ letterSpacing: "0.03em" }}
      >
        {name}
      </h1>

      {/* Tagline */}
      {tagline && (
        <p
          className="font-playfair italic text-[rgba(240,235,224,0.35)]"
          style={{ fontSize: "17px", lineHeight: 1.6, marginTop: "80px" }}
        >
          {tagline}
        </p>
      )}
    </div>
  );
}
