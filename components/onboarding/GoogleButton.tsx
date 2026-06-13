"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

/**
 * Google OAuth entry. Sends the user to Google and back through
 * /auth/callback, which lands them at `next` (default: profile completion).
 *
 * SETUP (Supabase dashboard, one-time): enable the Google provider under
 * Authentication → Providers, paste a Google OAuth client id/secret, and add
 * `<site>/auth/callback` to the provider's redirect URLs and to
 * Authentication → URL Configuration → Redirect URLs.
 */
export default function GoogleButton({
  next = "/onboarding/complete",
  label = "Continue with Google",
}: {
  next?: string;
  label?: string;
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function signIn() {
    setLoading(true);
    setError("");
    const supabase = createClient();
    const redirectTo = `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`;
    const { error: authError } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo },
    });
    if (authError) {
      setError("Couldn’t reach Google. Try again or use email.");
      setLoading(false);
    }
    // On success the browser navigates away to Google — no further work here.
  }

  return (
    <div className="flex flex-col gap-2">
      <button
        type="button"
        onClick={signIn}
        disabled={loading}
        className="st-btn flex items-center justify-center gap-3 bg-[var(--bg-surface)] text-[rgb(var(--fg-rgb))] border border-[rgba(var(--fg-rgb),0.15)] font-poppins font-medium tracking-wide text-base px-8 py-4 hover:border-[rgba(var(--fg-rgb),0.4)] disabled:opacity-40"
      >
        <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
          <path
            fill="#4285F4"
            d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.92c1.7-1.57 2.68-3.88 2.68-6.62z"
          />
          <path
            fill="#34A853"
            d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.92-2.26c-.81.54-1.84.86-3.04.86-2.34 0-4.32-1.58-5.03-3.7H.96v2.33A9 9 0 0 0 9 18z"
          />
          <path
            fill="#FBBC05"
            d="M3.97 10.72a5.4 5.4 0 0 1 0-3.44V4.95H.96a9 9 0 0 0 0 8.1l3.01-2.33z"
          />
          <path
            fill="#EA4335"
            d="M9 3.58c1.32 0 2.5.45 3.44 1.35l2.58-2.58A9 9 0 0 0 .96 4.95l3.01 2.33C4.68 5.16 6.66 3.58 9 3.58z"
          />
        </svg>
        {loading ? "Connecting…" : label}
      </button>
      {error && <span className="text-[var(--accent)] text-base">{error}</span>}
    </div>
  );
}
