"use client";

import { useState, useMemo } from "react";
import { createSession } from "@/lib/work/sessions";
import { formatDuration } from "@/lib/work/format";
import type { WorkCategory, WorkSession } from "@/types";

const CATEGORIES: { value: WorkCategory; label: string }[] = [
  { value: "scholar", label: "Scholar" },
  { value: "builder", label: "Builder" },
  { value: "creator", label: "Creator" },
  { value: "athlete", label: "Athlete" },
];

const DURATIONS = [30, 60, 90, 120];

const MAX_TITLE = 100;

interface CreateSessionModalProps {
  hostId: string;
  /** Caller's capitalized category, used as the default selection. */
  defaultCategory: WorkCategory;
  onClose: () => void;
  onCreated: (session: WorkSession) => void;
}

export default function CreateSessionModal({
  hostId,
  defaultCategory,
  onClose,
  onCreated,
}: CreateSessionModalProps) {
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState<WorkCategory>(defaultCategory);
  const [duration, setDuration] = useState(60);
  const [customDuration, setCustomDuration] = useState("");
  const [isCustom, setIsCustom] = useState(false);
  const [startNow, setStartNow] = useState(true);
  const [startTime, setStartTime] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const durationMinutes = isCustom
    ? Math.max(0, parseInt(customDuration, 10) || 0)
    : duration;

  // Auto-calculated end time preview when scheduling.
  const endPreview = useMemo(() => {
    if (startNow || !startTime || durationMinutes <= 0) return null;
    const start = new Date(startTime);
    if (Number.isNaN(start.getTime())) return null;
    const end = new Date(start.getTime() + durationMinutes * 60_000);
    return end.toLocaleString(undefined, {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  }, [startNow, startTime, durationMinutes]);

  async function handleSubmit() {
    if (submitting) return;
    setError(null);

    if (!title.trim()) return setError("Give your session a title.");
    if (durationMinutes <= 0) return setError("Duration must be at least 1 minute.");
    if (!startNow && !startTime) return setError("Pick a start time.");
    if (!startNow) {
      const start = new Date(startTime);
      if (Number.isNaN(start.getTime())) return setError("Invalid start time.");
      if (start.getTime() < Date.now() - 60_000)
        return setError("Start time can't be in the past.");
    }

    setSubmitting(true);
    try {
      const session = await createSession({
        hostId,
        title,
        category,
        durationMinutes,
        startNow,
        scheduledStartTime: startNow
          ? undefined
          : new Date(startTime).toISOString(),
      });
      onCreated(session);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create session.");
      setSubmitting(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.7)" }}
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg flex flex-col gap-6 p-8 max-h-[90vh] overflow-y-auto"
        style={{ background: "var(--bg-secondary)", border: "0.5px solid rgba(var(--fg-rgb),0.12)" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-baseline justify-between">
          <h2
            className="font-poppins font-black uppercase text-[rgb(var(--fg-rgb))]"
            style={{ fontSize: "16px", letterSpacing: "0.04em" }}
          >
            New Session
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="text-[rgba(var(--fg-rgb),0.4)] hover:text-[rgb(var(--fg-rgb))] transition-colors"
            style={{ fontSize: "18px" }}
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        {/* Title */}
        <Field label="Title">
          <input
            type="text"
            value={title}
            maxLength={MAX_TITLE}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Class 12 JEE Physics solving"
            className="w-full bg-transparent font-poppins text-[rgb(var(--fg-rgb))] placeholder:text-[rgba(var(--fg-rgb),0.25)] focus:outline-none"
            style={{ fontSize: "14px", padding: "10px 0", borderBottom: "0.5px solid rgba(var(--fg-rgb),0.15)" }}
          />
          <span className="font-poppins text-[rgba(var(--fg-rgb),0.25)]" style={{ fontSize: "10px" }}>
            {title.length}/{MAX_TITLE}
          </span>
        </Field>

        {/* Category */}
        <Field label="Category">
          <div className="flex flex-wrap gap-2">
            {CATEGORIES.map((c) => (
              <button
                key={c.value}
                type="button"
                onClick={() => setCategory(c.value)}
                className="font-poppins font-medium uppercase transition-colors"
                style={{
                  fontSize: "11px",
                  letterSpacing: "0.08em",
                  padding: "8px 16px",
                  border: "0.5px solid rgba(var(--fg-rgb),0.15)",
                  background: category === c.value ? "var(--accent)" : "transparent",
                  color: category === c.value ? "var(--bg-primary)" : "rgba(var(--fg-rgb),0.6)",
                }}
              >
                {c.label}
              </button>
            ))}
          </div>
        </Field>

        {/* Duration */}
        <Field label="Duration">
          <div className="flex flex-wrap gap-2">
            {DURATIONS.map((d) => (
              <button
                key={d}
                type="button"
                onClick={() => {
                  setIsCustom(false);
                  setDuration(d);
                }}
                className="font-poppins font-medium transition-colors"
                style={{
                  fontSize: "11px",
                  padding: "8px 16px",
                  border: "0.5px solid rgba(var(--fg-rgb),0.15)",
                  background: !isCustom && duration === d ? "var(--accent)" : "transparent",
                  color: !isCustom && duration === d ? "var(--bg-primary)" : "rgba(var(--fg-rgb),0.6)",
                }}
              >
                {formatDuration(d)}
              </button>
            ))}
            <button
              type="button"
              onClick={() => setIsCustom(true)}
              className="font-poppins font-medium transition-colors"
              style={{
                fontSize: "11px",
                padding: "8px 16px",
                border: "0.5px solid rgba(var(--fg-rgb),0.15)",
                background: isCustom ? "var(--accent)" : "transparent",
                color: isCustom ? "var(--bg-primary)" : "rgba(var(--fg-rgb),0.6)",
              }}
            >
              Custom
            </button>
          </div>
          {isCustom && (
            <input
              type="number"
              min={1}
              value={customDuration}
              onChange={(e) => setCustomDuration(e.target.value)}
              placeholder="Minutes"
              className="w-32 bg-transparent font-poppins text-[rgb(var(--fg-rgb))] placeholder:text-[rgba(var(--fg-rgb),0.25)] focus:outline-none mt-2"
              style={{ fontSize: "14px", padding: "8px 0", borderBottom: "0.5px solid rgba(var(--fg-rgb),0.15)" }}
            />
          )}
        </Field>

        {/* Start now vs schedule */}
        <Field label="When">
          <div className="flex gap-2">
            <Toggle active={startNow} onClick={() => setStartNow(true)}>
              Start now
            </Toggle>
            <Toggle active={!startNow} onClick={() => setStartNow(false)}>
              Schedule
            </Toggle>
          </div>
          {!startNow && (
            <div className="mt-3 flex flex-col gap-2">
              <input
                type="datetime-local"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                className="bg-transparent font-poppins text-[rgb(var(--fg-rgb))] focus:outline-none"
                style={{
                  fontSize: "13px",
                  padding: "8px 0",
                  borderBottom: "0.5px solid rgba(var(--fg-rgb),0.15)",
                  colorScheme: "dark",
                }}
              />
              {endPreview && (
                <span className="font-poppins text-[rgba(var(--fg-rgb),0.4)]" style={{ fontSize: "11px" }}>
                  Ends {endPreview}
                </span>
              )}
            </div>
          )}
        </Field>

        {error && (
          <p className="font-poppins" style={{ fontSize: "12px", color: "var(--accent)" }}>
            {error}
          </p>
        )}

        <button
          type="button"
          onClick={handleSubmit}
          disabled={submitting}
          className="font-poppins font-bold uppercase disabled:opacity-50"
          style={{
            fontSize: "12px",
            letterSpacing: "0.12em",
            background: "rgb(var(--fg-rgb))",
            color: "var(--bg-primary)",
            padding: "14px",
          }}
        >
          {submitting ? "Creating…" : startNow ? "Start Session" : "Schedule Session"}
        </button>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-2">
      <label
        className="font-poppins font-bold uppercase text-[rgba(var(--fg-rgb),0.4)]"
        style={{ fontSize: "10px", letterSpacing: "0.18em" }}
      >
        {label}
      </label>
      {children}
    </div>
  );
}

function Toggle({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="font-poppins font-medium uppercase transition-colors"
      style={{
        fontSize: "11px",
        letterSpacing: "0.08em",
        padding: "8px 16px",
        border: "0.5px solid rgba(var(--fg-rgb),0.15)",
        background: active ? "var(--accent)" : "transparent",
        color: active ? "var(--bg-primary)" : "rgba(var(--fg-rgb),0.6)",
      }}
    >
      {children}
    </button>
  );
}
