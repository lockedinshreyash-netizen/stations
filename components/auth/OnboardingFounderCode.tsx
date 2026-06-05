"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

type Check =
  | { kind: "idle" }
  | { kind: "checking" }
  | { kind: "valid" }
  | { kind: "invalid" };

/**
 * Optional founder-code step. A valid, unclaimed code from the landing-page
 * waitlist upgrades the new account to the Founding Cohort at the final step.
 * Here we only VALIDATE (read-only) and stash the code — the atomic claim
 * happens in OnboardingStep4 once the user row exists.
 */
export default function OnboardingFounderCode() {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [check, setCheck] = useState<Check>({ kind: "idle" });

  const normalized = code.trim().toUpperCase();

  async function validate() {
    if (!normalized) return;
    setCheck({ kind: "checking" });
    const supabase = createClient();
    const { data, error } = await supabase.rpc("founder_code_available", {
      code: normalized,
    });
    if (error) {
      // Don't hard-block onboarding on a transient check failure; let them
      // continue and the final claim will be the real arbiter.
      setCheck({ kind: "idle" });
      return;
    }
    setCheck({ kind: data === true ? "valid" : "invalid" });
  }

  function goNext() {
    if (normalized && check.kind === "valid") {
      localStorage.setItem("onboarding_founder_code", normalized);
    } else {
      localStorage.removeItem("onboarding_founder_code");
    }
    router.push("/onboarding/step-4");
  }

  return (
    <div className="flex-1 flex flex-col justify-center px-6 md:px-8 py-16 max-w-lg mx-auto w-full">
      <h1 className="font-playfair italic text-4xl md:text-5xl text-[rgb(var(--fg-rgb))] mb-3 leading-tight">
        Have a founder code?
      </h1>
      <p className="text-[rgba(var(--fg-rgb),0.5)] font-light text-lg mb-12">
        One of the first 100? Enter your code to join the Founding Cohort — free
        premium, forever, and a number that&apos;s yours alone. No code? Skip it.
      </p>

      <div className="flex flex-col gap-2">
        <label className="text-[rgba(var(--fg-rgb),0.5)] text-sm tracking-widest uppercase font-light">
          Founder code
        </label>
        <input
          value={code}
          onChange={(e) => {
            setCode(e.target.value);
            if (check.kind !== "idle") setCheck({ kind: "idle" });
          }}
          onBlur={validate}
          autoComplete="off"
          spellCheck={false}
          placeholder="STN-7F3KQ2"
          className="st-field bg-[var(--bg-surface)] text-[rgb(var(--fg-rgb))] px-4 py-4 text-base tracking-[0.2em] uppercase outline-none border border-[rgba(var(--fg-rgb),0.1)] focus:border-[var(--accent)] placeholder:text-[rgba(var(--fg-rgb),0.2)] placeholder:tracking-normal"
        />
        <div className="min-h-[1.25rem] text-base font-light">
          {check.kind === "checking" && (
            <span className="text-[rgba(var(--fg-rgb),0.4)]">Checking…</span>
          )}
          {check.kind === "valid" && (
            <span className="text-[var(--accent)]">
              ✓ Valid code — you&apos;re joining the Founding Cohort.
            </span>
          )}
          {check.kind === "invalid" && (
            <span className="text-[rgba(var(--fg-rgb),0.4)]">
              That code isn&apos;t valid or has already been claimed.
            </span>
          )}
        </div>
      </div>

      <div className="flex flex-col gap-4 mt-8">
        <button
          type="button"
          onClick={goNext}
          className="st-btn bg-[rgb(var(--fg-rgb))] text-[var(--bg-primary)] font-poppins font-black tracking-widest uppercase text-base px-8 py-4 hover:bg-white"
        >
          Continue
        </button>
        <button
          type="button"
          onClick={() => {
            localStorage.removeItem("onboarding_founder_code");
            router.push("/onboarding/step-4");
          }}
          className="text-[rgba(var(--fg-rgb),0.3)] text-base font-light hover:text-[rgba(var(--fg-rgb),0.6)] transition-colors"
        >
          I don&apos;t have a code — skip
        </button>
      </div>

      <button
        type="button"
        onClick={() => router.push("/onboarding/step-3")}
        className="mt-6 text-[rgba(var(--fg-rgb),0.3)] text-base font-light hover:text-[rgba(var(--fg-rgb),0.6)] transition-colors text-left"
      >
        ← Back
      </button>
    </div>
  );
}
