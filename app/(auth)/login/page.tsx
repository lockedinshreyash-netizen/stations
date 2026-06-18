"use client";

import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import GoogleButton from "@/components/onboarding/GoogleButton";
import LegalFooter from "@/components/legal/LegalFooter";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const success = searchParams.get("success");

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Redirect if already logged in — but only for a fully onboarded account.
  // The join funnel creates a session before the profile exists; redirecting
  // such a session to /wins bounces straight back to onboarding, making the
  // login screen unreachable. Those users stay here and sign in normally
  // (after which the platform layout resumes their onboarding).
  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!session) return;
      const { data: profile } = await supabase
        .from("users")
        .select("id")
        .eq("id", session.user.id)
        .maybeSingle();
      // Onboarded → into the app. Session but no profile → finish the funnel.
      router.replace(profile ? "/wins" : "/onboarding/complete");
    });
  }, [router]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email || !password) return;
    setLoading(true);
    setError("");

    const supabase = createClient();
    const { error: authError } = await supabase.auth.signInWithPassword({ email, password });

    if (authError) {
      setError("Invalid email or password.");
      setPassword("");
      setLoading(false);
      return;
    }

    router.push("/wins");
  }

  const inputStyle: React.CSSProperties = {
    background: "var(--bg-surface)",
    border: "0.5px solid rgba(var(--fg-rgb),0.15)",
    color: "rgb(var(--fg-rgb))",
    fontSize: "17px",
    padding: "14px 16px",
    outline: "none",
    width: "100%",
    fontFamily: "inherit",
    borderRadius: "var(--radius-sm)",
  };

  return (
    <div
      className="min-h-screen flex flex-col px-6 py-10 md:px-12"
      style={{ background: "var(--bg-primary)" }}
    >
      {/* Wordmark */}
      <div>
        <span
          className="font-poppins font-black uppercase text-[rgb(var(--fg-rgb))]"
          style={{ fontSize: "16px", letterSpacing: "0.2em" }}
        >
          STATIONS
        </span>
      </div>

      {/* Main content */}
      <div className="flex flex-col" style={{ marginTop: "80px", maxWidth: "480px" }}>

        {/* Success message from onboarding */}
        {success && (
          <div
            className="font-poppins font-light text-[rgb(var(--fg-rgb))]"
            style={{
              fontSize: "15px",
              letterSpacing: "0.05em",
              padding: "12px 16px",
              background: "rgba(var(--accent-rgb),0.08)",
              borderLeft: "2px solid var(--accent)",
              marginBottom: "40px",
            }}
          >
            Account created. Sign in to continue.
          </div>
        )}

        {/* Heading */}
        <h1
          className="font-poppins font-black text-[rgb(var(--fg-rgb))] leading-none"
          style={{ fontSize: "48px" }}
        >
          Welcome back.
        </h1>
        <p
          className="font-playfair italic"
          style={{
            fontSize: "21px",
            color: "rgba(var(--fg-rgb),0.5)",
            marginTop: "12px",
            marginBottom: "48px",
          }}
        >
          Lock in.
        </p>

        {/* Google */}
        <div style={{ marginBottom: "20px" }}>
          <GoogleButton next="/wins" label="Sign in with Google" />
        </div>

        {/* Divider */}
        <div className="flex items-center gap-3" style={{ marginBottom: "20px" }}>
          <div style={{ height: "0.5px", flex: 1, background: "rgba(var(--fg-rgb),0.12)" }} />
          <span
            className="font-poppins font-light uppercase text-[rgba(var(--fg-rgb),0.3)]"
            style={{ fontSize: "12px", letterSpacing: "0.18em" }}
          >
            or
          </span>
          <div style={{ height: "0.5px", flex: 1, background: "rgba(var(--fg-rgb),0.12)" }} />
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="flex flex-col" style={{ gap: "16px" }}>
          {/* Email */}
          <div className="flex flex-col" style={{ gap: "8px" }}>
            <label
              className="font-poppins font-light uppercase text-[rgba(var(--fg-rgb),0.3)]"
              style={{ fontSize: "13px", letterSpacing: "0.18em" }}
            >
              Email
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
              placeholder="you@example.com"
              required
              className="st-field"
              style={inputStyle}
              onFocus={(e) => (e.target.style.borderColor = "var(--accent)")}
              onBlur={(e) => (e.target.style.borderColor = "rgba(var(--fg-rgb),0.15)")}
            />
          </div>

          {/* Password */}
          <div className="flex flex-col" style={{ gap: "8px" }}>
            <label
              className="font-poppins font-light uppercase text-[rgba(var(--fg-rgb),0.3)]"
              style={{ fontSize: "13px", letterSpacing: "0.18em" }}
            >
              Password
            </label>
            <div style={{ position: "relative" }}>
              <input
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
                placeholder="••••••••"
                required
                className="st-field"
                style={{ ...inputStyle, paddingRight: "48px" }}
                onFocus={(e) => (e.target.style.borderColor = "var(--accent)")}
                onBlur={(e) => (e.target.style.borderColor = "rgba(var(--fg-rgb),0.15)")}
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                className="font-poppins font-light uppercase text-[rgba(var(--fg-rgb),0.3)] hover:text-[rgba(var(--fg-rgb),0.6)] transition-colors"
                style={{
                  position: "absolute",
                  right: "14px",
                  top: "50%",
                  transform: "translateY(-50%)",
                  fontSize: "12px",
                  letterSpacing: "0.12em",
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                }}
              >
                {showPassword ? "HIDE" : "SHOW"}
              </button>
            </div>
          </div>

          {/* Submit */}
          <button
            type="submit"
            disabled={loading || !email || !password}
            className="st-btn font-poppins uppercase text-[var(--bg-primary)]"
            style={{
              background: "rgb(var(--fg-rgb))",
              fontSize: "15px",
              fontWeight: 500,
              letterSpacing: "0.15em",
              height: "48px",
              border: "none",
              cursor: loading ? "not-allowed" : "pointer",
              opacity: loading || !email || !password ? 0.5 : 1,
              marginTop: "8px",
            }}
          >
            {loading ? "SIGNING IN..." : "SIGN IN"}
          </button>

          {/* Error */}
          {error && (
            <p
              className="font-poppins font-light text-[var(--accent)]"
              style={{ fontSize: "15px" }}
            >
              {error}
            </p>
          )}
        </form>

        {/* Footer link */}
        <p
          className="font-poppins font-light text-[rgba(var(--fg-rgb),0.3)]"
          style={{ fontSize: "15px", marginTop: "28px" }}
        >
          Don&apos;t have an account?{" "}
          <a
            href="/join"
            className="text-[rgba(var(--fg-rgb),0.5)] hover:text-[rgb(var(--fg-rgb))] transition-colors underline underline-offset-4"
          >
            Apply for access
          </a>
        </p>

        <LegalFooter className="mt-12" />
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}
