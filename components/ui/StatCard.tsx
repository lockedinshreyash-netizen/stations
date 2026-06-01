interface StatCardProps {
  label: string;
  value: string | number;
  unit?: string;
}

export default function StatCard({ label, value, unit }: StatCardProps) {
  return (
    <div className="bg-[var(--bg-surface)] px-6 py-5 flex flex-col gap-1 min-w-0">
      <span className="text-[rgba(var(--fg-rgb),0.3)] text-xs tracking-widest uppercase font-light">
        {label}
      </span>
      <div className="flex items-baseline gap-1.5">
        <span className="text-[rgb(var(--fg-rgb))] text-3xl font-black font-poppins leading-none">
          {value}
        </span>
        {unit && (
          <span className="text-[rgba(var(--fg-rgb),0.3)] text-xs font-light">{unit}</span>
        )}
      </div>
    </div>
  );
}
