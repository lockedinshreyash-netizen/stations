"use client";

import { useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import type { User, UserRole } from "@/types";

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
  fontSize: "10px",
  letterSpacing: "0.18em",
  color: "rgba(var(--fg-rgb),0.3)",
  textTransform: "uppercase" as const,
  fontWeight: 300,
};

const fieldStyle: React.CSSProperties = {
  background: "var(--bg-surface)",
  border: "0.5px solid rgba(var(--fg-rgb),0.12)",
  color: "rgb(var(--fg-rgb))",
  fontSize: "13px",
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

    if (updateError) { setError("Failed to save. Try again."); setSaving(false); return; }
    router.refresh();
    onClose();
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
            style={{ fontSize: "12px", letterSpacing: "0.22em", color: "rgb(var(--fg-rgb))" }}
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
              fontSize: "20px",
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
                  style={{ fontSize: "20px", fontWeight: 500, color: "rgba(var(--fg-rgb),0.4)" }}
                >
                  {user.username[0]}
                </span>
              )}
              <div
                className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                style={{ background: "rgba(0,0,0,0.6)" }}
              >
                <span className="font-poppins uppercase text-white" style={{ fontSize: "8px", letterSpacing: "0.12em" }}>
                  Change
                </span>
              </div>
            </button>

            <div style={{ display: "flex", flexDirection: "column", gap: "4px", minWidth: 0 }}>
              <span
                className="font-poppins font-black"
                style={{ fontSize: "16px", color: "rgb(var(--fg-rgb))", lineHeight: 1.2 }}
              >
                {user.full_name}
              </span>
              <span
                className="font-poppins font-light"
                style={{ fontSize: "12px", color: "rgba(var(--fg-rgb),0.4)" }}
              >
                @{user.username}
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
            <span className="font-poppins font-light" style={{ fontSize: "11px", color: "var(--accent)", marginTop: "-20px" }}>
              {avatarError}
            </span>
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
              style={{ fontSize: "10px", color: "rgba(var(--fg-rgb),0.2)", alignSelf: "flex-end" }}
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
                      fontSize: "10px",
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
                style={{ fontSize: "10px", color: "rgba(var(--fg-rgb),0.2)", letterSpacing: "0.08em" }}
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
                      fontSize: "10px",
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

          {error && (
            <span className="font-poppins font-light" style={{ fontSize: "12px", color: "var(--accent)" }}>
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
              fontSize: "10px",
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
              fontSize: "11px",
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
