"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { tap } from "@/lib/feedback";
import type { ChallengeMetric, ChallengeType } from "@/types";

const METRICS: { value: ChallengeMetric; label: string }[] = [
  { value: "focus_minutes", label: "Focus minutes" },
  { value: "sessions_completed", label: "Sessions completed" },
  { value: "wins_posted", label: "Wins posted" },
  { value: "streak_days", label: "Day streak" },
];

const field =
  "st-field bg-[var(--bg-surface)] text-[rgb(var(--fg-rgb))] px-4 py-3 text-base outline-none border border-[rgba(var(--fg-rgb),0.12)] focus:border-[var(--accent)] placeholder:text-[rgba(var(--fg-rgb),0.25)]";
const lbl =
  "font-poppins uppercase text-[rgba(var(--fg-rgb),0.4)] mb-2 block";
const lblStyle = { fontSize: "13px", letterSpacing: "0.15em" } as const;

/** Admin-only composer for a fixed-window challenge. RLS additionally blocks
 * non-admins from inserting, so this form is safe even if reached directly. */
export default function ChallengeAdminForm({ userId }: { userId: string }) {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [type, setType] = useState<ChallengeType>("weekly");
  const [category, setCategory] = useState("");
  const [metric, setMetric] = useState<ChallengeMetric>("focus_minutes");
  const [target, setTarget] = useState("");
  const [startsAt, setStartsAt] = useState("");
  const [endsAt, setEndsAt] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    const targetNum = parseInt(target, 10);
    if (!title.trim() || !description.trim()) {
      setError("Title and description are required.");
      return;
    }
    if (!Number.isFinite(targetNum) || targetNum <= 0) {
      setError("Target must be a positive number.");
      return;
    }
    if (!startsAt || !endsAt) {
      setError("Set a start and end date.");
      return;
    }
    if (new Date(startsAt) >= new Date(endsAt)) {
      setError("End must be after start.");
      return;
    }
    tap();
    setSaving(true);
    setError(null);
    const supabase = createClient();
    const { error: err } = await supabase.from("challenges").insert({
      title: title.trim(),
      description: description.trim(),
      type,
      category: category.trim() || null,
      metric,
      target_value: targetNum,
      starts_at: new Date(startsAt).toISOString(),
      ends_at: new Date(endsAt).toISOString(),
      created_by: userId,
    });
    if (err) {
      setError(err.message);
      setSaving(false);
      return;
    }
    router.push("/compete");
  }

  return (
    <div className="px-5 md:px-10 py-12 max-w-xl flex flex-col gap-5">
      <div>
        <label className={lbl} style={lblStyle}>
          Title
        </label>
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          maxLength={120}
          placeholder="7-Day Focus Sprint"
          className={`${field} w-full`}
        />
      </div>

      <div>
        <label className={lbl} style={lblStyle}>
          Description
        </label>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={3}
          maxLength={500}
          placeholder="Rack up the most deep-work minutes this week."
          className={`${field} w-full resize-none`}
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className={lbl} style={lblStyle}>
            Cadence
          </label>
          <select
            value={type}
            onChange={(e) => setType(e.target.value as ChallengeType)}
            className={`${field} w-full`}
          >
            <option value="weekly">Weekly</option>
            <option value="monthly">Monthly</option>
          </select>
        </div>
        <div>
          <label className={lbl} style={lblStyle}>
            Metric
          </label>
          <select
            value={metric}
            onChange={(e) => setMetric(e.target.value as ChallengeMetric)}
            className={`${field} w-full`}
          >
            {METRICS.map((m) => (
              <option key={m.value} value={m.value}>
                {m.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className={lbl} style={lblStyle}>
            Target value
          </label>
          <input
            type="number"
            min={1}
            value={target}
            onChange={(e) => setTarget(e.target.value)}
            placeholder="300"
            className={`${field} w-full`}
          />
        </div>
        <div>
          <label className={lbl} style={lblStyle}>
            Category (optional)
          </label>
          <input
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            placeholder="e.g. builder"
            className={`${field} w-full`}
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className={lbl} style={lblStyle}>
            Starts
          </label>
          <input
            type="datetime-local"
            value={startsAt}
            onChange={(e) => setStartsAt(e.target.value)}
            className={`${field} w-full`}
          />
        </div>
        <div>
          <label className={lbl} style={lblStyle}>
            Ends
          </label>
          <input
            type="datetime-local"
            value={endsAt}
            onChange={(e) => setEndsAt(e.target.value)}
            className={`${field} w-full`}
          />
        </div>
      </div>

      {error && (
        <span className="text-[var(--accent)]" style={{ fontSize: "14px" }}>
          {error}
        </span>
      )}

      <button
        type="button"
        onClick={submit}
        disabled={saving}
        className="st-btn self-start font-poppins font-black uppercase"
        style={{
          background: "rgb(var(--fg-rgb))",
          color: "var(--bg-primary)",
          fontSize: "14px",
          letterSpacing: "0.15em",
          padding: "12px 24px",
          border: "none",
          cursor: saving ? "default" : "pointer",
          opacity: saving ? 0.5 : 1,
        }}
      >
        {saving ? "Creating…" : "Create challenge"}
      </button>
    </div>
  );
}
