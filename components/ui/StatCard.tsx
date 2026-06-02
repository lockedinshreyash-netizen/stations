interface StatCardProps {
  label: string;
  value: string | number;
  unit?: string;
}

export default function StatCard({ label, value, unit }: StatCardProps) {
  return (
    <div className="bg-[#1a1a1a] px-6 py-5 flex flex-col gap-1 min-w-0">
      <span className="text-[rgba(240,235,224,0.3)] text-xs tracking-widest uppercase font-light">
        {label}
      </span>
      <div className="flex items-baseline gap-1.5">
        <span className="text-[#f0ebe0] text-3xl font-black font-poppins leading-none">
          {value}
        </span>
        {unit && (
          <span className="text-[rgba(240,235,224,0.3)] text-xs font-light">{unit}</span>
        )}
      </div>
    </div>
  );
}
