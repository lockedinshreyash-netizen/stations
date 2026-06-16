import type { JourneyCategory, JourneyStage } from "@/types";

/**
 * Shared Journey vocabulary — categories, stages, and a small emoji palette.
 * Kept in one place so the feed, card, modal, and detail stay in sync.
 */

export const JOURNEY_CATEGORIES: {
  value: JourneyCategory;
  label: string;
  emoji: string;
}[] = [
  { value: "startup", label: "Startup", emoji: "🚀" },
  { value: "career", label: "Career", emoji: "💼" },
  { value: "fitness", label: "Fitness", emoji: "🏃" },
  { value: "education", label: "Education", emoji: "📚" },
  { value: "creator", label: "Creator", emoji: "🎥" },
  { value: "project", label: "Project", emoji: "🛠️" },
  { value: "business", label: "Business", emoji: "💰" },
  { value: "other", label: "Other", emoji: "✨" },
];

export const JOURNEY_STAGES: { value: JourneyStage; label: string }[] = [
  { value: "researching", label: "Researching" },
  { value: "learning", label: "Learning" },
  { value: "building", label: "Building" },
  { value: "applying", label: "Applying" },
  { value: "growing", label: "Growing" },
];

/** A compact palette for the create/edit emoji picker. */
export const JOURNEY_EMOJIS = [
  "🚀", "💼", "🏃", "📚", "🎥", "🛠️", "💰", "✨",
  "🎯", "🧠", "💪", "🎨", "📈", "🏆", "🔥", "🌱",
  "⚡", "🧩", "🎓", "💡", "📝", "🩺", "⚖️", "🎵",
];

export function categoryLabel(value: JourneyCategory): string {
  return JOURNEY_CATEGORIES.find((c) => c.value === value)?.label ?? "Other";
}

export function stageLabel(value: JourneyStage): string {
  return JOURNEY_STAGES.find((s) => s.value === value)?.label ?? value;
}
