import StationHeader from "@/components/layout/StationHeader";

export default function FocusPage() {
  return (
    <div>
      <StationHeader
        number="05"
        name="FOCUS"
        tagline="Deep work. No chat. No distractions. Just output."
      />
      <div className="px-10 py-12">
        <p className="font-playfair italic text-[rgba(240,235,224,0.2)]" style={{ fontSize: "15px" }}>
          Focus rooms coming soon.
        </p>
      </div>
    </div>
  );
}
