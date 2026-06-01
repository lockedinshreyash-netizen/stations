"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { step4Schema, type Step4Data } from "@/lib/validations/onboarding";
import { categorizeUser } from "@/lib/utils/categorize";

// MIGRATION NOTE: users.role must be text[] in Supabase.
// If originally created as text, run in SQL editor:
//   ALTER TABLE users ALTER COLUMN role TYPE text[] USING ARRAY[role];

async function getSessionUser() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (user) return user;
  const { data } = await supabase.auth.refreshSession();
  return data.session?.user ?? null;
}

export default function OnboardingStep4() {
  const router = useRouter();
  const [serverError, setServerError] = useState("");
  const [loading, setLoading] = useState(false);

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<Step4Data>({ resolver: zodResolver(step4Schema) });

  const whyJoin = watch("why_join") ?? "";

  async function onSubmit(data: Step4Data) {
    setLoading(true);
    setServerError("");

    const supabase = createClient();
    const user = await getSessionUser();

    if (!user) {
      setServerError("Session expired. Please start over at step 1.");
      setLoading(false);
      return;
    }

    const step2Raw = localStorage.getItem("onboarding_step2");
    const step3Raw = localStorage.getItem("onboarding_step3");

    if (!step2Raw || !step3Raw) {
      setServerError("Onboarding data missing. Please start over.");
      setLoading(false);
      return;
    }

    const step2 = JSON.parse(step2Raw);
    const step3 = JSON.parse(step3Raw);

    const roles: string[] = step3.roles ?? [];
    const goals: string[] = step3.goals ?? [];
    const category = categorizeUser(roles, goals);

    const { error: userError } = await supabase.from("users").insert({
      id: user.id,
      username: step2.username,
      full_name: step2.full_name,
      avatar_url: step2.avatar_url ?? null,
      role: roles,           // text[] — see migration note above
      goals,
      category,
      status: "active",
      membership_tier: "free",
      is_admin: false,
      total_focus_minutes: 0,
      total_sessions: 0,
      streak_days: 0,
    });

    if (userError) {
      setServerError("Failed to create profile: " + userError.message);
      setLoading(false);
      return;
    }

    const { error: appError } = await supabase.from("applications").insert({
      user_id: user.id,
      why_join: data.why_join,
      goals_declaration: goals.join(", "),
      role: roles.join(", "),
      status: "approved",
    });

    if (appError) {
      console.error("Application insert failed:", appError.message);
    }

    localStorage.removeItem("onboarding_email");
    localStorage.removeItem("onboarding_uid");
    localStorage.removeItem("onboarding_step2");
    localStorage.removeItem("onboarding_step3");

    router.push("/login?success=true");
  }

  return (
    <div className="flex-1 flex flex-col justify-center px-8 py-16 max-w-lg mx-auto w-full">
      <h1 className="font-playfair italic text-4xl md:text-5xl text-[rgb(var(--fg-rgb))] mb-3 leading-tight">
        Why do you want in?
      </h1>
      <p className="text-[rgba(var(--fg-rgb),0.5)] font-light text-lg mb-12">
        Be honest. This is for you as much as it is for us.
      </p>

      <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-6">
        <div className="flex flex-col gap-2">
          <textarea
            {...register("why_join")}
            rows={6}
            className="bg-[var(--bg-surface)] text-[rgb(var(--fg-rgb))] px-4 py-4 text-base outline-none border border-[rgba(var(--fg-rgb),0.1)] focus:border-[var(--accent)] transition-colors placeholder:text-[rgba(var(--fg-rgb),0.2)] resize-none leading-relaxed"
            placeholder="What are you here to build, achieve, or become? What does ambition mean to you right now?"
          />
          <div className="flex justify-between items-center">
            {errors.why_join ? (
              <span className="text-[var(--accent)] text-sm">{errors.why_join.message}</span>
            ) : (
              <span />
            )}
            <span
              className={`text-sm font-light ${
                whyJoin.length >= 50
                  ? "text-[rgba(var(--fg-rgb),0.5)]"
                  : "text-[rgba(var(--fg-rgb),0.2)]"
              }`}
            >
              {whyJoin.length} / 50 min
            </span>
          </div>
        </div>

        {serverError && <p className="text-[var(--accent)] text-sm">{serverError}</p>}

        <button
          type="submit"
          disabled={loading}
          className="mt-4 bg-[rgb(var(--fg-rgb))] text-[var(--bg-primary)] font-poppins font-black tracking-widest uppercase text-sm px-8 py-4 hover:bg-white transition-colors disabled:opacity-40"
        >
          {loading ? "Joining Stations…" : "Join Stations"}
        </button>
      </form>

      <button
        type="button"
        onClick={() => router.push("/onboarding/step-3")}
        className="mt-6 text-[rgba(var(--fg-rgb),0.3)] text-sm font-light hover:text-[rgba(var(--fg-rgb),0.6)] transition-colors text-left"
      >
        ← Back
      </button>
    </div>
  );
}
