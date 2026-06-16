/**
 * Value-first onboarding funnel state.
 *
 * The new funnel personalizes BEFORE asking for an account: roles, goals and
 * availability are collected anonymously in /join and held in localStorage,
 * then hydrated into the user's profile the moment they authenticate
 * (/onboarding/complete). Nothing here touches Supabase — there is no user row
 * yet at this stage.
 */

export const ROLES = [
  { value: "student", label: "Student" },
  { value: "founder", label: "Founder" },
  { value: "creator", label: "Creator" },
  { value: "developer", label: "Developer" },
  { value: "designer", label: "Designer" },
  { value: "athlete", label: "Athlete" },
  { value: "other", label: "Other" },
] as const;

export const GOALS = [
  { value: "academic excellence", label: "Academic excellence" },
  { value: "build a product", label: "Build a product" },
  { value: "grow an audience", label: "Grow an audience" },
  { value: "get fit", label: "Get fit" },
  { value: "land a job", label: "Land a job" },
  { value: "learn a skill", label: "Learn a skill" },
  { value: "ship a project", label: "Ship a project" },
  { value: "other", label: "Other" },
] as const;

export const AVAILABILITY = ["1–2 hrs/day", "2–4 hrs/day", "4+ hrs/day"] as const;

export const ROLE_MAX = 3;
export const GOAL_MAX = 5;

export type RoleValue = (typeof ROLES)[number]["value"];
export type GoalValue = (typeof GOALS)[number]["value"];
export type AvailabilityValue = (typeof AVAILABILITY)[number];

export interface FunnelState {
  roles: RoleValue[];
  goals: GoalValue[];
  availability: AvailabilityValue | null;
}

const KEY = "stations_join";

// A founder code carried in from the waitlist deep link (APP_URL/join?code=…).
// Kept separate from the typed funnel state so it survives the quiz, the OAuth
// round-trip, and signup, then auto-applies at the plan step.
const FOUNDER_CODE_KEY = "stations_founder_code";

const EMPTY: FunnelState = { roles: [], goals: [], availability: null };

export function loadFunnel(): FunnelState {
  if (typeof window === "undefined") return { ...EMPTY };
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return { ...EMPTY };
    const parsed = JSON.parse(raw) as Partial<FunnelState>;
    return {
      roles: Array.isArray(parsed.roles) ? (parsed.roles as RoleValue[]) : [],
      goals: Array.isArray(parsed.goals) ? (parsed.goals as GoalValue[]) : [],
      availability: parsed.availability ?? null,
    };
  } catch {
    return { ...EMPTY };
  }
}

export function saveFunnel(state: FunnelState) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(KEY, JSON.stringify(state));
  } catch {}
}

export function clearFunnel() {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(KEY);
  } catch {}
}

/** True once the anonymous quiz has enough to personalize + create a profile. */
export function isFunnelComplete(s: FunnelState): boolean {
  return s.roles.length > 0 && s.goals.length > 0 && s.availability !== null;
}

/** Stash a waitlist founder code so it auto-applies at the plan step. */
export function saveFounderCode(code: string) {
  if (typeof window === "undefined") return;
  const normalized = code.trim().toUpperCase();
  if (!normalized) return;
  try {
    window.localStorage.setItem(FOUNDER_CODE_KEY, normalized);
  } catch {}
}

/** Read a carried founder code (normalized), or null if none is stashed. */
export function loadFounderCode(): string | null {
  if (typeof window === "undefined") return null;
  try {
    const v = window.localStorage.getItem(FOUNDER_CODE_KEY);
    return v ? v.trim().toUpperCase() : null;
  } catch {
    return null;
  }
}

export function clearFounderCode() {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(FOUNDER_CODE_KEY);
  } catch {}
}
