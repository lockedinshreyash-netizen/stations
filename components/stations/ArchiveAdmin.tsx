"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronLeft, Plus, Trash2, ChevronRight } from "lucide-react";
import type { ArchiveCourse } from "@/types";
import { createCourse, deleteCourse } from "@/lib/archive/courses";
import { formatLessonCount } from "@/lib/archive/format";

export type AdminCourse = ArchiveCourse & { lesson_count: number };

const STATUS_COLOR: Record<string, string> = {
  published: "var(--accent-2)",
  draft: "rgba(var(--fg-rgb),0.4)",
  archived: "rgba(var(--fg-rgb),0.25)",
};

export default function ArchiveAdmin({
  initialCourses,
}: {
  initialCourses: AdminCourse[];
}) {
  const router = useRouter();
  const [courses, setCourses] = useState<AdminCourse[]>(initialCourses);
  const [newTitle, setNewTitle] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function create() {
    const t = newTitle.trim();
    if (!t) return;
    setBusy(true);
    setError("");
    try {
      const course = await createCourse({ title: t });
      router.push(`/archive/admin/${course.id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not create course.");
      setBusy(false);
    }
  }

  async function remove(id: string) {
    const prev = courses;
    setCourses((p) => p.filter((c) => c.id !== id));
    try {
      await deleteCourse(id);
    } catch {
      setCourses(prev);
      setError("Could not delete course.");
    }
  }

  return (
    <div className="px-5 md:px-10 py-10 max-w-3xl mx-auto flex flex-col" style={{ gap: "26px" }}>
      <Link
        href="/archive"
        className="inline-flex items-center gap-1.5 font-poppins uppercase w-fit"
        style={{
          fontSize: "12px",
          letterSpacing: "0.14em",
          color: "rgba(var(--fg-rgb),0.45)",
        }}
      >
        <ChevronLeft size={15} strokeWidth={2} />
        Archive
      </Link>

      <h1
        className="font-poppins font-black uppercase"
        style={{
          fontSize: "clamp(28px, 5vw, 44px)",
          lineHeight: 0.95,
          letterSpacing: "-0.02em",
          color: "rgb(var(--fg-rgb))",
        }}
      >
        Manage courses
      </h1>

      {/* Create */}
      <div className="flex items-center gap-2">
        <input
          value={newTitle}
          onChange={(e) => setNewTitle(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") create();
          }}
          placeholder="New course title…"
          className="st-field font-poppins flex-1"
          style={{
            background: "var(--bg-surface)",
            border: "0.5px solid rgba(var(--fg-rgb),0.12)",
            color: "rgb(var(--fg-rgb))",
            fontSize: "15px",
            padding: "12px 14px",
            outline: "none",
            borderRadius: "var(--radius-sm)",
          }}
        />
        <button
          type="button"
          onClick={create}
          disabled={busy || !newTitle.trim()}
          className="st-btn inline-flex items-center gap-1.5 font-poppins font-bold uppercase"
          style={{
            fontSize: "12px",
            letterSpacing: "0.1em",
            padding: "13px 20px",
            border: "none",
            background: "var(--accent)",
            color: "#fff",
            cursor: busy || !newTitle.trim() ? "not-allowed" : "pointer",
            opacity: busy || !newTitle.trim() ? 0.5 : 1,
          }}
        >
          <Plus size={15} strokeWidth={2.5} /> Create
        </button>
      </div>

      {error && (
        <p className="text-[var(--accent)]" style={{ fontSize: "14px" }}>
          {error}
        </p>
      )}

      {/* List */}
      <div className="flex flex-col gap-2">
        {courses.length === 0 && (
          <p
            className="font-playfair italic"
            style={{ fontSize: "17px", color: "rgba(var(--fg-rgb),0.3)" }}
          >
            No courses yet. Create your first above.
          </p>
        )}

        {courses.map((c) => (
          <div
            key={c.id}
            className="st-card flex items-center gap-3 pl-4 pr-3 py-3"
            style={{
              background: "var(--bg-surface)",
              border: "0.5px solid rgba(var(--fg-rgb),0.1)",
            }}
          >
            <Link
              href={`/archive/admin/${c.id}`}
              className="flex items-center gap-3 flex-1 min-w-0"
            >
              <div
                className="overflow-hidden shrink-0"
                style={{
                  width: "72px",
                  aspectRatio: "16 / 9",
                  borderRadius: "var(--radius-sm)",
                  background: "var(--bg-secondary)",
                }}
              >
                {c.thumbnail_url && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={c.thumbnail_url}
                    alt=""
                    className="w-full h-full object-cover"
                  />
                )}
              </div>
              <div className="flex flex-col min-w-0">
                <span
                  className="font-poppins font-medium truncate"
                  style={{ fontSize: "16px", color: "rgb(var(--fg-rgb))" }}
                >
                  {c.title}
                </span>
                <span
                  className="font-poppins"
                  style={{ fontSize: "12px", color: "rgba(var(--fg-rgb),0.4)" }}
                >
                  <span
                    className="uppercase"
                    style={{
                      letterSpacing: "0.1em",
                      color: STATUS_COLOR[c.status] ?? "rgba(var(--fg-rgb),0.4)",
                    }}
                  >
                    {c.status}
                  </span>
                  {" · "}
                  {formatLessonCount(c.lesson_count)}
                </span>
              </div>
            </Link>

            <button
              type="button"
              onClick={() => remove(c.id)}
              aria-label="Delete course"
              style={{ color: "rgba(var(--fg-rgb),0.35)", cursor: "pointer", padding: "8px" }}
            >
              <Trash2 size={16} strokeWidth={1.75} />
            </button>
            <Link
              href={`/archive/admin/${c.id}`}
              aria-label="Edit course"
              style={{ color: "rgba(var(--fg-rgb),0.35)", padding: "4px" }}
            >
              <ChevronRight size={18} strokeWidth={1.75} />
            </Link>
          </div>
        ))}
      </div>
    </div>
  );
}
