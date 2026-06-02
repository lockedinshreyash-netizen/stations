"use client";

import { useRouter } from "next/navigation";
import { useState, useEffect } from "react";
import type { Step3Data } from "@/lib/validations/onboarding";

const ROLES = [
  { value: "student", label: "Student" },
  { value: "founder", label: "Founder" },
  { value: "creator", label: "Creator" },
  { value: "developer", label: "Developer" },
  { value: "designer", label: "Designer" },
  { value: "athlete", label: "Athlete" },
  { value: "other", label: "Other" },
] as const;

const GOALS = [
  { value: "academic excellence", label: "Academic excellence" },
  { value: "build a product", label: "Build a product" },
  { value: "grow an audience", label: "Grow an audience" },
  { value: "get fit", label: "Get fit" },
  { value: "land a job", label: "Land a job" },
  { value: "learn a skill", label: "Learn a skill" },
  { value: "ship a project", label: "Ship a project" },
  { value: "other", label: "Other" },
] as const;

const AVAILABILITY = ["1–2 hrs/day", "2–4 hrs/day", "4+ hrs/day"] as const;

type RoleValue = (typeof ROLES)[number]["value"];
type GoalValue = (typeof GOALS)[number]["value"];
type AvailabilityValue = (typeof AVAILABILITY)[number];

export default function OnboardingStep3() {
  const router = useRouter();

  const [roles, setRoles] = useState<RoleValue[]>([]);
  const [goals, setGoals] = useState<GoalValue[]>([]);
  const [availability, setAvailability] = useState<AvailabilityValue | null>(null);
  const [roleLimitHit, setRoleLimitHit] = useState(false);
  const [goalLimitHit, setGoalLimitHit] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const ROLE_MAX = 3;
  const GOAL_MAX = 5;

  // Restore from localStorage on back-navigation
  useEffect(() => {
    const saved = localStorage.getItem("onboarding_step3");
    if (saved) {
      const parsed = JSON.parse(saved) as Partial<Step3Data>;
      if (parsed.roles) setRoles(parsed.roles as RoleValue[]);
      if (parsed.goals) setGoals(parsed.goals as GoalValue[]);
      if (parsed.availability) setAvailability(parsed.availability as AvailabilityValue);
    }
  }, []);

  function toggleRole(value: RoleValue) {
    setRoleLimitHit(false);
    setErrors((e) => ({ ...e, roles: "" }));
    if (roles.includes(value)) {
      setRoles(roles.filter((r) => r !== value));
    } else {
      if (roles.length >= ROLE_MAX) { setRoleLimitHit(true); return; }
      setRoles([...roles, value]);
    }
  }

  function toggleGoal(value: GoalValue) {
    setGoalLimitHit(false);
    setErrors((e) => ({ ...e, goals: "" }));
    if (goals.includes(value)) {
      setGoals(goals.filter((g) => g !== value));
    } else {
      if (goals.length >= GOAL_MAX) { setGoalLimitHit(true); return; }
      setGoals([...goals, value]);
    }
  }

  function handleSubmit() {
    const nextErrors: Record<string, string> = {};
    if (roles.length === 0) nextErrors.roles = "Select at least one role";
    if (goals.length === 0) nextErrors.goals = "Select at least one goal";
    if (!availability) nextErrors.availability = "Select availability";
    if (Object.keys(nextErrors).length > 0) { setErrors(nextErrors); return; }

    const data: Step3Data = {
      roles: roles as Step3Data["roles"],
      goals: goals as Step3Data["goals"],
      availability: availability as Step3Data["availability"],
    };
    localStorage.setItem("onboarding_step3", JSON.stringify(data));
    router.push("/onboarding/step-4");
  }

  const atRoleLimit = roles.length >= ROLE_MAX;
  const atGoalLimit = goals.length >= GOAL_MAX;

  return (
    <div className="flex-1 flex flex-col justify-center px-8 py-16 max-w-lg mx-auto w-full">
      <h1 className="font-playfair italic text-4xl md:text-5xl text-[#f0ebe0] mb-3 leading-tight">
        Tell us about yourself.
      </h1>
      <p className="text-[rgba(240,235,224,0.5)] font-light text-lg mb-12">
        This shapes your experience and who you meet inside.
      </p>

      <div className="flex flex-col gap-10">
        {/* Roles — multi-select, max 3 */}
        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <label className="text-[rgba(240,235,224,0.5)] text-xs tracking-widest uppercase font-light">
              I am a —
            </label>
            {roleLimitHit && (
              <span className="text-[rgba(240,235,224,0.4)] text-xs font-light">
                Maximum 3 roles
              </span>
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            {ROLES.map((r) => {
              const selected = roles.includes(r.value);
              const dimmed = atRoleLimit && !selected;
              return (
                <button
                  key={r.value}
                  type="button"
                  onClick={() => toggleRole(r.value)}
                  disabled={dimmed}
                  className={`px-4 py-2 text-sm border transition-colors ${
                    selected
                      ? "bg-[#f0ebe0] text-[#0a0a0a] border-[#f0ebe0]"
                      : dimmed
                      ? "bg-[#1a1a1a] text-[rgba(240,235,224,0.4)] border-[rgba(240,235,224,0.1)] opacity-40 cursor-not-allowed"
                      : "bg-[#1a1a1a] text-[#f0ebe0] border-[rgba(240,235,224,0.2)] hover:border-[rgba(240,235,224,0.5)]"
                  }`}
                >
                  {r.label}
                </button>
              );
            })}
          </div>
          {errors.roles && (
            <span className="text-[#c0392b] text-sm">{errors.roles}</span>
          )}
        </div>

        {/* Goals — multi-select, max 5 */}
        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <label className="text-[rgba(240,235,224,0.5)] text-xs tracking-widest uppercase font-light">
              My goals —
            </label>
            {goalLimitHit && (
              <span className="text-[rgba(240,235,224,0.4)] text-xs font-light">
                Maximum 5 goals
              </span>
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            {GOALS.map((g) => {
              const selected = goals.includes(g.value);
              const dimmed = atGoalLimit && !selected;
              return (
                <button
                  key={g.value}
                  type="button"
                  onClick={() => toggleGoal(g.value)}
                  disabled={dimmed}
                  className={`px-4 py-2 text-sm border transition-colors ${
                    selected
                      ? "bg-[#f0ebe0] text-[#0a0a0a] border-[#f0ebe0]"
                      : dimmed
                      ? "bg-[#1a1a1a] text-[rgba(240,235,224,0.4)] border-[rgba(240,235,224,0.1)] opacity-40 cursor-not-allowed"
                      : "bg-[#1a1a1a] text-[#f0ebe0] border-[rgba(240,235,224,0.2)] hover:border-[rgba(240,235,224,0.5)]"
                  }`}
                >
                  {g.label}
                </button>
              );
            })}
          </div>
          {errors.goals && (
            <span className="text-[#c0392b] text-sm">{errors.goals}</span>
          )}
        </div>

        {/* Availability */}
        <div className="flex flex-col gap-3">
          <label className="text-[rgba(240,235,224,0.5)] text-xs tracking-widest uppercase font-light">
            I can commit —
          </label>
          <div className="flex flex-wrap gap-2">
            {AVAILABILITY.map((a) => {
              const selected = availability === a;
              return (
                <button
                  key={a}
                  type="button"
                  onClick={() => {
                    setAvailability(a);
                    setErrors((e) => ({ ...e, availability: "" }));
                  }}
                  className={`px-4 py-2 text-sm border transition-colors ${
                    selected
                      ? "bg-[#f0ebe0] text-[#0a0a0a] border-[#f0ebe0]"
                      : "bg-[#1a1a1a] text-[#f0ebe0] border-[rgba(240,235,224,0.2)] hover:border-[rgba(240,235,224,0.5)]"
                  }`}
                >
                  {a}
                </button>
              );
            })}
          </div>
          {errors.availability && (
            <span className="text-[#c0392b] text-sm">{errors.availability}</span>
          )}
        </div>

        <button
          type="button"
          onClick={handleSubmit}
          className="bg-[#f0ebe0] text-[#0a0a0a] font-poppins font-black tracking-widest uppercase text-sm px-8 py-4 hover:bg-white transition-colors"
        >
          Continue
        </button>
      </div>

      <button
        type="button"
        onClick={() => router.push("/onboarding/step-2")}
        className="mt-6 text-[rgba(240,235,224,0.3)] text-sm font-light hover:text-[rgba(240,235,224,0.6)] transition-colors text-left"
      >
        ← Back
      </button>
    </div>
  );
}
