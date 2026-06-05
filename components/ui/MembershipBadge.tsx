import type { MembershipTier } from "@/types";

/** Zero-pads a founding number for display: 7 → "007". */
function fmtFounderNo(n: number): string {
  return String(n).padStart(3, "0");
}

export default function MembershipBadge({
  tier,
  founderNumber,
}: {
  tier: MembershipTier;
  founderNumber?: number | null;
}) {
  if (tier === "founding") {
    return (
      <span className="text-[10px] tracking-widest uppercase font-poppins border border-[var(--accent)] text-[var(--accent)] px-2 py-0.5 rounded-full">
        Founding Cohort
        {founderNumber ? ` · No. ${fmtFounderNo(founderNumber)}` : ""}
      </span>
    );
  }
  if (tier === "paid") {
    return (
      <span className="text-[10px] tracking-widest uppercase font-poppins border border-[rgba(var(--fg-rgb),0.4)] text-[rgba(var(--fg-rgb),0.4)] px-2 py-0.5 rounded-full">
        Member
      </span>
    );
  }
  return (
    <span className="text-[10px] tracking-widest uppercase font-poppins text-[rgba(var(--fg-rgb),0.2)]">
      Free
    </span>
  );
}
