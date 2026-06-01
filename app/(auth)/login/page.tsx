"use client";

import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const success = searchParams.get("success");

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Redirect if already logged in
  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) router.replace("/wins");
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
      setLoading(false);
      return;
    }

    router.push("/wins");
  }

  const inputStyle: React.CSSProperties = {
    background: "#1a1a1a",
    border: "0.5px solid rgba(240,235,224,0.15)",
    color: "#f0ebe0",
    fontSize: "14px",
    padding: "14px 16px",
    outline: "none",
    width: "100%",
    fontFamily: "inherit",
    borderRadius: 0,
  };

  return (
    <div
      className="min-h-screen flex flex-col"
      style={{ background: "#0a0a0a", padding: "40px 48px" }}
    >
      {/* Wordmark */}
      <div>
        <span
          className="font-poppins font-black uppercase text-[#f0ebe0]"
          style={{ fontSize: "13px", letterSpacing: "0.2em" }}
        >
          STATIONS
        </span>
      </div>

      {/* Main content */}
      <div className="flex flex-col" style={{ marginTop: "80px", maxWidth: "480px" }}>

        {/* Success message from onboarding */}
        {success && (
          <div
            className="font-poppins font-light text-[#f0ebe0]"
            style={{
              fontSize: "12px",
              letterSpacing: "0.05em",
              padding: "12px 16px",
              background: "rgba(192,57,43,0.08)",
              borderLeft: "2px solid #c0392b",
              marginBottom: "40px",
            }}
          >
            Account created. Sign in to continue.
          </div>
        )}

        {/* Heading */}
        <h1
          className="font-poppins font-black text-[#f0ebe0] leading-none"
          style={{ fontSize: "48px" }}
        >
          Welcome back.
        </h1>
        <p
          className="font-playfair italic"
          style={{
            fontSize: "18px",
            color: "rgba(240,235,224,0.5)",
            marginTop: "12px",
            marginBottom: "48px",
          }}
        >
          Lock in.
        </p>

        {/* Form */}
        <form onSubmit={handleSubmit} className="flex flex-col" style={{ gap: "16px" }}>
          {/* Email */}
          <div className="flex flex-col" style={{ gap: "8px" }}>
            <label
              className="font-poppins font-light uppercase text-[rgba(240,235,224,0.3)]"
              style={{ fontSize: "10px", letterSpacing: "0.18em" }}
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
              style={inputStyle}
              onFocus={(e) => (e.target.style.borderColor = "#c0392b")}
              onBlur={(e) => (e.target.style.borderColor = "rgba(240,235,224,0.15)")}
            />
          </div>

          {/* Password */}
          <div className="flex flex-col" style={{ gap: "8px" }}>
            <label
              className="font-poppins font-light uppercase text-[rgba(240,235,224,0.3)]"
              style={{ fontSize: "10px", letterSpacing: "0.18em" }}
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
                style={{ ...inputStyle, paddingRight: "48px" }}
                onFocus={(e) => (e.target.style.borderColor = "#c0392b")}
                onBlur={(e) => (e.target.style.borderColor = "rgba(240,235,224,0.15)")}
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                className="font-poppins font-light uppercase text-[rgba(240,235,224,0.3)] hover:text-[rgba(240,235,224,0.6)] transition-colors"
                style={{
                  position: "absolute",
                  right: "14px",
                  top: "50%",
                  transform: "translateY(-50%)",
                  fontSize: "9px",
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
            className="font-poppins uppercase text-[#0a0a0a]"
            style={{
              background: "#f0ebe0",
              fontSize: "12px",
              fontWeight: 500,
              letterSpacing: "0.15em",
              height: "48px",
              border: "none",
              cursor: loading ? "not-allowed" : "pointer",
              opacity: loading || !email || !password ? 0.5 : 1,
              transition: "opacity 150ms",
              marginTop: "8px",
              borderRadius: 0,
            }}
          >
            {loading ? "SIGNING IN..." : "SIGN IN"}
          </button>

          {/* Error */}
          {error && (
            <p
              className="font-poppins font-light text-[#c0392b]"
              style={{ fontSize: "12px" }}
            >
              {error}
            </p>
          )}
        </form>

        {/* Footer link */}
        <p
          className="font-poppins font-light text-[rgba(240,235,224,0.3)]"
          style={{ fontSize: "12px", marginTop: "28px" }}
        >
          Don&apos;t have an account?{" "}
          <a
            href="/onboarding/step-1"
            className="text-[rgba(240,235,224,0.5)] hover:text-[#f0ebe0] transition-colors underline underline-offset-4"
          >
            Apply for access
          </a>
        </p>
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
