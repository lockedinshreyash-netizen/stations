import StationHeader from "@/components/layout/StationHeader";

export default function ArchivePage() {
  return (
    <div>
      <StationHeader
        number="03"
        name="ARCHIVE"
        tagline="Ideas, frameworks, and resources curated for people who build."
      />
      <div className="px-10 py-12">
        <p className="font-playfair italic text-[rgba(var(--fg-rgb),0.2)]" style={{ fontSize: "15px" }}>
          Resources coming soon.
        </p>
      </div>
    </div>
  );
}
