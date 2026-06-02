import type { MembershipTier } from "@/types";

export default function MembershipBadge({ tier }: { tier: MembershipTier }) {
  if (tier === "founding") {
    return (
      <span className="text-[10px] tracking-widest uppercase font-poppins border border-[#c0392b] text-[#c0392b] px-2 py-0.5">
        Founding
      </span>
    );
  }
  if (tier === "paid") {
    return (
      <span className="text-[10px] tracking-widest uppercase font-poppins border border-[rgba(240,235,224,0.4)] text-[rgba(240,235,224,0.4)] px-2 py-0.5">
        Member
      </span>
    );
  }
  return (
    <span className="text-[10px] tracking-widest uppercase font-poppins text-[rgba(240,235,224,0.2)]">
      Free
    </span>
  );
}
