"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useState, useRef, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { step2Schema, type Step2Data } from "@/lib/validations/onboarding";

async function getSessionUser() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (user) return user;
  // Attempt refresh before giving up
  const { data: { user: refreshed } } = await supabase.auth.refreshSession().then(
    (r) => ({ data: { user: r.data.session?.user ?? null } })
  );
  return refreshed ?? null;
}

export default function OnboardingStep2() {
  const router = useRouter();
  const [serverError, setServerError] = useState("");
  const [loading, setLoading] = useState(false);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors },
  } = useForm<Step2Data>({ resolver: zodResolver(step2Schema) });

  // Restore previously entered data when navigating back
  useEffect(() => {
    const saved = localStorage.getItem("onboarding_step2");
    if (saved) {
      const parsed = JSON.parse(saved);
      if (parsed.full_name) setValue("full_name", parsed.full_name);
      if (parsed.username) setValue("username", parsed.username);
    }
  }, [setValue]);

  function handleAvatarChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setAvatarFile(file);
    setAvatarPreview(URL.createObjectURL(file));
  }

  async function onSubmit(data: Step2Data) {
    setLoading(true);
    setServerError("");
    const supabase = createClient();

    const { data: existing } = await supabase
      .from("users")
      .select("id")
      .eq("username", data.username)
      .maybeSingle();

    if (existing) {
      setServerError("Username is already taken.");
      setLoading(false);
      return;
    }

    let avatar_url: string | null = null;

    if (avatarFile) {
      const user = await getSessionUser();
      if (!user) {
        setServerError("Session expired. Please start over at step 1.");
        setLoading(false);
        return;
      }
      const ext = avatarFile.name.split(".").pop();
      const path = `${user.id}.${ext}`;
      const { error: uploadError } = await supabase.storage
        .from("avatars")
        .upload(path, avatarFile, { upsert: true });
      if (uploadError) {
        setServerError("Avatar upload failed: " + uploadError.message);
        setLoading(false);
        return;
      }
      const { data: urlData } = supabase.storage.from("avatars").getPublicUrl(path);
      avatar_url = urlData.publicUrl;
    }

    localStorage.setItem("onboarding_step2", JSON.stringify({ ...data, avatar_url }));
    router.push("/onboarding/step-3");
  }

  return (
    <div className="flex-1 flex flex-col justify-center px-6 md:px-8 py-16 max-w-lg mx-auto w-full">
      <h1 className="font-playfair italic text-4xl md:text-5xl text-[rgb(var(--fg-rgb))] mb-3 leading-tight">
        Set up your profile.
      </h1>
      <p className="text-[rgba(var(--fg-rgb),0.5)] font-light text-lg mb-12">
        This is how the room will know you.
      </p>

      <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-6">
        {/* Avatar */}
        <div className="flex flex-col gap-2">
          <label className="text-[rgba(var(--fg-rgb),0.5)] text-xs tracking-widest uppercase font-light">
            Avatar (optional)
          </label>
          <div className="flex items-center gap-4">
            <div
              onClick={() => fileRef.current?.click()}
              className="w-16 h-16 rounded-full bg-[var(--bg-surface)] border border-[rgba(var(--fg-rgb),0.1)] flex items-center justify-center cursor-pointer hover:border-[var(--accent)] transition-colors overflow-hidden"
            >
              {avatarPreview ? (
                <img src={avatarPreview} alt="Avatar" className="w-full h-full object-cover" />
              ) : (
                <span className="text-[rgba(var(--fg-rgb),0.2)] text-2xl">+</span>
              )}
            </div>
            <span className="text-[rgba(var(--fg-rgb),0.3)] text-sm font-light">
              Click to upload a photo
            </span>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleAvatarChange}
            />
          </div>
        </div>

        {/* Full name */}
        <div className="flex flex-col gap-2">
          <label className="text-[rgba(var(--fg-rgb),0.5)] text-xs tracking-widest uppercase font-light">
            Full name
          </label>
          <input
            {...register("full_name")}
            type="text"
            autoComplete="name"
            className="st-field bg-[var(--bg-surface)] text-[rgb(var(--fg-rgb))] px-4 py-4 text-base outline-none border border-[rgba(var(--fg-rgb),0.1)] focus:border-[var(--accent)] placeholder:text-[rgba(var(--fg-rgb),0.2)]"
            placeholder="Your full name"
          />
          {errors.full_name && (
            <span className="text-[var(--accent)] text-sm">{errors.full_name.message}</span>
          )}
        </div>

        {/* Username */}
        <div className="flex flex-col gap-2">
          <label className="text-[rgba(var(--fg-rgb),0.5)] text-xs tracking-widest uppercase font-light">
            Username
          </label>
          <input
            {...register("username")}
            type="text"
            autoComplete="username"
            className="st-field bg-[var(--bg-surface)] text-[rgb(var(--fg-rgb))] px-4 py-4 text-base outline-none border border-[rgba(var(--fg-rgb),0.1)] focus:border-[var(--accent)] placeholder:text-[rgba(var(--fg-rgb),0.2)]"
            placeholder="lowercase_only"
          />
          {errors.username && (
            <span className="text-[var(--accent)] text-sm">{errors.username.message}</span>
          )}
        </div>

        {serverError && <p className="text-[var(--accent)] text-sm">{serverError}</p>}

        <button
          type="submit"
          disabled={loading}
          className="st-btn mt-4 bg-[rgb(var(--fg-rgb))] text-[var(--bg-primary)] font-poppins font-black tracking-widest uppercase text-sm px-8 py-4 hover:bg-white disabled:opacity-40"
        >
          {loading ? "Saving…" : "Continue"}
        </button>
      </form>

      <button
        type="button"
        onClick={() => router.push("/onboarding/step-1")}
        className="mt-6 text-[rgba(var(--fg-rgb),0.3)] text-sm font-light hover:text-[rgba(var(--fg-rgb),0.6)] transition-colors text-left"
      >
        ← Back
      </button>
    </div>
  );
}
