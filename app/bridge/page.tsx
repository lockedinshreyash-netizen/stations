"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

/**
 * Session bridge for the marketing site. The landing page signs the user up
 * with the shared Supabase project, then redirects here with the session
 * tokens in the URL fragment (never sent to the server). We persist the
 * session into auth cookies and hand off to the platform, which routes
 * new accounts into onboarding.
 */
export default function BridgePage() {
  const router = useRouter();
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.hash.slice(1));
    const access_token = params.get("access_token");
    const refresh_token = params.get("refresh_token");

    if (!access_token || !refresh_token) {
      router.replace("/login");
      return;
    }

    // Clear tokens from the address bar before any navigation.
    window.history.replaceState(null, "", "/bridge");

    const supabase = createClient();
    supabase.auth
      .setSession({ access_token, refresh_token })
      .then(({ error }) => {
        if (error) {
          setFailed(true);
          return;
        }
        router.replace("/home");
      });
  }, [router]);

  return (
    <main className="min-h-svh flex flex-col items-center justify-center gap-4 px-6 text-center">
      {failed ? (
        <>
          <h1 className="font-poppins font-black uppercase text-2xl text-[rgb(var(--fg-rgb))]">
            Link expired
          </h1>
          <p className="font-playfair italic text-[rgba(var(--fg-rgb),0.6)]">
            Sign in to continue —{" "}
            <a href="/login" className="underline underline-offset-4">
              login
            </a>
          </p>
        </>
      ) : (
        <p className="font-playfair italic text-lg text-[rgba(var(--fg-rgb),0.6)]">
          Entering Stations…
        </p>
      )}
    </main>
  );
}
