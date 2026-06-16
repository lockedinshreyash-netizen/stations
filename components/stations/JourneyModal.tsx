"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type {
  Journey,
  JourneyCategory,
  JourneyStage,
  JourneyWithAuthor,
} from "@/types";
import {
  JOURNEY_CATEGORIES,
  JOURNEY_STAGES,
  JOURNEY_EMOJIS,
} from "@/lib/journeys/meta";

const fieldStyle: React.CSSProperties = {
  background: "var(--bg-surface)",
  border: "0.5px solid rgba(var(--fg-rgb),0.12)",
  color: "rgb(var(--fg-rgb))",
  fontSize: "17px",
  padding: "12px 14px",
  outline: "none",
  width: "100%",
  fontFamily: "inherit",
  borderRadius: "var(--radius-sm)",
};

const labelStyle: React.CSSProperties = {
  fontSize: "13px",
  letterSpacing: "0.18em",
  color: "rgba(var(--fg-rgb),0.3)",
  textTransform: "uppercase",
  fontWeight: 300,
};

interface JourneyModalProps {
  mode: "create" | "edit";
  journey?: Journey;
  onClose: () => void;
  onSaved: (journey: JourneyWithAuthor) => void;
}

export default function JourneyModal({
  mode,
  journey,
  onClose,
  onSaved,
}: JourneyModalProps) {
  const [emoji, setEmoji] = useState(journey?.emoji ?? "🚀");
  const [title, setTitle] = useState(journey?.title ?? "");
  const [category, setCategory] = useState<JourneyCategory>(
    journey?.category ?? "other"
  );
  const [stage, setStage] = useState<JourneyStage>(journey?.stage ?? "building");
  const [why, setWhy] = useState(journey?.why ?? "");
  const [challenges, setChallenges] = useState(journey?.challenges ?? "");
  const [openToConnect, setOpenToConnect] = useState(
    journey?.is_open_to_connect ?? true
  );
  const [loading, setLoading] = useState(false);
  const [serverError, setServerError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmedTitle = title.trim();
    if (trimmedTitle.length < 1) {
      setServerError("Give your journey a title.");
      return;
    }
    setLoading(true);
    setServerError("");

    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      setServerError("Session expired.");
      setLoading(false);
      return;
    }

    const payload = {
      emoji,
      title: trimmedTitle,
      category,
      stage,
      why: why.trim() || null,
      challenges: challenges.trim() || null,
      is_open_to_connect: openToConnect,
    };

    const sel = "*, users(username, avatar_url, founder_number)";
    const { data, error } =
      mode === "create"
        ? await supabase
            .from("journeys")
            .insert({ user_id: user.id, ...payload })
            .select(sel)
            .single()
        : await supabase
            .from("journeys")
            .update({
              ...payload,
              last_activity_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            })
            .eq("id", journey!.id)
            .eq("user_id", user.id)
            .select(sel)
            .single();

    if (error || !data) {
      setServerError(error?.message ?? "Could not save. Try again.");
      setLoading(false);
      return;
    }

    onSaved(data as unknown as JourneyWithAuthor);
  }

  const titleLen = title.length;
  const whyLen = why.length;

  return (
    <div
      className="st-overlay fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.6)" }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="st-modal w-full flex flex-col"
        style={{
          maxWidth: "560px",
          maxHeight: "90vh",
          overflowY: "auto",
          background: "var(--bg-secondary)",
          border: "0.5px solid rgba(var(--fg-rgb),0.1)",
        }}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between px-8 py-6 sticky top-0"
          style={{
            borderBottom: "0.5px solid rgba(var(--fg-rgb),0.08)",
            background: "var(--bg-secondary)",
            zIndex: 1,
          }}
        >
          <span
            className="font-poppins font-black uppercase text-[rgb(var(--fg-rgb))]"
            style={{ fontSize: "24px", letterSpacing: "0.05em" }}
          >
            {mode === "create" ? "SHARE YOUR JOURNEY" : "EDIT JOURNEY"}
          </span>
          <button
            onClick={onClose}
            className="text-[rgba(var(--fg-rgb),0.4)] hover:text-[rgb(var(--fg-rgb))] transition-colors"
            style={{
              fontSize: "24px",
              lineHeight: 1,
              background: "none",
              border: "none",
              cursor: "pointer",
              padding: "0 0 2px 8px",
            }}
          >
            ×
          </button>
        </div>

        <form
          onSubmit={handleSubmit}
          className="flex flex-col px-8 py-6"
          style={{ gap: "22px" }}
        >
          {/* Emoji */}
          <div className="flex flex-col" style={{ gap: "10px" }}>
            <label className="font-poppins" style={labelStyle}>
              Pick an icon
            </label>
            <div className="flex flex-wrap" style={{ gap: "6px" }}>
              {JOURNEY_EMOJIS.map((em) => {
                const active = emoji === em;
                return (
                  <button
                    key={em}
                    type="button"
                    onClick={() => setEmoji(em)}
                    aria-label={`Use ${em}`}
                    className="flex items-center justify-center"
                    style={{
                      width: "40px",
                      height: "40px",
                      fontSize: "20px",
                      lineHeight: 1,
                      borderRadius: "var(--radius-sm)",
                      background: active
                        ? "rgba(var(--accent-rgb),0.12)"
                        : "var(--bg-surface)",
                      border: active
                        ? "0.5px solid rgba(var(--accent-rgb),0.45)"
                        : "0.5px solid rgba(var(--fg-rgb),0.1)",
                      cursor: "pointer",
                    }}
                  >
                    {em}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Category */}
          <div className="flex flex-col" style={{ gap: "10px" }}>
            <label className="font-poppins" style={labelStyle}>
              Category
            </label>
            <div className="flex flex-wrap" style={{ gap: "6px" }}>
              {JOURNEY_CATEGORIES.map((c) => {
                const active = category === c.value;
                return (
                  <button
                    key={c.value}
                    type="button"
                    onClick={() => setCategory(c.value)}
                    className="st-pill font-poppins font-light uppercase"
                    style={{
                      fontSize: "13px",
                      letterSpacing: "0.15em",
                      padding: "6px 12px",
                      background: active
                        ? "rgb(var(--fg-rgb))"
                        : "var(--bg-surface)",
                      color: active
                        ? "var(--bg-primary)"
                        : "rgba(var(--fg-rgb),0.45)",
                      border: active
                        ? "none"
                        : "0.5px solid rgba(var(--fg-rgb),0.15)",
                      cursor: "pointer",
                    }}
                  >
                    {c.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Title */}
          <div className="flex flex-col" style={{ gap: "8px" }}>
            <div className="flex items-center justify-between">
              <label className="font-poppins" style={labelStyle}>
                What are you pursuing?
              </label>
              <span
                className="font-poppins font-light"
                style={{
                  fontSize: "13px",
                  color:
                    titleLen > 72
                      ? "var(--accent)"
                      : "rgba(var(--fg-rgb),0.2)",
                }}
              >
                {titleLen}/80
              </span>
            </div>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              maxLength={80}
              placeholder="e.g. Building an AI startup"
              className="st-field font-poppins text-[rgb(var(--fg-rgb))] outline-none"
              style={fieldStyle}
            />
          </div>

          {/* Stage */}
          <div className="flex flex-col" style={{ gap: "10px" }}>
            <label className="font-poppins" style={labelStyle}>
              Current stage
            </label>
            <div className="flex flex-wrap" style={{ gap: "6px" }}>
              {JOURNEY_STAGES.map((s) => {
                const active = stage === s.value;
                return (
                  <button
                    key={s.value}
                    type="button"
                    onClick={() => setStage(s.value)}
                    className="st-pill font-poppins font-light uppercase"
                    style={{
                      fontSize: "13px",
                      letterSpacing: "0.15em",
                      padding: "6px 12px",
                      background: active
                        ? "rgb(var(--fg-rgb))"
                        : "var(--bg-surface)",
                      color: active
                        ? "var(--bg-primary)"
                        : "rgba(var(--fg-rgb),0.45)",
                      border: active
                        ? "none"
                        : "0.5px solid rgba(var(--fg-rgb),0.15)",
                      cursor: "pointer",
                    }}
                  >
                    {s.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Why */}
          <div className="flex flex-col" style={{ gap: "8px" }}>
            <div className="flex items-center justify-between">
              <label className="font-poppins" style={labelStyle}>
                Why this matters to you
              </label>
              <span
                className="font-poppins font-light"
                style={{
                  fontSize: "13px",
                  color:
                    whyLen > 540 ? "var(--accent)" : "rgba(var(--fg-rgb),0.2)",
                }}
              >
                {whyLen}/600
              </span>
            </div>
            <textarea
              value={why}
              onChange={(e) => setWhy(e.target.value)}
              rows={4}
              maxLength={600}
              placeholder="Your story. Why are you chasing this?"
              className="st-field font-poppins text-[rgb(var(--fg-rgb))] outline-none resize-none"
              style={{ ...fieldStyle, lineHeight: 1.7 }}
            />
          </div>

          {/* Challenges (optional) */}
          <div className="flex flex-col" style={{ gap: "8px" }}>
            <label className="font-poppins" style={labelStyle}>
              Current challenge <span style={{ opacity: 0.5 }}>(optional)</span>
            </label>
            <textarea
              value={challenges}
              onChange={(e) => setChallenges(e.target.value)}
              rows={2}
              maxLength={400}
              placeholder="What's the hardest part right now?"
              className="st-field font-poppins text-[rgb(var(--fg-rgb))] outline-none resize-none"
              style={{ ...fieldStyle, lineHeight: 1.7 }}
            />
          </div>

          {/* Open to connect */}
          <button
            type="button"
            onClick={() => setOpenToConnect((v) => !v)}
            className="flex items-center justify-between"
            style={{
              background: "var(--bg-surface)",
              border: "0.5px solid rgba(var(--fg-rgb),0.12)",
              borderRadius: "var(--radius-sm)",
              padding: "12px 14px",
              cursor: "pointer",
            }}
          >
            <span
              className="font-poppins font-light text-left"
              style={{ fontSize: "15px", color: "rgba(var(--fg-rgb),0.6)" }}
            >
              Open to connect with others on this
            </span>
            <span
              aria-hidden
              style={{
                width: "42px",
                height: "24px",
                borderRadius: "999px",
                background: openToConnect
                  ? "var(--accent)"
                  : "rgba(var(--fg-rgb),0.15)",
                position: "relative",
                flexShrink: 0,
                transition: "background 150ms",
              }}
            >
              <span
                style={{
                  position: "absolute",
                  top: "3px",
                  left: openToConnect ? "21px" : "3px",
                  width: "18px",
                  height: "18px",
                  borderRadius: "50%",
                  background: "#fff",
                  transition: "left 150ms",
                }}
              />
            </span>
          </button>

          {serverError && (
            <p className="text-[var(--accent)]" style={{ fontSize: "15px" }}>
              {serverError}
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="st-btn font-poppins font-black uppercase text-[var(--bg-primary)]"
            style={{
              background: "rgb(var(--fg-rgb))",
              fontSize: "15px",
              letterSpacing: "0.15em",
              padding: "16px",
              border: "none",
              cursor: loading ? "not-allowed" : "pointer",
              opacity: loading ? 0.5 : 1,
            }}
          >
            {loading
              ? "Saving…"
              : mode === "create"
                ? "SHARE IT"
                : "SAVE CHANGES"}
          </button>
        </form>
      </div>
    </div>
  );
}
