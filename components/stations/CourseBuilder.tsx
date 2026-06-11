"use client";

import { useState } from "react";
import Link from "next/link";
import { ChevronLeft, Plus, Eye } from "lucide-react";
import type { ArchiveCourse, ArchiveLesson, CourseStatus } from "@/types";
import {
  createLesson,
  deleteLesson,
  reorderLessons,
  setCourseStatus,
} from "@/lib/archive/courses";
import CourseMetaForm from "./CourseMetaForm";
import LessonUploader from "./LessonUploader";

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <h2
      className="font-poppins font-bold uppercase"
      style={{
        fontSize: "13px",
        letterSpacing: "0.2em",
        color: "rgba(var(--fg-rgb),0.4)",
      }}
    >
      {children}
    </h2>
  );
}

export default function CourseBuilder({
  course,
  initialLessons,
}: {
  course: ArchiveCourse;
  initialLessons: ArchiveLesson[];
}) {
  const [lessons, setLessons] = useState<ArchiveLesson[]>(initialLessons);
  const [status, setStatus] = useState<CourseStatus>(course.status);
  const [newTitle, setNewTitle] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const published = status === "published";
  const readyCount = lessons.filter((l) => l.status === "ready").length;

  async function addLesson() {
    const t = newTitle.trim();
    if (!t) return;
    setBusy(true);
    setError("");
    try {
      const created = await createLesson(course.id, t, null, lessons.length);
      setLessons((prev) => [...prev, created]);
      setNewTitle("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not add lesson.");
    } finally {
      setBusy(false);
    }
  }

  function updateLessonInList(updated: ArchiveLesson) {
    setLessons((prev) =>
      prev.map((l) => (l.id === updated.id ? { ...l, ...updated } : l))
    );
  }

  async function removeLesson(lessonId: string) {
    const prev = lessons;
    setLessons((p) => p.filter((l) => l.id !== lessonId));
    try {
      await deleteLesson(lessonId);
    } catch {
      setLessons(prev); // restore on failure
      setError("Could not delete lesson.");
    }
  }

  function moveLesson(lessonId: string, dir: -1 | 1) {
    const idx = lessons.findIndex((l) => l.id === lessonId);
    const target = idx + dir;
    if (idx < 0 || target < 0 || target >= lessons.length) return;
    const next = [...lessons];
    [next[idx], next[target]] = [next[target], next[idx]];
    const reordered = next.map((l, i) => ({ ...l, order_index: i }));
    setLessons(reordered);
    void reorderLessons(reordered.map((l) => l.id)).catch(() => {});
  }

  async function togglePublish() {
    const next: CourseStatus = published ? "draft" : "published";
    setBusy(true);
    setError("");
    try {
      await setCourseStatus(course.id, next);
      setStatus(next);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not change status.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="px-5 md:px-10 py-8 max-w-4xl mx-auto flex flex-col" style={{ gap: "30px" }}>
      <Link
        href="/archive/admin"
        className="inline-flex items-center gap-1.5 font-poppins uppercase w-fit"
        style={{
          fontSize: "12px",
          letterSpacing: "0.14em",
          color: "rgba(var(--fg-rgb),0.45)",
        }}
      >
        <ChevronLeft size={15} strokeWidth={2} />
        All courses
      </Link>

      {/* Header + publish controls */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="flex flex-col gap-1.5">
          <span
            className="font-poppins uppercase"
            style={{
              fontSize: "12px",
              letterSpacing: "0.16em",
              color: published ? "var(--accent-2)" : "rgba(var(--fg-rgb),0.4)",
            }}
          >
            {published ? "Published" : "Draft"}
          </span>
          <h1
            className="font-poppins font-black uppercase"
            style={{
              fontSize: "clamp(26px, 4vw, 38px)",
              lineHeight: 1,
              letterSpacing: "-0.02em",
              color: "rgb(var(--fg-rgb))",
            }}
          >
            {course.title}
          </h1>
        </div>

        <div className="flex items-center gap-2">
          {published && (
            <Link
              href={`/archive/${course.id}`}
              className="st-pill inline-flex items-center gap-1.5 font-poppins uppercase"
              style={{
                fontSize: "12px",
                letterSpacing: "0.1em",
                padding: "10px 14px",
                color: "rgba(var(--fg-rgb),0.6)",
                border: "0.5px solid rgba(var(--fg-rgb),0.18)",
              }}
            >
              <Eye size={14} strokeWidth={1.75} /> View live
            </Link>
          )}
          <button
            type="button"
            onClick={togglePublish}
            disabled={busy}
            className="st-btn font-poppins font-black uppercase"
            style={{
              fontSize: "12px",
              letterSpacing: "0.12em",
              padding: "11px 18px",
              border: "none",
              cursor: busy ? "not-allowed" : "pointer",
              background: published ? "var(--bg-surface)" : "var(--accent)",
              color: published ? "rgba(var(--fg-rgb),0.7)" : "#fff",
              boxShadow: published ? "none" : undefined,
              opacity: busy ? 0.6 : 1,
              borderColor: published ? "rgba(var(--fg-rgb),0.2)" : undefined,
              borderWidth: published ? "0.5px" : undefined,
              borderStyle: published ? "solid" : undefined,
            }}
          >
            {published ? "Unpublish" : "Publish"}
          </button>
        </div>
      </div>

      {!published && readyCount === 0 && (
        <p
          className="font-playfair italic"
          style={{ fontSize: "15px", color: "rgba(var(--fg-rgb),0.4)" }}
        >
          Add at least one lesson with a processed video before publishing.
        </p>
      )}

      {error && (
        <p className="text-[var(--accent)]" style={{ fontSize: "14px" }}>
          {error}
        </p>
      )}

      {/* Course details */}
      <section className="flex flex-col gap-4">
        <SectionLabel>Course details</SectionLabel>
        <CourseMetaForm course={course} />
      </section>

      {/* Lessons */}
      <section className="flex flex-col gap-4">
        <SectionLabel>Lessons ({lessons.length})</SectionLabel>

        <div className="flex flex-col gap-3">
          {lessons.map((lesson, i) => (
            <LessonUploader
              key={lesson.id}
              lesson={lesson}
              index={i}
              total={lessons.length}
              onUpdated={updateLessonInList}
              onDelete={removeLesson}
              onMove={moveLesson}
            />
          ))}
        </div>

        {/* Add lesson */}
        <div className="flex items-center gap-2">
          <input
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") addLesson();
            }}
            placeholder="New lesson title…"
            className="st-field font-poppins flex-1"
            style={{
              background: "var(--bg-surface)",
              border: "0.5px solid rgba(var(--fg-rgb),0.12)",
              color: "rgb(var(--fg-rgb))",
              fontSize: "15px",
              padding: "11px 13px",
              outline: "none",
              borderRadius: "var(--radius-sm)",
            }}
          />
          <button
            type="button"
            onClick={addLesson}
            disabled={busy || !newTitle.trim()}
            className="st-btn inline-flex items-center gap-1.5 font-poppins font-bold uppercase"
            style={{
              fontSize: "12px",
              letterSpacing: "0.1em",
              padding: "12px 18px",
              border: "none",
              background: "rgb(var(--fg-rgb))",
              color: "var(--bg-primary)",
              cursor: busy || !newTitle.trim() ? "not-allowed" : "pointer",
              opacity: busy || !newTitle.trim() ? 0.5 : 1,
            }}
          >
            <Plus size={15} strokeWidth={2.5} /> Add
          </button>
        </div>
      </section>
    </div>
  );
}
