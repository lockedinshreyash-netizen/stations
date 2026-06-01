import type { UserCategory } from "@/types";

const ROLE_CATEGORY_MAP: Record<string, UserCategory> = {
  founder: "Builder",
  developer: "Builder",
  designer: "Builder",
  creator: "Creator",
  athlete: "Athlete",
  student: "Scholar",
};

const GOAL_CATEGORY_MAP: Record<string, UserCategory> = {
  "build a product": "Builder",
  "ship a project": "Builder",
  "grow an audience": "Creator",
  "get fit": "Athlete",
  "academic excellence": "Scholar",
  "learn a skill": "Scholar",
};

export function categorizeUser(roles: string[], goals: string[]): UserCategory {
  for (const role of roles) {
    const category = ROLE_CATEGORY_MAP[role];
    if (category) return category;
  }

  for (const goal of goals) {
    const category = GOAL_CATEGORY_MAP[goal];
    if (category) return category;
  }

  return "Grinder";
}
