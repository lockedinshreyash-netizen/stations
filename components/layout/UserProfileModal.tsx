"use client";

import { useEffect, useState, useCallback } from "react";
import { createPortal } from "react-dom";
import { createClient } from "@/lib/supabase/client";
import { PROFILE_EVENT } from "@/lib/userProfile";
import MembershipBadge from "@/components/ui/MembershipBadge";
import type { MembershipTier } from "@/types";

type PublicProfile = {
  id: string;
  username: string;
  full_name: string | null;
  avatar_url: string | null;
  bio: string | null;
  role: string | string[] | null;
  goals: string[] | null;
  category: string | null;
  membership_tier: MembershipTier;
  founder_number: number | null;
  total_focus_minutes: number | null;
  total_sessions: number | null;
  streak_days: number | null;
};

const labelStyle: React.CSSProperties = {
  fontSize: "11px",
  letterSpacing: "0.18em",
  color: "rgba(var(--fg-rgb),0.3)",
  textTransform: "uppercase",
  fontWeight: 300,
};

const chipStyle: React.CSSProperties = {
  fontSize: "13px",
  letterSpacing: "0.1em",
  padding: "6px 12px",
  border: "0.5px solid rgba(var(--fg-rgb),0.15)",
  color: "rgba(var(--fg-rgb),0.6)",
  borderRadius: "var(--radius-sm)",
  textTransform: "uppercase",
};

/**
 * Read-only profile card for any user. Mounted once in the root layout; opens
 * when openUserProfile(id) dispatches PROFILE_EVENT. Shows avatar, name, badges
 * (Founding Cohort / Member), bio, roles, goals, and focus stats.
 */
export default function UserProfileModal() {
  const [userId, setUserId] = useState<string | null>(null);
  const [profile, setProfile] = useState<PublicProfile | null>(null);
  const [loading, setLoading] = useState(false);

  const close = useCallback(() => {
    setUserId(null);
    setProfile(null);
  }, []);

  useEffect(() => {
    function onOpen(e: Event) {
      const id = (e as CustomEvent<{ userId: string }>).detail?.userId;
      if (id) setUserId(id);
    }
    window.addEventListener(PROFILE_EVENT, onOpen);
    return () => window.removeEventListener(PROFILE_EVENT, onOpen);
  }, []);

  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    setLoading(true);
    setProfile(null);
    (async () => {
      const supabase = createClient();
      const { data } = await supabase
        .from("users")
        .select(
          "id, username, full_name, avatar_url, bio, role, goals, category, membership_tier, founder_number, total_focus_minutes, total_sessions, streak_days"
        )
        .eq("id", userId)
        .single();
      if (!cancelled) {
        setProfile((data as PublicProfile) ?? null);
        setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [userId]);

  // Escape + body scroll lock while open.
  useEffect(() => {
    if (!userId) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") close();
    }
    document.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      document.removeEventListener("keydown", onKey);
    };
  }, [userId, close]);

  if (typeof document === "undefined" || !userId) return null;

  const roles: string[] = profile
    ? Array.isArray(profile.role)
      ? profile.role
      : profile.role
        ? [profile.role]
        : []
    : [];
  const focusHrs = Math.floor((profile?.total_focus_minutes ?? 0) / 60);

  return createPortal(
    <div
      onClick={(e) => {
        if (e.target === e.currentTarget) close();
      }}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 9999,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "rgba(0,0,0,0.75)",
        backdropFilter: "blur(4px)",
        WebkitBackdropFilter: "blur(4px)",
        padding: "20px",
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: "440px",
          maxHeight: "86vh",
          overflowY: "auto",
          background: "var(--bg-secondary)",
          border: "0.5px solid rgba(var(--fg-rgb),0.12)",
          borderRadius: "var(--radius-card)",
          boxShadow: "var(--shadow-lg), 0 24px 80px rgba(0,0,0,0.5)",
          padding: "28px",
        }}
      >
        {loading || !profile ? (
          <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
            <div className="st-shimmer" style={{ width: "84px", height: "84px", borderRadius: "50%" }} />
            <div className="st-shimmer" style={{ width: "60%", height: "20px", borderRadius: "8px" }} />
            <div className="st-shimmer" style={{ width: "40%", height: "14px", borderRadius: "6px" }} />
          </div>
        ) : (
          <>
            {/* Avatar + identity */}
            <div style={{ display: "flex", alignItems: "center", gap: "18px" }}>
              <span
                className="flex items-center justify-center overflow-hidden shrink-0"
                style={{
                  width: "84px",
                  height: "84px",
                  borderRadius: "50%",
                  background: "var(--bg-surface)",
                  border: "0.5px solid rgba(var(--fg-rgb),0.12)",
                }}
              >
                {profile.avatar_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={profile.avatar_url} alt={profile.username} className="w-full h-full object-cover" />
                ) : (
                  <span className="font-poppins uppercase" style={{ fontSize: "32px", fontWeight: 500, color: "rgba(var(--fg-rgb),0.4)" }}>
                    {profile.username?.[0]}
                  </span>
                )}
              </span>
              <div style={{ display: "flex", flexDirection: "column", gap: "4px", minWidth: 0 }}>
                <span className="font-poppins font-black" style={{ fontSize: "22px", color: "rgb(var(--fg-rgb))", lineHeight: 1.15 }}>
                  {profile.full_name || profile.username}
                </span>
                <span className="font-poppins font-light" style={{ fontSize: "15px", color: "rgba(var(--fg-rgb),0.4)" }}>
                  @{profile.username}
                </span>
                <span style={{ marginTop: "4px" }}>
                  <MembershipBadge tier={profile.membership_tier} founderNumber={profile.founder_number} />
                </span>
              </div>
            </div>

            {/* Bio */}
            {profile.bio && (
              <p className="font-playfair italic" style={{ fontSize: "17px", lineHeight: 1.55, color: "rgba(var(--fg-rgb),0.7)", marginTop: "22px" }}>
                {profile.bio}
              </p>
            )}

            {/* Roles */}
            {roles.length > 0 && (
              <div style={{ marginTop: "24px" }}>
                <span className="font-poppins" style={labelStyle}>Roles</span>
                <div style={{ display: "flex", flexWrap: "wrap", gap: "6px", marginTop: "10px" }}>
                  {roles.map((r) => (
                    <span key={r} className="font-poppins font-light" style={chipStyle}>{r}</span>
                  ))}
                </div>
              </div>
            )}

            {/* Goals */}
            {profile.goals && profile.goals.length > 0 && (
              <div style={{ marginTop: "20px" }}>
                <span className="font-poppins" style={labelStyle}>Goals</span>
                <div style={{ display: "flex", flexWrap: "wrap", gap: "6px", marginTop: "10px" }}>
                  {profile.goals.map((g) => (
                    <span key={g} className="font-poppins font-light" style={chipStyle}>{g}</span>
                  ))}
                </div>
              </div>
            )}

            {/* Stats */}
            <div style={{ display: "flex", gap: "10px", marginTop: "26px" }}>
              {[
                { label: "Focus", value: focusHrs, unit: "hrs" },
                { label: "Sessions", value: profile.total_sessions ?? 0, unit: "" },
                { label: "Streak", value: profile.streak_days ?? 0, unit: "d" },
              ].map((s) => (
                <div
                  key={s.label}
                  className="st-card"
                  style={{ flex: 1, padding: "12px", background: "var(--bg-surface)", border: "0.5px solid rgba(var(--fg-rgb),0.08)", textAlign: "center" }}
                >
                  <div className="font-poppins font-black" style={{ fontSize: "22px", color: "rgb(var(--fg-rgb))" }}>
                    {s.value}
                    {s.unit && <span style={{ fontSize: "12px", fontWeight: 300, color: "rgba(var(--fg-rgb),0.4)" }}> {s.unit}</span>}
                  </div>
                  <div className="font-poppins uppercase" style={{ fontSize: "10px", letterSpacing: "0.15em", color: "rgba(var(--fg-rgb),0.3)", marginTop: "4px" }}>
                    {s.label}
                  </div>
                </div>
              ))}
            </div>

            <button
              type="button"
              onClick={close}
              className="st-btn font-poppins uppercase"
              style={{
                width: "100%",
                marginTop: "26px",
                fontSize: "13px",
                letterSpacing: "0.15em",
                fontWeight: 500,
                padding: "11px",
                background: "transparent",
                border: "0.5px solid rgba(var(--fg-rgb),0.2)",
                color: "rgba(var(--fg-rgb),0.6)",
                cursor: "pointer",
              }}
            >
              Close
            </button>
          </>
        )}
      </div>
    </div>,
    document.body
  );
}
