"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { updateCourse } from "@/lib/archive/courses";
import type { ArchiveCourse } from "@/types";

const MAX_IMG = 5 * 1024 * 1024;
const IMG_TYPES = ["image/jpeg", "image/png", "image/webp"];

const labelStyle: React.CSSProperties = {
  fontSize: "13px",
  letterSpacing: "0.16em",
  color: "rgba(var(--fg-rgb),0.35)",
  textTransform: "uppercase",
  fontWeight: 300,
};
const fieldStyle: React.CSSProperties = {
  background: "var(--bg-surface)",
  border: "0.5px solid rgba(var(--fg-rgb),0.12)",
  color: "rgb(var(--fg-rgb))",
  fontSize: "16px",
  padding: "11px 13px",
  outline: "none",
  width: "100%",
  fontFamily: "inherit",
  borderRadius: "var(--radius-sm)",
};

export default function CourseMetaForm({ course }: { course: ArchiveCourse }) {
  const [form, setForm] = useState({
    title: course.title,
    subtitle: course.subtitle ?? "",
    description: course.description ?? "",
    instructor_name: course.instructor_name ?? "",
    instructor_title: course.instructor_title ?? "",
    instructor_avatar_url: course.instructor_avatar_url ?? "",
    thumbnail_url: course.thumbnail_url ?? "",
    topic: course.topic ?? "",
    sort_order: course.sort_order ?? 0,
  });
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");
  const [thumbUploading, setThumbUploading] = useState(false);

  function set<K extends keyof typeof form>(key: K, value: (typeof form)[K]) {
    setForm((p) => ({ ...p, [key]: value }));
    setSaved(false);
  }

  async function handleThumb(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!IMG_TYPES.includes(file.type)) {
      setError("Thumbnail must be JPEG, PNG or WebP.");
      return;
    }
    if (file.size > MAX_IMG) {
      setError("Thumbnail must be under 5MB.");
      return;
    }
    setError("");
    setThumbUploading(true);
    try {
      const supabase = createClient();
      const ext = file.name.split(".").pop();
      const path = `${course.id}/${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage
        .from("course-thumbnails")
        .upload(path, file, { upsert: true });
      if (upErr) throw new Error(upErr.message);
      const { data } = supabase.storage
        .from("course-thumbnails")
        .getPublicUrl(path);
      set("thumbnail_url", data.publicUrl);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Thumbnail upload failed.");
    } finally {
      setThumbUploading(false);
    }
  }

  async function save() {
    if (!form.title.trim()) {
      setError("Title is required.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      await updateCourse(course.id, {
        title: form.title.trim(),
        subtitle: form.subtitle.trim() || null,
        description: form.description.trim() || null,
        instructor_name: form.instructor_name.trim(),
        instructor_title: form.instructor_title.trim() || null,
        instructor_avatar_url: form.instructor_avatar_url.trim() || null,
        thumbnail_url: form.thumbnail_url.trim() || null,
        topic: form.topic.trim() || null,
        sort_order: Number(form.sort_order) || 0,
      });
      setSaved(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex flex-col" style={{ gap: "18px" }}>
      <div className="grid gap-4" style={{ gridTemplateColumns: "1fr 1fr" }}>
        <Field label="Title">
          <input
            className="st-field"
            style={fieldStyle}
            value={form.title}
            onChange={(e) => set("title", e.target.value)}
          />
        </Field>
        <Field label="Topic (optional)">
          <input
            className="st-field"
            style={fieldStyle}
            value={form.topic}
            placeholder="e.g. Growth, Recovery"
            onChange={(e) => set("topic", e.target.value)}
          />
        </Field>
      </div>

      <Field label="Subtitle (optional)">
        <input
          className="st-field"
          style={fieldStyle}
          value={form.subtitle}
          onChange={(e) => set("subtitle", e.target.value)}
        />
      </Field>

      <Field label="Description">
        <textarea
          className="st-field resize-none"
          style={{ ...fieldStyle, lineHeight: 1.6 }}
          rows={4}
          value={form.description}
          onChange={(e) => set("description", e.target.value)}
        />
      </Field>

      <div className="grid gap-4" style={{ gridTemplateColumns: "1fr 1fr" }}>
        <Field label="Instructor name">
          <input
            className="st-field"
            style={fieldStyle}
            value={form.instructor_name}
            onChange={(e) => set("instructor_name", e.target.value)}
          />
        </Field>
        <Field label="Instructor title">
          <input
            className="st-field"
            style={fieldStyle}
            value={form.instructor_title}
            placeholder="e.g. Athlete · Recovery"
            onChange={(e) => set("instructor_title", e.target.value)}
          />
        </Field>
      </div>

      <div className="grid gap-4" style={{ gridTemplateColumns: "1fr 1fr" }}>
        <Field label="Instructor avatar URL (optional)">
          <input
            className="st-field"
            style={fieldStyle}
            value={form.instructor_avatar_url}
            onChange={(e) => set("instructor_avatar_url", e.target.value)}
          />
        </Field>
        <Field label="Sort order">
          <input
            type="number"
            className="st-field"
            style={fieldStyle}
            value={form.sort_order}
            onChange={(e) => set("sort_order", Number(e.target.value))}
          />
        </Field>
      </div>

      {/* Thumbnail */}
      <Field label="Catalog thumbnail">
        <div className="flex items-center gap-4">
          <div
            className="overflow-hidden shrink-0"
            style={{
              width: "160px",
              aspectRatio: "16 / 9",
              borderRadius: "var(--radius-sm)",
              background: "var(--bg-secondary)",
              border: "0.5px solid rgba(var(--fg-rgb),0.12)",
            }}
          >
            {form.thumbnail_url && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={form.thumbnail_url}
                alt=""
                className="w-full h-full object-cover"
              />
            )}
          </div>
          <label
            className="st-btn font-poppins uppercase cursor-pointer"
            style={{
              fontSize: "12px",
              letterSpacing: "0.12em",
              padding: "10px 16px",
              border: "0.5px solid rgba(var(--fg-rgb),0.2)",
              color: "rgba(var(--fg-rgb),0.7)",
              background: "var(--bg-surface)",
            }}
          >
            {thumbUploading ? "Uploading…" : "Upload image"}
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="hidden"
              onChange={handleThumb}
            />
          </label>
        </div>
      </Field>

      {error && (
        <p className="text-[var(--accent)]" style={{ fontSize: "14px" }}>
          {error}
        </p>
      )}

      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={save}
          disabled={saving}
          className="st-btn font-poppins font-black uppercase"
          style={{
            background: "rgb(var(--fg-rgb))",
            color: "var(--bg-primary)",
            fontSize: "13px",
            letterSpacing: "0.14em",
            padding: "12px 22px",
            border: "none",
            cursor: saving ? "not-allowed" : "pointer",
            opacity: saving ? 0.5 : 1,
          }}
        >
          {saving ? "Saving…" : "Save details"}
        </button>
        {saved && (
          <span
            className="font-poppins"
            style={{ fontSize: "13px", color: "var(--accent-2)" }}
          >
            Saved
          </span>
        )}
      </div>
    </div>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="flex flex-col" style={{ gap: "7px" }}>
      <span className="font-poppins" style={labelStyle}>
        {label}
      </span>
      {children}
    </label>
  );
}
