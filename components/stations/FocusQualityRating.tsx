"use client";

import { useState } from "react";
import { submitFocusRating, type FocusRecap } from "@/lib/work/sessions";
import { formatDuration } from "@/lib/work/format";

interface FocusQualityRatingProps {
  sessionId: string;
  userId: string;
  durationMinutes: number;
  othersCount: number;
  /** Existing rating if the user already rated — skips straight to recap. */
  existingRating: number | null;
  onDone: () => void;
}

export default function FocusQualityRating({
  sessionId,
  userId,
  durationMinutes,
  othersCount,
  existingRating,
  onDone,
}: FocusQualityRatingProps) {
  const [hover, setHover] = useState(0);
  const [selected, setSelected] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [recap, setRecap] = useState<FocusRecap | null>(
    existingRating
      ? {
          duration_minutes: durationMinutes,
          others_count: othersCount,
          focus_quality_rating: existingRating,
          focus_streak_days: 0,
        }
      : null
  );

  async function handleSubmit() {
    if (submitting || selected === 0) return;
    setSubmitting(true);
    setError(null);
    try {
      const result = await submitFocusRating(sessionId, userId, selected);
      setRecap(result);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to submit rating.");
      setSubmitting(false);
    }
  }

  const showStars = hover || selected;

  return (
    <div
      className="st-overlay fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.6)" }}
    >
      <div
        className="st-modal w-full max-w-md flex flex-col items-center gap-6 p-10 text-center"
        style={{ background: "var(--bg-secondary)", border: "0.5px solid rgba(var(--fg-rgb),0.12)" }}
      >
        {recap ? (
          <>
            <h2
              className="font-poppins font-black uppercase text-[rgb(var(--fg-rgb))]"
              style={{ fontSize: "19px", letterSpacing: "0.04em" }}
            >
              Session complete
            </h2>
            <p
              className="font-playfair italic text-[rgba(var(--fg-rgb),0.7)]"
              style={{ fontSize: "21px", lineHeight: 1.6 }}
            >
              You focused for {formatDuration(recap.duration_minutes)}
              {recap.others_count > 0
                ? ` with ${recap.others_count} ${recap.others_count === 1 ? "other" : "others"}`
                : ""}
              . Focus quality: {recap.focus_quality_rating}/5.
            </p>
            {!existingRating && recap.focus_streak_days > 0 && (
              <p className="font-poppins text-[rgba(var(--fg-rgb),0.5)]" style={{ fontSize: "16px" }}>
                🔥 {recap.focus_streak_days}-day focus streak
              </p>
            )}
            <button
              type="button"
              onClick={onDone}
              className="st-btn font-poppins font-bold uppercase mt-2"
              style={{
                fontSize: "15px",
                letterSpacing: "0.12em",
                background: "rgb(var(--fg-rgb))",
                color: "var(--bg-primary)",
                padding: "12px 28px",
              }}
            >
              Back to Work
            </button>
          </>
        ) : (
          <>
            <h2
              className="font-poppins font-black uppercase text-[rgb(var(--fg-rgb))]"
              style={{ fontSize: "19px", letterSpacing: "0.04em" }}
            >
              Rate your focus quality
            </h2>
            <div className="flex items-center gap-2" onMouseLeave={() => setHover(0)}>
              {[1, 2, 3, 4, 5].map((star) => {
                const active = star <= showStars;
                const isHover = hover > 0;
                return (
                  <button
                    key={star}
                    type="button"
                    onMouseEnter={() => setHover(star)}
                    onClick={() => setSelected(star)}
                    aria-label={`${star} star${star > 1 ? "s" : ""}`}
                    className="transition-transform hover:scale-110 leading-none"
                    style={{
                      fontSize: "48px",
                      color: active
                        ? isHover
                          ? "var(--accent)"
                          : "rgb(var(--fg-rgb))"
                        : "rgba(var(--fg-rgb),0.2)",
                    }}
                  >
                    {active ? "★" : "☆"}
                  </button>
                );
              })}
            </div>

            {error && (
              <p className="font-poppins" style={{ fontSize: "15px", color: "var(--accent)" }}>
                {error}
              </p>
            )}

            <button
              type="button"
              onClick={handleSubmit}
              disabled={submitting || selected === 0}
              className="st-btn font-poppins font-bold uppercase disabled:opacity-40"
              style={{
                fontSize: "15px",
                letterSpacing: "0.12em",
                background: "var(--accent)",
                color: "var(--bg-primary)",
                padding: "12px 28px",
              }}
            >
              {submitting ? "Submitting…" : "Submit"}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
