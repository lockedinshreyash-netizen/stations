"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { categorizeUser } from "@/lib/utils/categorize";
import GoogleButton from "@/components/onboarding/GoogleButton";
import LegalFooter from "@/components/legal/LegalFooter";
import {
  ROLES,
  GOALS,
  AVAILABILITY,
  ROLE_MAX,
  GOAL_MAX,
  loadFunnel,
  saveFunnel,
  saveFounderCode,
  type FunnelState,
  type RoleValue,
  type GoalValue,
  type AvailabilityValue,
} from "@/lib/onboarding/funnel";

type Step = "intro" | "roles" | "goals" | "intensity" | "reveal" | "auth";

const ORDER: Step[] = ["intro", "roles", "goals", "intensity", "reveal", "auth"];

// Rooms a category unlocks (mirrors the onboarding profile-creation logic).
const CATEGORY_ROOMS: Record<string, string[]> = {
  Scholar: ["Collective", "Scholar"],
  Builder: ["Collective", "Builder"],
  Creator: ["Collective", "Creator"],
  Athlete: ["Collective", "Athlete"],
  Grinder: ["Collective"],
};

export default function JoinFlow({ initialCode }: { initialCode?: string }) {
  const [step, setStep] = useState<Step>("intro");
  const [state, setState] = useState<FunnelState>({
    roles: [],
    goals: [],
    availability: null,
  });
  const [limit, setLimit] = useState<"role" | "goal" | null>(null);

  // Restore any in-progress answers (e.g. back/refresh during the funnel).
  // Read localStorage after mount (off the synchronous effect body) so the
  // first render matches SSR and we don't trip the no-sync-setState rule.
  useEffect(() => {
    let cancelled = false;
    Promise.resolve().then(() => {
      if (!cancelled) setState(loadFunnel());
    });
    return () => {
      cancelled = true;
    };
  }, []);

  // A founder code carried in from the waitlist (?code=…) is stashed now so it
  // survives the quiz, the OAuth round-trip, and signup — then auto-applies at
  // the plan step. We don't touch the URL or the visible flow here.
  useEffect(() => {
    if (initialCode) saveFounderCode(initialCode);
  }, [initialCode]);

  function patch(next: Partial<FunnelState>) {
    setState((prev) => {
      const merged = { ...prev, ...next };
      saveFunnel(merged);
      return merged;
    });
  }

  function toggleRole(value: RoleValue) {
    setLimit(null);
    if (state.roles.includes(value)) {
      patch({ roles: state.roles.filter((r) => r !== value) });
    } else if (state.roles.length >= ROLE_MAX) {
      setLimit("role");
    } else {
      patch({ roles: [...state.roles, value] });
    }
  }

  function toggleGoal(value: GoalValue) {
    setLimit(null);
    if (state.goals.includes(value)) {
      patch({ goals: state.goals.filter((g) => g !== value) });
    } else if (state.goals.length >= GOAL_MAX) {
      setLimit("goal");
    } else {
      patch({ goals: [...state.goals, value] });
    }
  }

  function go(next: Step) {
    setLimit(null);
    setStep(next);
  }

  const stepIndex = ORDER.indexOf(step);
  const category = categorizeUser(state.roles, state.goals);
  const rooms = CATEGORY_ROOMS[category] ?? ["Collective"];

  return (
    <div className="min-h-screen flex flex-col bg-[var(--bg-primary)]">
      {/* Header — wordmark + thin progress (hidden on the intro) */}
      <header className="px-6 md:px-8 pt-8 flex items-center justify-between">
        <span className="font-poppins font-black text-xl tracking-widest uppercase text-[rgb(var(--fg-rgb))]">
          STATIONS
        </span>
        {step !== "intro" && (
          <button
            type="button"
            onClick={() => go(ORDER[Math.max(0, stepIndex - 1)])}
            className="text-[rgba(var(--fg-rgb),0.3)] text-base font-light hover:text-[rgba(var(--fg-rgb),0.6)] transition-colors"
          >
            ← Back
          </button>
        )}
      </header>

      {step !== "intro" && (
        <div className="px-6 md:px-8 mt-6">
          <div className="flex gap-2">
            {ORDER.slice(1).map((_, i) => (
              <div
                key={i}
                className="h-[3px] flex-1 rounded-full transition-all duration-500"
                style={{
                  background:
                    i < stepIndex ? "var(--accent)" : "rgba(var(--fg-rgb),0.1)",
                }}
              />
            ))}
          </div>
        </div>
      )}

      <main className="flex-1 flex flex-col justify-center px-6 md:px-8 py-12 max-w-lg mx-auto w-full">
        {/* ── INTRO ─────────────────────────────────────────────── */}
        {step === "intro" && (
          <div className="flex flex-col">
            <p className="font-poppins uppercase tracking-[0.2em] text-sm text-[var(--accent)] mb-6">
              By invitation · Founding cohort
            </p>
            <h1 className="font-playfair italic text-5xl md:text-6xl text-[rgb(var(--fg-rgb))] leading-[1.05] mb-5">
              A place for the most ambitious people in India.
            </h1>
            <p className="text-[rgba(var(--fg-rgb),0.55)] font-light text-lg mb-10 leading-relaxed">
              Not an app. An institution — for the ones who take their own
              potential seriously. Take sixty seconds and we’ll build your
              corner of it before you sign anything.
            </p>
            <button
              type="button"
              onClick={() => go("roles")}
              className="st-btn bg-[rgb(var(--fg-rgb))] text-[var(--bg-primary)] font-poppins font-black tracking-widest uppercase text-base px-8 py-4 hover:bg-white"
            >
              Begin
            </button>
            <p className="mt-6 text-[rgba(var(--fg-rgb),0.3)] text-base font-light">
              Already a member?{" "}
              <a
                href="/login"
                className="text-[rgb(var(--fg-rgb))] underline underline-offset-4"
              >
                Sign in
              </a>
            </p>
            <LegalFooter className="mt-10" />
          </div>
        )}

        {/* ── ROLES ─────────────────────────────────────────────── */}
        {step === "roles" && (
          <div className="flex flex-col">
            <h1 className="font-playfair italic text-4xl md:text-5xl text-[rgb(var(--fg-rgb))] mb-3 leading-tight">
              What are you?
            </h1>
            <p className="text-[rgba(var(--fg-rgb),0.5)] font-light text-lg mb-10">
              Pick up to three. This decides who you’ll meet inside.
            </p>
            <div className="flex flex-wrap gap-2">
              {ROLES.map((r) => {
                const selected = state.roles.includes(r.value);
                const dimmed = state.roles.length >= ROLE_MAX && !selected;
                return (
                  <button
                    key={r.value}
                    type="button"
                    onClick={() => toggleRole(r.value)}
                    disabled={dimmed}
                    className={`st-pill px-4 py-2 text-base border ${
                      selected
                        ? "bg-[rgb(var(--fg-rgb))] text-[var(--bg-primary)] border-[rgb(var(--fg-rgb))]"
                        : dimmed
                          ? "bg-[var(--bg-surface)] text-[rgba(var(--fg-rgb),0.4)] border-[rgba(var(--fg-rgb),0.1)] opacity-40 cursor-not-allowed"
                          : "bg-[var(--bg-surface)] text-[rgb(var(--fg-rgb))] border-[rgba(var(--fg-rgb),0.2)] hover:border-[rgba(var(--fg-rgb),0.5)]"
                    }`}
                  >
                    {r.label}
                  </button>
                );
              })}
            </div>
            {limit === "role" && (
              <span className="text-[rgba(var(--fg-rgb),0.4)] text-sm font-light mt-3">
                Three is the max — pick what defines you most.
              </span>
            )}
            <button
              type="button"
              onClick={() => state.roles.length > 0 && go("goals")}
              disabled={state.roles.length === 0}
              className="st-btn mt-10 bg-[rgb(var(--fg-rgb))] text-[var(--bg-primary)] font-poppins font-black tracking-widest uppercase text-base px-8 py-4 hover:bg-white disabled:opacity-40"
            >
              Continue
            </button>
          </div>
        )}

        {/* ── GOALS ─────────────────────────────────────────────── */}
        {step === "goals" && (
          <div className="flex flex-col">
            <h1 className="font-playfair italic text-4xl md:text-5xl text-[rgb(var(--fg-rgb))] mb-3 leading-tight">
              What are you chasing?
            </h1>
            <p className="text-[rgba(var(--fg-rgb),0.5)] font-light text-lg mb-10">
              Up to five. We’ll point you at the people and rooms that fit.
            </p>
            <div className="flex flex-wrap gap-2">
              {GOALS.map((g) => {
                const selected = state.goals.includes(g.value);
                const dimmed = state.goals.length >= GOAL_MAX && !selected;
                return (
                  <button
                    key={g.value}
                    type="button"
                    onClick={() => toggleGoal(g.value)}
                    disabled={dimmed}
                    className={`st-pill px-4 py-2 text-base border ${
                      selected
                        ? "bg-[rgb(var(--fg-rgb))] text-[var(--bg-primary)] border-[rgb(var(--fg-rgb))]"
                        : dimmed
                          ? "bg-[var(--bg-surface)] text-[rgba(var(--fg-rgb),0.4)] border-[rgba(var(--fg-rgb),0.1)] opacity-40 cursor-not-allowed"
                          : "bg-[var(--bg-surface)] text-[rgb(var(--fg-rgb))] border-[rgba(var(--fg-rgb),0.2)] hover:border-[rgba(var(--fg-rgb),0.5)]"
                    }`}
                  >
                    {g.label}
                  </button>
                );
              })}
            </div>
            {limit === "goal" && (
              <span className="text-[rgba(var(--fg-rgb),0.4)] text-sm font-light mt-3">
                Five is plenty — keep it to what you’ll actually act on.
              </span>
            )}
            <button
              type="button"
              onClick={() => state.goals.length > 0 && go("intensity")}
              disabled={state.goals.length === 0}
              className="st-btn mt-10 bg-[rgb(var(--fg-rgb))] text-[var(--bg-primary)] font-poppins font-black tracking-widest uppercase text-base px-8 py-4 hover:bg-white disabled:opacity-40"
            >
              Continue
            </button>
          </div>
        )}

        {/* ── INTENSITY ─────────────────────────────────────────── */}
        {step === "intensity" && (
          <div className="flex flex-col">
            <h1 className="font-playfair italic text-4xl md:text-5xl text-[rgb(var(--fg-rgb))] mb-3 leading-tight">
              How hard will you go?
            </h1>
            <p className="text-[rgba(var(--fg-rgb),0.5)] font-light text-lg mb-10">
              Be honest. We’ll set your rhythm around it.
            </p>
            <div className="flex flex-col gap-3">
              {AVAILABILITY.map((a) => {
                const selected = state.availability === a;
                return (
                  <button
                    key={a}
                    type="button"
                    onClick={() => patch({ availability: a as AvailabilityValue })}
                    className={`st-pill text-left px-5 py-4 text-base border ${
                      selected
                        ? "bg-[rgb(var(--fg-rgb))] text-[var(--bg-primary)] border-[rgb(var(--fg-rgb))]"
                        : "bg-[var(--bg-surface)] text-[rgb(var(--fg-rgb))] border-[rgba(var(--fg-rgb),0.2)] hover:border-[rgba(var(--fg-rgb),0.5)]"
                    }`}
                  >
                    {a}
                  </button>
                );
              })}
            </div>
            <button
              type="button"
              onClick={() => state.availability && go("reveal")}
              disabled={!state.availability}
              className="st-btn mt-10 bg-[rgb(var(--fg-rgb))] text-[var(--bg-primary)] font-poppins font-black tracking-widest uppercase text-base px-8 py-4 hover:bg-white disabled:opacity-40"
            >
              See my Stations
            </button>
          </div>
        )}

        {/* ── REVEAL (the hook) ─────────────────────────────────── */}
        {step === "reveal" && (
          <div className="flex flex-col">
            <p className="font-poppins uppercase tracking-[0.2em] text-sm text-[var(--accent)] mb-4">
              Your category
            </p>
            <h1 className="font-playfair italic text-5xl md:text-6xl text-[rgb(var(--fg-rgb))] leading-[1.05] mb-8">
              You’re a {category}.
            </h1>

            <div className="flex flex-col gap-4 mb-10">
              <RevealRow
                k="Your rooms"
                v={rooms.join(" · ")}
                hint="Live conversations with people on your track"
              />
              <RevealRow
                k="People like you"
                v={`${40 + state.goals.length * 3} ${category}s admitted this season`}
                hint="You won’t be the only one in the room"
              />
              <RevealRow
                k="Built around"
                v={state.goals
                  .slice(0, 3)
                  .map((g) => GOALS.find((x) => x.value === g)?.label ?? g)
                  .join(", ")}
                hint="Your feed and sessions will reflect this"
              />
            </div>

            <p className="text-[rgba(var(--fg-rgb),0.55)] font-light text-lg mb-8 leading-relaxed">
              This is yours the moment you save it. Don’t lose the setup you
              just built.
            </p>

            <button
              type="button"
              onClick={() => go("auth")}
              className="st-btn bg-[rgb(var(--fg-rgb))] text-[var(--bg-primary)] font-poppins font-black tracking-widest uppercase text-base px-8 py-4 hover:bg-white"
            >
              Save my space
            </button>
          </div>
        )}

        {/* ── AUTH ──────────────────────────────────────────────── */}
        {step === "auth" && <AuthStep />}
      </main>
    </div>
  );
}

function RevealRow({ k, v, hint }: { k: string; v: string; hint: string }) {
  return (
    <div className="flex flex-col gap-1 border-l-2 border-[var(--accent)] pl-4 py-1">
      <span className="font-poppins uppercase tracking-[0.15em] text-xs text-[rgba(var(--fg-rgb),0.4)]">
        {k}
      </span>
      <span className="text-[rgb(var(--fg-rgb))] text-lg">{v || "—"}</span>
      <span className="text-[rgba(var(--fg-rgb),0.35)] text-sm font-light">
        {hint}
      </span>
    </div>
  );
}

/**
 * Account creation — deliberately LAST. By here the user has built a
 * personalized space; "save it" converts far better than a cold signup.
 * Google is primary; email/password is the fallback. With email confirmation
 * off, signUp returns a session immediately and we go straight to profile
 * completion. If it's on, we tell them to confirm + sign in.
 */
function AuthStep() {
  const router = useRouter();
  const [mode, setMode] = useState<"choice" | "email">("choice");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [agreed, setAgreed] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  async function signUpEmail(e: React.FormEvent) {
    e.preventDefault();
    if (!agreed) {
      setError("Please agree to the Terms of Service and Privacy Policy to continue.");
      return;
    }
    if (!email || password.length < 8) {
      setError("Enter an email and a password of at least 8 characters.");
      return;
    }
    setLoading(true);
    setError("");
    const supabase = createClient();
    const { data, error: authError } = await supabase.auth.signUp({
      email,
      password,
    });
    if (authError) {
      setError(authError.message);
      setLoading(false);
      return;
    }
    if (!data.session) {
      setNotice(
        "Check your inbox to confirm your email, then sign in to finish — your setup is saved."
      );
      setLoading(false);
      return;
    }
    router.push("/onboarding/complete");
  }

  return (
    <div className="flex flex-col">
      <h1 className="font-playfair italic text-4xl md:text-5xl text-[rgb(var(--fg-rgb))] mb-3 leading-tight">
        Don’t lose your space.
      </h1>
      <p className="text-[rgba(var(--fg-rgb),0.5)] font-light text-lg mb-10">
        Save your setup to your account. Ten seconds.
      </p>

      {notice ? (
        <div
          className="font-poppins font-light text-[rgb(var(--fg-rgb))]"
          style={{
            fontSize: "15px",
            padding: "14px 16px",
            background: "rgba(var(--accent-rgb),0.08)",
            borderLeft: "2px solid var(--accent)",
          }}
        >
          {notice}
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {/* Required legal consent — unchecked by default; gates both Google
              and email sign-up. Required for Play Store compliance. */}
          <label className="flex items-start gap-3 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={agreed}
              onChange={(e) => {
                setAgreed(e.target.checked);
                if (e.target.checked && error) setError("");
              }}
              className="mt-1 h-5 w-5 shrink-0 cursor-pointer accent-[var(--accent)]"
              aria-describedby="legal-consent-text"
            />
            <span
              id="legal-consent-text"
              className="text-[rgba(var(--fg-rgb),0.6)] font-light text-base leading-relaxed"
            >
              I agree to the{" "}
              <a
                href="/terms"
                target="_blank"
                rel="noopener noreferrer"
                className="text-[rgb(var(--fg-rgb))] underline underline-offset-4"
              >
                Terms of Service
              </a>{" "}
              and{" "}
              <a
                href="/privacy"
                target="_blank"
                rel="noopener noreferrer"
                className="text-[rgb(var(--fg-rgb))] underline underline-offset-4"
              >
                Privacy Policy
              </a>
              .
            </span>
          </label>

          <GoogleButton
            next="/onboarding/complete"
            disabled={!agreed}
            onBlockedClick={() =>
              setError(
                "Please agree to the Terms of Service and Privacy Policy to continue."
              )
            }
          />

          {mode === "choice" ? (
            <button
              type="button"
              onClick={() => setMode("email")}
              className="text-[rgba(var(--fg-rgb),0.4)] text-base font-light hover:text-[rgba(var(--fg-rgb),0.7)] transition-colors"
            >
              or continue with email
            </button>
          ) : (
            <form onSubmit={signUpEmail} className="flex flex-col gap-4 mt-2">
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
                placeholder="you@example.com"
                className="st-field bg-[var(--bg-surface)] text-[rgb(var(--fg-rgb))] px-4 py-4 text-base outline-none border border-[rgba(var(--fg-rgb),0.1)] focus:border-[var(--accent)] placeholder:text-[rgba(var(--fg-rgb),0.2)]"
              />
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="new-password"
                placeholder="Password — min. 8 characters"
                className="st-field bg-[var(--bg-surface)] text-[rgb(var(--fg-rgb))] px-4 py-4 text-base outline-none border border-[rgba(var(--fg-rgb),0.1)] focus:border-[var(--accent)] placeholder:text-[rgba(var(--fg-rgb),0.2)]"
              />
              <button
                type="submit"
                disabled={loading || !agreed}
                className="st-btn bg-[rgb(var(--fg-rgb))] text-[var(--bg-primary)] font-poppins font-black tracking-widest uppercase text-base px-8 py-4 hover:bg-white disabled:opacity-40"
              >
                {loading ? "Saving…" : "Save my space"}
              </button>
            </form>
          )}

          {error && <span className="text-[var(--accent)] text-base">{error}</span>}
        </div>
      )}

      <p className="mt-8 text-[rgba(var(--fg-rgb),0.3)] text-base font-light">
        Already a member?{" "}
        <a
          href="/login"
          className="text-[rgb(var(--fg-rgb))] underline underline-offset-4"
        >
          Sign in
        </a>
      </p>
    </div>
  );
}
