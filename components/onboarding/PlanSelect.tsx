"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { addMember } from "@/lib/firebase/rooms";
import { clearFunnel } from "@/lib/onboarding/funnel";

type CodeState = "idle" | "checking" | "valid" | "invalid";

/**
 * Plan selection — the final step. During the Founding 100 window the ONLY path
 * that unlocks the platform is a valid founder code (claimed atomically via the
 * SECURITY DEFINER RPC). Paid tiers are shown with real pricing but are
 * "activating soon" (Razorpay isn't live yet); Free users are held here with a
 * holding message. The platform layout independently re-checks the tier on
 * every request, so nothing here can be forged into access.
 */
export default function PlanSelect() {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [code, setCode] = useState("");
  const [codeState, setCodeState] = useState<CodeState>("idle");
  const [claiming, setClaiming] = useState(false);
  const [claimError, setClaimError] = useState("");
  const [held, setHeld] = useState(false);

  const normalized = code.trim().toUpperCase();

  useEffect(() => {
    const supabase = createClient();
    (async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        router.replace("/join");
        return;
      }
      const { data: profile } = await supabase
        .from("users")
        .select("membership_tier")
        .eq("id", user.id)
        .maybeSingle();
      if (!profile) {
        router.replace("/onboarding/complete");
        return;
      }
      // Already a founder/paid member — no reason to be here.
      if (profile.membership_tier === "founding" || profile.membership_tier === "paid") {
        router.replace("/wins");
        return;
      }
      setReady(true);
    })();
  }, [router]);

  async function validateCode() {
    if (!normalized) return;
    setCodeState("checking");
    const supabase = createClient();
    const { data, error } = await supabase.rpc("founder_code_available", {
      code: normalized,
    });
    setCodeState(error ? "invalid" : data === true ? "valid" : "invalid");
  }

  async function claim() {
    if (!normalized) return;
    setClaiming(true);
    setClaimError("");
    const supabase = createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      router.replace("/join");
      return;
    }

    // Re-validate then claim atomically (claim is the real arbiter).
    const { data: stillValid } = await supabase.rpc("founder_code_available", {
      code: normalized,
    });
    if (stillValid !== true) {
      setCodeState("invalid");
      setClaiming(false);
      return;
    }

    const { data: founderNumber, error: claimErr } = await supabase.rpc(
      "claim_founder_code",
      { code: normalized }
    );
    if (claimErr || typeof founderNumber !== "number") {
      setClaimError("That code was just claimed by someone else. Try another.");
      setCodeState("invalid");
      setClaiming(false);
      return;
    }

    await addMember("founding", user.id).catch(() => {});
    clearFunnel(); // entering the app for real — the anonymous quiz state is done
    router.push("/wins");
  }

  if (!ready) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[var(--bg-primary)]">
        <span className="text-[rgba(var(--fg-rgb),0.4)] font-light">One moment…</span>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-[var(--bg-primary)]">
      <header className="px-6 md:px-8 pt-8 flex items-center justify-between">
        <span className="font-poppins font-black text-xl tracking-widest uppercase text-[rgb(var(--fg-rgb))]">
          STATIONS
        </span>
        <button
          type="button"
          onClick={() => router.push("/onboarding/complete")}
          className="text-[rgba(var(--fg-rgb),0.3)] text-base font-light hover:text-[rgba(var(--fg-rgb),0.6)] transition-colors"
        >
          ← Back
        </button>
      </header>

      <main className="flex-1 flex flex-col justify-center px-6 md:px-8 py-12 max-w-xl mx-auto w-full">
        <h1 className="font-playfair italic text-4xl md:text-5xl text-[rgb(var(--fg-rgb))] mb-3 leading-tight">
          Choose how you enter.
        </h1>
        <p className="text-[rgba(var(--fg-rgb),0.5)] font-light text-lg mb-10">
          Stations is opening with a founding cohort. Membership pricing goes
          live in a few days — founders get in today.
        </p>

        {/* ── FOUNDER CODE (the way in, right now) ─────────────── */}
        <div className="border border-[var(--accent)] rounded-[var(--radius-sm)] p-6 mb-6">
          <div className="flex items-center justify-between mb-2">
            <span className="font-poppins font-black uppercase tracking-widest text-[rgb(var(--fg-rgb))]">
              Founder code
            </span>
            <span className="font-poppins uppercase tracking-[0.15em] text-xs text-[var(--accent)]">
              Free forever
            </span>
          </div>
          <p className="text-[rgba(var(--fg-rgb),0.5)] font-light text-base mb-5">
            One of the first 100. Full access, a permanent founder number, and no
            bill — ever. Your code came with your waitlist spot.
          </p>

          <input
            value={code}
            onChange={(e) => {
              setCode(e.target.value);
              if (codeState !== "idle") setCodeState("idle");
            }}
            onBlur={validateCode}
            autoComplete="off"
            spellCheck={false}
            placeholder="STN-7F3KQ2"
            className="st-field w-full bg-[var(--bg-surface)] text-[rgb(var(--fg-rgb))] px-4 py-4 text-base tracking-[0.2em] uppercase outline-none border border-[rgba(var(--fg-rgb),0.1)] focus:border-[var(--accent)] placeholder:text-[rgba(var(--fg-rgb),0.2)] placeholder:tracking-normal"
          />
          <div className="min-h-[1.25rem] text-base font-light mt-2">
            {codeState === "checking" && (
              <span className="text-[rgba(var(--fg-rgb),0.4)]">Checking…</span>
            )}
            {codeState === "valid" && (
              <span className="text-[var(--accent)]">✓ Valid — you’re in the Founding Cohort.</span>
            )}
            {codeState === "invalid" && (
              <span className="text-[var(--accent)]">
                {claimError || "That code isn’t valid or has already been claimed."}
              </span>
            )}
          </div>

          <button
            type="button"
            onClick={claim}
            disabled={claiming || !normalized}
            className="st-btn mt-3 w-full bg-[rgb(var(--fg-rgb))] text-[var(--bg-primary)] font-poppins font-black tracking-widest uppercase text-base px-8 py-4 hover:bg-white disabled:opacity-40"
          >
            {claiming ? "Claiming…" : "Enter as a Founder"}
          </button>
        </div>

        {/* ── PAID (coming soon) — annual is the deal, pitched on maths ── */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
          <PlanCard
            name="Monthly"
            price="₹99"
            unit="/ month"
            note="Month to month."
            sub="Comes to ₹1,188 over a year."
          />
          <PlanCard
            name="Annual"
            price="₹999"
            unit="/ year"
            badge="Save ₹189"
            note="That’s ₹83/month — under ₹3 a day."
            sub="₹189 cheaper than paying monthly. Same full access."
            highlight
          />
        </div>
        <p className="text-center text-[rgba(var(--fg-rgb),0.35)] font-light text-sm mb-10">
          Paid membership activates in a few days. We’ll email you the moment it
          opens.
        </p>

        {/* ── FREE / HOLD ──────────────────────────────────────── */}
        {held ? (
          <div
            className="font-poppins font-light text-[rgb(var(--fg-rgb))] text-center"
            style={{
              fontSize: "15px",
              padding: "16px",
              background: "rgba(var(--accent-rgb),0.08)",
              borderLeft: "2px solid var(--accent)",
            }}
          >
            You’re on the list. The moment doors open beyond the founding cohort,
            you’ll be the first to know. Got a code? Enter it above to skip the
            line.
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setHeld(true)}
            className="text-center text-[rgba(var(--fg-rgb),0.4)] text-base font-light hover:text-[rgba(var(--fg-rgb),0.7)] transition-colors"
          >
            I’ll wait for doors to open →
          </button>
        )}
      </main>
    </div>
  );
}

function PlanCard({
  name,
  price,
  unit,
  note,
  sub,
  badge,
  highlight,
}: {
  name: string;
  price: string;
  unit: string;
  note: string;
  sub?: string;
  badge?: string;
  highlight?: boolean;
}) {
  return (
    <div
      className="rounded-[var(--radius-sm)] p-5 border flex flex-col"
      style={{
        borderColor: highlight ? "var(--accent)" : "rgba(var(--fg-rgb),0.15)",
        background: highlight ? "rgba(var(--accent-rgb),0.06)" : "var(--bg-surface)",
        opacity: highlight ? 1 : 0.6,
      }}
    >
      <div className="flex items-center justify-between mb-2">
        <span
          className={`font-poppins font-medium ${
            highlight ? "text-[rgb(var(--fg-rgb))]" : "text-[rgba(var(--fg-rgb),0.7)]"
          }`}
        >
          {name}
        </span>
        {badge ? (
          <span className="font-poppins font-medium uppercase tracking-[0.1em] text-[10px] text-[var(--bg-primary)] bg-[var(--accent)] rounded-full px-2 py-0.5">
            {badge}
          </span>
        ) : (
          <span className="font-poppins uppercase tracking-[0.12em] text-[10px] text-[rgba(var(--fg-rgb),0.4)] border border-[rgba(var(--fg-rgb),0.2)] rounded-full px-2 py-0.5">
            Soon
          </span>
        )}
      </div>
      <div className="flex items-baseline gap-1">
        <span
          className={`font-playfair text-[rgb(var(--fg-rgb))] ${
            highlight ? "text-4xl" : "text-3xl"
          }`}
        >
          {price}
        </span>
        <span className="text-[rgba(var(--fg-rgb),0.4)] font-light text-sm">{unit}</span>
      </div>
      <p
        className={`font-light text-sm mt-2 ${
          highlight ? "text-[rgb(var(--fg-rgb))]" : "text-[rgba(var(--fg-rgb),0.4)]"
        }`}
      >
        {note}
      </p>
      {sub && (
        <p className="text-[rgba(var(--fg-rgb),0.4)] font-light text-xs mt-1">{sub}</p>
      )}
    </div>
  );
}
