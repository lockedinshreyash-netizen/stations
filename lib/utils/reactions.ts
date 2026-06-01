import type { ReactionCounts, ReactionType } from "@/types";

export const REACTIONS: { type: ReactionType; emoji: string; label: string }[] = [
  { type: "respect", emoji: "✊", label: "Respect" },
  { type: "fire",    emoji: "🔥", label: "Fire"    },
  { type: "build",   emoji: "⚡", label: "Build"   },
  { type: "focused", emoji: "🎯", label: "Focused" },
  { type: "strong",  emoji: "💪", label: "Strong"  },
];

export const EMPTY_COUNTS: ReactionCounts = {
  respect: 0,
  fire: 0,
  build: 0,
  focused: 0,
  strong: 0,
};

export function getCounts(rc: ReactionCounts | null): ReactionCounts {
  if (!rc) return { ...EMPTY_COUNTS };
  return {
    respect: rc.respect ?? 0,
    fire:    rc.fire    ?? 0,
    build:   rc.build   ?? 0,
    focused: rc.focused ?? 0,
    strong:  rc.strong  ?? 0,
  };
}
