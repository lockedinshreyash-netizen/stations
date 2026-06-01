import StationHeader from "@/components/layout/StationHeader";

export default function WorkPage() {
  return (
    <div>
      <StationHeader
        number="04"
        name="WORK"
        tagline="Live sessions. Build with other people in real time."
      />
      <div className="px-10 py-12">
        <p className="font-playfair italic text-[rgba(var(--fg-rgb),0.2)]" style={{ fontSize: "15px" }}>
          Sessions coming soon.
        </p>
      </div>
    </div>
  );
}
