"use client";

import { useState, useRef } from "react";
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
  fontFamily: "var(--font-poppins, inherit)",
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
  borderRadius: 0,
  resize: "none" as const,
};

export default function ProfileModal({ user, onClose }: Props) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);

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

  function toggleGoal(g: string) {
    setGoals((prev) =>
      prev.includes(g) ? prev.filter((x) => x !== g) : prev.length < 5 ? [...prev, g] : prev
    );
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!ACCEPTED_TYPES.includes(file.type)) {
      setAvatarError("JPG, PNG, or WebP only.");
      return;
    }
    if (file.size > MAX_FILE_SIZE) {
      setAvatarError("Max 5 MB.");
      return;
    }
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

      if (uploadError) {
        setError("Avatar upload failed. Try again.");
        setSaving(false);
        return;
      }

      const { data: { publicUrl } } = supabase.storage.from("avatars").getPublicUrl(path);
      avatar_url = publicUrl;
    }

    const { error: updateError } = await supabase
      .from("users")
      .update({ bio: bio.trim() || null, role: [role], goals, avatar_url })
      .eq("id", user.id);

    if (updateError) {
      setError("Failed to save. Try again.");
      setSaving(false);
      return;
    }

    router.refresh();
    onClose();
  }

  async function handleLogout() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
  }

  const currentAvatar = avatarPreview ?? user.avatar_url;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ background: "rgba(0,0,0,0.85)" }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        className="w-full flex flex-col"
        style={{
          maxWidth: "480px",
          maxHeight: "90vh",
          overflowY: "auto",
          background: "var(--bg-secondary)",
          border: "0.5px solid rgba(var(--fg-rgb),0.1)",
        }}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between shrink-0"
          style={{
            padding: "20px 24px",
            borderBottom: "0.5px solid rgba(var(--fg-rgb),0.08)",
          }}
        >
          <span
            className="font-poppins font-black uppercase text-[rgb(var(--fg-rgb))]"
            style={{ fontSize: "13px", letterSpacing: "0.2em" }}
          >
            Profile
          </span>
          <button
            onClick={onClose}
            className="font-poppins text-[rgba(var(--fg-rgb),0.35)] hover:text-[rgb(var(--fg-rgb))] transition-colors"
            style={{ fontSize: "18px", lineHeight: 1, background: "none", border: "none", cursor: "pointer" }}
          >
            ×
          </button>
        </div>

        {/* Body */}
        <div className="flex flex-col" style={{ padding: "24px", gap: "28px" }}>

          {/* Avatar */}
          <div className="flex flex-col items-center" style={{ gap: "12px" }}>
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              className="relative group flex items-center justify-center overflow-hidden shrink-0"
              style={{
                width: "72px",
                height: "72px",
                borderRadius: "50%",
                background: "var(--bg-surface)",
                border: "0.5px solid rgba(var(--fg-rgb),0.12)",
                cursor: "pointer",
              }}
            >
              {currentAvatar ? (
                <img src={currentAvatar} alt={user.username} className="w-full h-full object-cover" />
              ) : (
                <span
                  className="font-poppins uppercase text-[rgba(var(--fg-rgb),0.4)]"
                  style={{ fontSize: "22px", fontWeight: 500 }}
                >
                  {user.username[0]}
                </span>
              )}
              {/* Hover overlay */}
              <div
                className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                style={{ background: "rgba(0,0,0,0.55)" }}
              >
                <span
                  className="font-poppins uppercase text-white"
                  style={{ fontSize: "9px", letterSpacing: "0.12em" }}
                >
                  Change
                </span>
              </div>
            </button>
            <input
              ref={fileRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="hidden"
              onChange={handleFileChange}
            />
            {avatarError && (
              <span className="font-poppins font-light" style={{ fontSize: "11px", color: "var(--accent)" }}>
                {avatarError}
              </span>
            )}
          </div>

          {/* Bio */}
          <div className="flex flex-col" style={{ gap: "8px" }}>
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
              className="font-poppins font-light self-end"
              style={{ fontSize: "10px", color: "rgba(var(--fg-rgb),0.2)" }}
            >
              {bio.length}/200
            </span>
          </div>

          {/* Role */}
          <div className="flex flex-col" style={{ gap: "10px" }}>
            <span className="font-poppins" style={labelStyle}>Role</span>
            <div className="flex flex-wrap" style={{ gap: "6px" }}>
              {ROLES.map(({ value, label }) => {
                const active = role === value;
                return (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setRole(value)}
                    className="font-poppins font-light uppercase transition-colors"
                    style={{
                      fontSize: "10px",
                      letterSpacing: "0.12em",
                      padding: "6px 12px",
                      background: active ? "var(--accent)" : "transparent",
                      border: `0.5px solid ${active ? "var(--accent)" : "rgba(var(--fg-rgb),0.15)"}`,
                      color: active ? "#fff" : "rgba(var(--fg-rgb),0.5)",
                      cursor: "pointer",
                      borderRadius: 0,
                    }}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Goals */}
          <div className="flex flex-col" style={{ gap: "10px" }}>
            <div className="flex items-baseline justify-between">
              <span className="font-poppins" style={labelStyle}>Goals</span>
              <span
                className="font-poppins font-light"
                style={{ fontSize: "10px", color: "rgba(var(--fg-rgb),0.2)", letterSpacing: "0.08em" }}
              >
                {goals.length}/5
              </span>
            </div>
            <div className="flex flex-wrap" style={{ gap: "6px" }}>
              {GOALS.map((g) => {
                const active = goals.includes(g);
                const maxed = !active && goals.length >= 5;
                return (
                  <button
                    key={g}
                    type="button"
                    onClick={() => toggleGoal(g)}
                    disabled={maxed}
                    className="font-poppins font-light uppercase transition-colors"
                    style={{
                      fontSize: "10px",
                      letterSpacing: "0.1em",
                      padding: "6px 12px",
                      background: active ? "var(--accent)" : "transparent",
                      border: `0.5px solid ${active ? "var(--accent)" : "rgba(var(--fg-rgb),0.15)"}`,
                      color: active ? "#fff" : maxed ? "rgba(var(--fg-rgb),0.2)" : "rgba(var(--fg-rgb),0.5)",
                      cursor: maxed ? "default" : "pointer",
                      borderRadius: 0,
                      opacity: maxed ? 0.5 : 1,
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
          className="flex items-center justify-between shrink-0"
          style={{
            padding: "16px 24px",
            borderTop: "0.5px solid rgba(var(--fg-rgb),0.08)",
            gap: "12px",
          }}
        >
          {/* Logout */}
          <button
            type="button"
            onClick={handleLogout}
            className="font-poppins uppercase transition-colors hover:text-[rgb(var(--fg-rgb))]"
            style={{
              fontSize: "10px",
              letterSpacing: "0.15em",
              color: "rgba(var(--fg-rgb),0.35)",
              background: "none",
              border: "none",
              cursor: "pointer",
              padding: 0,
            }}
          >
            Log out
          </button>

          {/* Save */}
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="font-poppins uppercase text-[var(--bg-primary)]"
            style={{
              fontSize: "11px",
              letterSpacing: "0.15em",
              fontWeight: 500,
              padding: "10px 24px",
              background: saving ? "rgba(var(--fg-rgb),0.4)" : "rgb(var(--fg-rgb))",
              border: "none",
              cursor: saving ? "not-allowed" : "pointer",
              transition: "background 150ms",
              borderRadius: 0,
            }}
          >
            {saving ? "Saving..." : "Save"}
          </button>
        </div>
      </div>
    </div>
  );
}
