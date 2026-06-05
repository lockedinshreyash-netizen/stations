"use client";

import { useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import type { User, UserRole } from "@/types";
import MembershipBadge from "@/components/ui/MembershipBadge";
import { addMember } from "@/lib/firebase/rooms";
import { isSoundEnabled, setSoundEnabled, success, error as errorSound } from "@/lib/feedback";

const ROLES: { value: UserRole; label: string }[] = [
  { value: "student",   label: "Student"   },
  { value: "founder",   label: "Founder"   },
  { value: "creator",   label: "Creator"   },
  { value: "developer", label: "Developer" },
  { value: "designer",  label: "Designer"  },
  { value: "athlete",   label: "Athlete"   },
  { value: "other",     label: "Other"     },
];

const GOALS = [
  "academic excellence",
  "build a product",
  "grow an audience",
  "get fit",
  "land a job",
  "learn a skill",
  "ship a project",
  "other",
];

const MAX_FILE_SIZE = 5 * 1024 * 1024;
const ACCEPTED_TYPES = ["image/jpeg", "image/png", "image/webp"];

interface Props {
  user: User;
  onClose: () => void;
}

const labelStyle: React.CSSProperties = {
  fontSize: "13px",
  letterSpacing: "0.18em",
  color: "rgba(var(--fg-rgb),0.3)",
  textTransform: "uppercase" as const,
  fontWeight: 300,
};

const fieldStyle: React.CSSProperties = {
  background: "var(--bg-surface)",
  border: "0.5px solid rgba(var(--fg-rgb),0.12)",
  color: "rgb(var(--fg-rgb))",
  fontSize: "16px",
  padding: "12px 14px",
  outline: "none",
  width: "100%",
  fontFamily: "inherit",
  borderRadius: "var(--radius-sm)",
  resize: "none" as const,
};

export default function ProfileModal({ user, onClose }: Props) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [mounted, setMounted] = useState(false);

  const [bio, setBio] = useState(user.bio ?? "");
  const [role, setRole] = useState<UserRole>(
    Array.isArray(user.role) ? (user.role as unknown as UserRole[])[0] ?? "other" : user.role
  );
  const [goals, setGoals] = useState<string[]>(user.goals ?? []);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarError, setAvatarError] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [soundOn, setSoundOn] = useState(true);

  // Reflect the stored sound preference once mounted (localStorage is client-only).
  useEffect(() => { setSoundOn(isSoundEnabled()); }, []);

  // Founder-code redemption (for accounts created before/without a code).
  const [redeemCode, setRedeemCode] = useState("");
  const [redeeming, setRedeeming] = useState(false);
  const [redeemError, setRedeemError] = useState("");
  const [redeemedNumber, setRedeemedNumber] = useState<number | null>(null);

  // Mount guard for portal + lock body scroll
  useEffect(() => {
    setMounted(true);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, []);

  // Close on Escape
  useEffect(() => {
    function onKey(e: KeyboardEvent) { if (e.key === "Escape") onClose(); }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  function toggleGoal(g: string) {
    setGoals((prev) =>
      prev.includes(g) ? prev.filter((x) => x !== g) : prev.length < 5 ? [...prev, g] : prev
    );
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!ACCEPTED_TYPES.includes(file.type)) { setAvatarError("JPG, PNG, or WebP only."); return; }
    if (file.size > MAX_FILE_SIZE) { setAvatarError("Max 5 MB."); return; }
    setAvatarError("");
    setAvatarFile(file);
    setAvatarPreview(URL.createObjectURL(file));
  }

  async function handleSave() {
    setSaving(true);
    setError("");
    const supabase = createClient();
    let avatar_url = user.avatar_url;

    if (avatarFile) {
      const ext = avatarFile.name.split(".").pop();
      const path = `${user.id}/avatar.${ext}`;
      const { error: uploadError } = await supabase.storage
        .from("avatars")
        .upload(path, avatarFile, { upsert: true, contentType: avatarFile.type });
      if (uploadError) { setError("Avatar upload failed. Try again."); setSaving(false); return; }
      const { data: { publicUrl } } = supabase.storage.from("avatars").getPublicUrl(path);
      avatar_url = publicUrl;
    }

    const { error: updateError } = await supabase
      .from("users")
      .update({ bio: bio.trim() || null, role: [role], goals, avatar_url })
      .eq("id", user.id);

    if (updateError) { errorSound(); setError("Failed to save. Try again."); setSaving(false); return; }
    success();
    router.refresh();
    onClose();
  }

  async function handleRedeem() {
    const code = redeemCode.trim().toUpperCase();
    if (!code) return;
    setRedeeming(true);
    setRedeemError("");
    const supabase = createClient();
    // Atomic: claims the code, assigns the next founding number, upgrades this
    // account to the Founding Cohort, and adds the private room. Works for any
    // logged-in user — including accounts that predate founder codes.
    const { data: founderNo, error: rpcError } = await supabase.rpc(
      "claim_founder_code",
      { code }
    );
    if (rpcError) {
      setRedeemError("Something went wrong. Try again.");
      setRedeeming(false);
      return;
    }
    if (typeof founderNo !== "number") {
      setRedeemError("That code isn't valid or has already been claimed.");
      setRedeeming(false);
      return;
    }
    // Mirror cohort membership into Firebase so the chat lists them.
    await addMember("founding", user.id).catch(() => {});
    setRedeemedNumber(founderNo);
    setRedeeming(false);
    // Reflect the new tier/number/room everywhere on next paint.
    router.refresh();
  }

  async function handleLogout() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
  }

  const currentAvatar = avatarPreview ?? user.avatar_url;

  const modal = (
    <div
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
        padding: "24px",
      }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: "520px",
          maxHeight: "88vh",
          display: "flex",
          flexDirection: "column",
          background: "var(--bg-secondary)",
          border: "0.5px solid rgba(var(--fg-rgb),0.12)",
          borderRadius: "var(--radius-card)",
          boxShadow: "var(--shadow-lg), 0 24px 80px rgba(0,0,0,0.5)",
          overflowY: "auto",
        }}
      >
        {/* Header */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "22px 28px",
            borderBottom: "0.5px solid rgba(var(--fg-rgb),0.08)",
            flexShrink: 0,
          }}
        >
          <span
            className="font-poppins font-black uppercase"
            style={{ fontSize: "15px", letterSpacing: "0.22em", color: "rgb(var(--fg-rgb))" }}
          >
            Account Settings
          </span>
          <button
            onClick={onClose}
            style={{
              background: "none",
              border: "none",
              cursor: "pointer",
              color: "rgba(var(--fg-rgb),0.3)",
              fontSize: "23px",
              lineHeight: 1,
              padding: "2px 4px",
              transition: "color 150ms",
            }}
            onMouseEnter={(e) => (e.currentTarget.style.color = "rgb(var(--fg-rgb))")}
            onMouseLeave={(e) => (e.currentTarget.style.color = "rgba(var(--fg-rgb),0.3)")}
          >
            ×
          </button>
        </div>

        {/* Body */}
        <div style={{ padding: "28px", display: "flex", flexDirection: "column", gap: "32px" }}>

          {/* Avatar + name */}
          <div style={{ display: "flex", alignItems: "center", gap: "20px" }}>
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              className="group"
              style={{
                position: "relative",
                width: "64px",
                height: "64px",
                borderRadius: "50%",
                background: "var(--bg-surface)",
                border: "0.5px solid rgba(var(--fg-rgb),0.12)",
                cursor: "pointer",
                flexShrink: 0,
                overflow: "hidden",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                padding: 0,
              }}
              title="Change photo"
            >
              {currentAvatar ? (
                <img src={currentAvatar} alt={user.username} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
              ) : (
                <span
                  className="font-poppins uppercase"
                  style={{ fontSize: "23px", fontWeight: 500, color: "rgba(var(--fg-rgb),0.4)" }}
                >
                  {user.username[0]}
                </span>
              )}
              <div
                className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                style={{ background: "rgba(0,0,0,0.6)" }}
              >
                <span className="font-poppins uppercase text-white" style={{ fontSize: "11px", letterSpacing: "0.12em" }}>
                  Change
                </span>
              </div>
            </button>

            <div style={{ display: "flex", flexDirection: "column", gap: "4px", minWidth: 0 }}>
              <span
                className="font-poppins font-black"
                style={{ fontSize: "19px", color: "rgb(var(--fg-rgb))", lineHeight: 1.2 }}
              >
                {user.full_name}
              </span>
              <span
                className="font-poppins font-light"
                style={{ fontSize: "15px", color: "rgba(var(--fg-rgb),0.4)" }}
              >
                @{user.username}
              </span>
              <span style={{ marginTop: "2px" }}>
                <MembershipBadge
                  tier={user.membership_tier}
                  founderNumber={user.founder_number}
                />
              </span>
            </div>

            <input
              ref={fileRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              style={{ display: "none" }}
              onChange={handleFileChange}
            />
          </div>

          {avatarError && (
            <span className="font-poppins font-light" style={{ fontSize: "14px", color: "var(--accent)", marginTop: "-20px" }}>
              {avatarError}
            </span>
          )}

          {/* Founder code redemption — only for non-founders */}
          {user.membership_tier !== "founding" && (
            <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
              <span className="font-poppins" style={labelStyle}>Founder code</span>
              {redeemedNumber !== null ? (
                <span
                  className="font-poppins"
                  style={{ fontSize: "15px", color: "var(--accent)" }}
                >
                  ◆ Welcome to the Founding Cohort — you&apos;re No.{" "}
                  {String(redeemedNumber).padStart(3, "0")}.
                </span>
              ) : (
                <>
                  <div style={{ display: "flex", gap: "8px" }}>
                    <input
                      value={redeemCode}
                      onChange={(e) => {
                        setRedeemCode(e.target.value);
                        if (redeemError) setRedeemError("");
                      }}
                      placeholder="STN-7F3KQ2"
                      autoComplete="off"
                      spellCheck={false}
                      style={{ ...fieldStyle, textTransform: "uppercase", letterSpacing: "0.15em" }}
                    />
                    <button
                      type="button"
                      onClick={handleRedeem}
                      disabled={redeeming || !redeemCode.trim()}
                      className="font-poppins font-black uppercase"
                      style={{
                        fontSize: "14px",
                        letterSpacing: "0.12em",
                        padding: "0 18px",
                        whiteSpace: "nowrap",
                        background: "rgb(var(--fg-rgb))",
                        color: "var(--bg-primary)",
                        border: "none",
                        borderRadius: "var(--radius-sm)",
                        cursor: redeeming ? "default" : "pointer",
                        opacity: redeeming || !redeemCode.trim() ? 0.4 : 1,
                      }}
                    >
                      {redeeming ? "…" : "Redeem"}
                    </button>
                  </div>
                  {redeemError ? (
                    <span className="font-poppins font-light" style={{ fontSize: "14px", color: "var(--accent)" }}>
                      {redeemError}
                    </span>
                  ) : (
                    <span className="font-poppins font-light" style={{ fontSize: "14px", color: "rgba(var(--fg-rgb),0.3)" }}>
                      Got a code from the waitlist? Redeem it for free premium, forever.
                    </span>
                  )}
                </>
              )}
            </div>
          )}

          {/* Bio */}
          <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
            <span className="font-poppins" style={labelStyle}>Bio</span>
            <textarea
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              maxLength={200}
              rows={3}
              placeholder="A short bio..."
              style={fieldStyle}
              onFocus={(e) => (e.target.style.borderColor = "var(--accent)")}
              onBlur={(e) => (e.target.style.borderColor = "rgba(var(--fg-rgb),0.12)")}
            />
            <span
              className="font-poppins font-light"
              style={{ fontSize: "13px", color: "rgba(var(--fg-rgb),0.2)", alignSelf: "flex-end" }}
            >
              {bio.length}/200
            </span>
          </div>

          {/* Role */}
          <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
            <span className="font-poppins" style={labelStyle}>Role</span>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
              {ROLES.map(({ value, label }) => {
                const active = role === value;
                return (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setRole(value)}
                    className="font-poppins font-light uppercase"
                    style={{
                      fontSize: "13px",
                      letterSpacing: "0.12em",
                      padding: "7px 14px",
                      background: active ? "var(--accent)" : "transparent",
                      border: `0.5px solid ${active ? "var(--accent)" : "rgba(var(--fg-rgb),0.15)"}`,
                      color: active ? "#fff" : "rgba(var(--fg-rgb),0.5)",
                      cursor: "pointer",
                      borderRadius: "var(--radius-sm)",
                      transition: "all 150ms var(--ease)",
                    }}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Goals */}
          <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
            <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between" }}>
              <span className="font-poppins" style={labelStyle}>Goals</span>
              <span
                className="font-poppins font-light"
                style={{ fontSize: "13px", color: "rgba(var(--fg-rgb),0.2)", letterSpacing: "0.08em" }}
              >
                {goals.length} / 5
              </span>
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
              {GOALS.map((g) => {
                const active = goals.includes(g);
                const maxed = !active && goals.length >= 5;
                return (
                  <button
                    key={g}
                    type="button"
                    onClick={() => toggleGoal(g)}
                    disabled={maxed}
                    className="font-poppins font-light uppercase"
                    style={{
                      fontSize: "13px",
                      letterSpacing: "0.1em",
                      padding: "7px 14px",
                      background: active ? "var(--accent)" : "transparent",
                      border: `0.5px solid ${active ? "var(--accent)" : "rgba(var(--fg-rgb),0.15)"}`,
                      color: active ? "#fff" : maxed ? "rgba(var(--fg-rgb),0.15)" : "rgba(var(--fg-rgb),0.5)",
                      cursor: maxed ? "default" : "pointer",
                      borderRadius: "var(--radius-sm)",
                      opacity: maxed ? 0.4 : 1,
                      transition: "all 150ms var(--ease)",
                    }}
                  >
                    {g}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Preferences — sound & haptics */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "16px" }}>
            <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
              <span className="font-poppins" style={labelStyle}>Sound &amp; haptics</span>
              <span className="font-poppins font-light" style={{ fontSize: "14px", color: "rgba(var(--fg-rgb),0.3)" }}>
                Subtle taps and chimes as you move through Stations.
              </span>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={soundOn}
              aria-label="Toggle sound and haptics"
              onClick={() => {
                const next = !soundOn;
                setSoundOn(next);
                setSoundEnabled(next); // persists + plays a confirm tap when enabling
              }}
              style={{
                position: "relative",
                width: "46px",
                height: "26px",
                flexShrink: 0,
                borderRadius: "9999px",
                border: "none",
                cursor: "pointer",
                background: soundOn ? "var(--accent)" : "rgba(var(--fg-rgb),0.18)",
                transition: "background 200ms var(--ease)",
              }}
            >
              <span
                style={{
                  position: "absolute",
                  top: "3px",
                  left: soundOn ? "23px" : "3px",
                  width: "20px",
                  height: "20px",
                  borderRadius: "50%",
                  background: "#fff",
                  boxShadow: "0 1px 3px rgba(0,0,0,0.4)",
                  transition: "left 200ms var(--ease)",
                }}
              />
            </button>
          </div>

          {error && (
            <span className="font-poppins font-light" style={{ fontSize: "15px", color: "var(--accent)" }}>
              {error}
            </span>
          )}
        </div>

        {/* Footer */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "18px 28px",
            borderTop: "0.5px solid rgba(var(--fg-rgb),0.08)",
            flexShrink: 0,
            gap: "12px",
          }}
        >
          <button
            type="button"
            onClick={handleLogout}
            className="font-poppins uppercase"
            style={{
              fontSize: "13px",
              letterSpacing: "0.15em",
              color: "rgba(var(--fg-rgb),0.3)",
              background: "none",
              border: "none",
              cursor: "pointer",
              padding: 0,
              transition: "color 150ms",
            }}
            onMouseEnter={(e) => (e.currentTarget.style.color = "var(--accent)")}
            onMouseLeave={(e) => (e.currentTarget.style.color = "rgba(var(--fg-rgb),0.3)")}
          >
            Log out
          </button>

          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="st-btn font-poppins uppercase"
            style={{
              fontSize: "14px",
              letterSpacing: "0.15em",
              fontWeight: 500,
              padding: "11px 28px",
              background: saving ? "rgba(var(--fg-rgb),0.35)" : "rgb(var(--fg-rgb))",
              color: "var(--bg-primary)",
              border: "none",
              cursor: saving ? "not-allowed" : "pointer",
            }}
          >
            {saving ? "Saving..." : "Save changes"}
          </button>
        </div>
      </div>
    </div>
  );

  if (!mounted) return null;
  return createPortal(modal, document.body);
}
