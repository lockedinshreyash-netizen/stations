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

    // Confirm session is live before proceeding
    const userId = signUpData.user?.id ?? signUpData.session?.user?.id;
    if (!userId) {
      setServerError("Account created but session not established. Please sign in.");
      setLoading(false);
      return;
    }

    localStorage.setItem("onboarding_email", data.email);
    localStorage.setItem("onboarding_uid", userId);
    router.push("/onboarding/step-2");
  }

  return (
    <div className="flex-1 flex flex-col justify-center px-8 py-16 max-w-lg mx-auto w-full">
      <h1 className="font-playfair italic text-4xl md:text-5xl text-[#f0ebe0] mb-3 leading-tight">
        Create your account.
      </h1>
      <p className="text-[rgba(240,235,224,0.5)] font-light text-lg mb-12">
        The first step into a room that takes ambition seriously.
      </p>

      <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-6">
        <div className="flex flex-col gap-2">
          <label className="text-[rgba(240,235,224,0.5)] text-xs tracking-widest uppercase font-light">
            Email
          </label>
          <input
            {...register("email")}
            type="email"
            autoComplete="email"
            className="bg-[#1a1a1a] text-[#f0ebe0] px-4 py-4 text-base outline-none border border-[rgba(240,235,224,0.1)] focus:border-[#c0392b] transition-colors placeholder:text-[rgba(240,235,224,0.2)]"
            placeholder="you@example.com"
          />
          {errors.email && (
            <span className="text-[#c0392b] text-sm">{errors.email.message}</span>
          )}
        </div>

        <div className="flex flex-col gap-2">
          <label className="text-[rgba(240,235,224,0.5)] text-xs tracking-widest uppercase font-light">
            Password
          </label>
          <input
            {...register("password")}
            type="password"
            autoComplete="new-password"
            className="bg-[#1a1a1a] text-[#f0ebe0] px-4 py-4 text-base outline-none border border-[rgba(240,235,224,0.1)] focus:border-[#c0392b] transition-colors placeholder:text-[rgba(240,235,224,0.2)]"
            placeholder="Min. 8 characters"
          />
          {errors.password && (
            <span className="text-[#c0392b] text-sm">{errors.password.message}</span>
          )}
        </div>

        {serverError && <p className="text-[#c0392b] text-sm">{serverError}</p>}

        <button
          type="submit"
          disabled={loading}
          className="mt-4 bg-[#f0ebe0] text-[#0a0a0a] font-poppins font-black tracking-widest uppercase text-sm px-8 py-4 hover:bg-white transition-colors disabled:opacity-40"
        >
          {loading ? "Creating account…" : "Continue"}
        </button>
      </form>

      <p className="mt-8 text-[rgba(240,235,224,0.3)] text-sm font-light">
        Already have an account?{" "}
        <a href="/login" className="text-[#f0ebe0] underline underline-offset-4">
          Sign in
        </a>
      </p>
    </div>
  );
}
