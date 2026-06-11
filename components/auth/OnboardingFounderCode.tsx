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
 * MANDATORY founder-code step (Founding 100 launch gate). Entry to Stations is
 * code-only: a valid, unclaimed waitlist code is required to continue. There is
 * no skip or bypass path. We VALIDATE here (read-only) and stash the code — the
 * atomic claim happens in OnboardingStep4 — and the platform layout
 * independently refuses access to any account that is not a founding member,
 * so a forged localStorage value cannot get anyone in.
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
      // Surface transient check failures as "invalid" so Continue stays locked —
      // the gate must fail closed, never open.
      setCheck({ kind: "invalid" });
      return;
    }
    setCheck({ kind: data === true ? "valid" : "invalid" });
  }

  async function goNext() {
    if (!normalized) return;
    // Re-validate on submit so the button can't be enabled against a stale
    // "valid" state, then carry the code forward to the atomic claim in step-4.
    setCheck({ kind: "checking" });
    const supabase = createClient();
    const { data, error } = await supabase.rpc("founder_code_available", {
      code: normalized,
    });
    if (error || data !== true) {
      setCheck({ kind: "invalid" });
      localStorage.removeItem("onboarding_founder_code");
      return;
    }
    localStorage.setItem("onboarding_founder_code", normalized);
    router.push("/onboarding/step-4");
  }

  return (
    <div className="flex-1 flex flex-col justify-center px-6 md:px-8 py-16 max-w-lg mx-auto w-full">
      <h1 className="font-playfair italic text-4xl md:text-5xl text-[rgb(var(--fg-rgb))] mb-3 leading-tight">
        Enter your founder code.
      </h1>
      <p className="text-[rgba(var(--fg-rgb),0.5)] font-light text-lg mb-12">
        Stations is invite-only right now — entry is limited to the first 100
        founders. Your code came with your waitlist spot. It&apos;s your key to
        the room: free premium, forever, and a number that&apos;s yours alone.
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
            <span className="text-[var(--accent)]">
              That code isn&apos;t valid or has already been claimed. Entry
              requires a valid founder code.
            </span>
          )}
        </div>
      </div>

      <div className="flex flex-col gap-4 mt-8">
        <button
          type="button"
          onClick={goNext}
          disabled={check.kind === "checking" || !normalized}
          className="st-btn bg-[rgb(var(--fg-rgb))] text-[var(--bg-primary)] font-poppins font-black tracking-widest uppercase text-base px-8 py-4 hover:bg-white disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {check.kind === "checking" ? "Checking…" : "Continue"}
        </button>
        <p className="text-center text-[rgba(var(--fg-rgb),0.3)] text-sm font-light">
          Don&apos;t have a code?{" "}
          <a
            href="https://lockinstations.space"
            className="underline underline-offset-4 hover:text-[rgba(var(--fg-rgb),0.6)] transition-colors"
          >
            Join the waitlist
          </a>
        </p>
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
