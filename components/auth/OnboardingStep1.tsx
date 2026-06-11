"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { step1Schema, type Step1Data } from "@/lib/validations/onboarding";

export default function OnboardingStep1() {
  const router = useRouter();
  const [serverError, setServerError] = useState("");
  const [loading, setLoading] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<Step1Data>({ resolver: zodResolver(step1Schema) });

  async function onSubmit(data: Step1Data) {
    setLoading(true);
    setServerError("");
    const supabase = createClient();

    const { data: signUpData, error } = await supabase.auth.signUp({
      email: data.email,
      password: data.password,
    });

    if (error) {
      setServerError(error.message);
      setLoading(false);
      return;
    }

    // The remaining onboarding steps (profile, founder-code claim, profile
    // creation) all require an ACTIVE session. If email confirmation is enabled
    // in Supabase, signUp returns a user but NO session — proceeding would
    // dead-end at the final step with "Session expired". Detect that and route
    // them to confirm + sign in instead; after login, the platform redirects an
    // account with no profile straight back into onboarding (step-2), so their
    // progress resumes cleanly with a real session.
    if (!signUpData.session) {
      setServerError(
        "Check your inbox to confirm your email, then sign in to finish setting up."
      );
      setLoading(false);
      return;
    }

    const userId = signUpData.session.user.id;
    localStorage.setItem("onboarding_email", data.email);
    localStorage.setItem("onboarding_uid", userId);
    router.push("/onboarding/step-2");
  }

  return (
    <div className="flex-1 flex flex-col justify-center px-6 md:px-8 py-16 max-w-lg mx-auto w-full">
      <h1 className="font-playfair italic text-4xl md:text-5xl text-[rgb(var(--fg-rgb))] mb-3 leading-tight">
        Create your account.
      </h1>
      <p className="text-[rgba(var(--fg-rgb),0.5)] font-light text-lg mb-12">
        The first step into a room that takes ambition seriously.
      </p>

      <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-6">
        <div className="flex flex-col gap-2">
          <label className="text-[rgba(var(--fg-rgb),0.5)] text-sm tracking-widest uppercase font-light">
            Email
          </label>
          <input
            {...register("email")}
            type="email"
            autoComplete="email"
            className="st-field bg-[var(--bg-surface)] text-[rgb(var(--fg-rgb))] px-4 py-4 text-base outline-none border border-[rgba(var(--fg-rgb),0.1)] focus:border-[var(--accent)] placeholder:text-[rgba(var(--fg-rgb),0.2)]"
            placeholder="you@example.com"
          />
          {errors.email && (
            <span className="text-[var(--accent)] text-base">{errors.email.message}</span>
          )}
        </div>

        <div className="flex flex-col gap-2">
          <label className="text-[rgba(var(--fg-rgb),0.5)] text-sm tracking-widest uppercase font-light">
            Password
          </label>
          <input
            {...register("password")}
            type="password"
            autoComplete="new-password"
            className="st-field bg-[var(--bg-surface)] text-[rgb(var(--fg-rgb))] px-4 py-4 text-base outline-none border border-[rgba(var(--fg-rgb),0.1)] focus:border-[var(--accent)] placeholder:text-[rgba(var(--fg-rgb),0.2)]"
            placeholder="Min. 8 characters"
          />
          {errors.password && (
            <span className="text-[var(--accent)] text-base">{errors.password.message}</span>
          )}
        </div>

        {serverError && <p className="text-[var(--accent)] text-base">{serverError}</p>}

        <button
          type="submit"
          disabled={loading}
          className="st-btn mt-4 bg-[rgb(var(--fg-rgb))] text-[var(--bg-primary)] font-poppins font-black tracking-widest uppercase text-base px-8 py-4 hover:bg-white disabled:opacity-40"
        >
          {loading ? "Creating account…" : "Continue"}
        </button>
      </form>

      <p className="mt-8 text-[rgba(var(--fg-rgb),0.3)] text-base font-light">
        Already have an account?{" "}
        <a href="/login" className="text-[rgb(var(--fg-rgb))] underline underline-offset-4">
          Sign in
        </a>
      </p>
    </div>
  );
}
