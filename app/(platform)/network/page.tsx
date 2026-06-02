import StationHeader from "@/components/layout/StationHeader";

export default function NetworkPage() {
  return (
    <div>
      <StationHeader
        number="02"
        name="NETWORK"
        tagline="Meet ambitious people working toward meaningful goals."
      />
      <div className="px-10 py-12">
        <p className="font-playfair italic text-[rgba(var(--fg-rgb),0.2)]" style={{ fontSize: "15px" }}>
          Member directory coming soon.
        </p>
      </div>
    </div>
  );
}
