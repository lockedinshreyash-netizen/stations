"use client";

import Link from "next/link";
import { Lock, Play } from "lucide-react";
import type { ArchiveCourseWithMeta } from "@/types";
import { formatRuntime, formatLessonCount } from "@/lib/archive/format";

/**
 * Catalog tile. Always links to the course detail page — free members land on
 * the locked detail (with the upsell), which is the intended "see what you're
 * missing" funnel. The lock chip here is purely informational.
 */
export default function CourseCard({
  course,
  locked,
}: {
  course: ArchiveCourseWithMeta;
  locked: boolean;
}) {
  const inProgress = course.progress_percent > 0 && course.progress_percent < 100;
  const done = course.progress_percent >= 100 && course.lesson_count > 0;

  return (
    <Link
      href={`/archive/${course.id}`}
      className="st-card st-card-hover group flex flex-col overflow-hidden"
      style={{
        background: "var(--bg-surface)",
        border: "0.5px solid rgba(var(--fg-rgb),0.1)",
      }}
    >
      {/* Thumbnail */}
      <div
        className="relative w-full overflow-hidden"
        style={{ aspectRatio: "16 / 9", background: "var(--bg-secondary)" }}
      >
        {course.thumbnail_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={course.thumbnail_url}
            alt=""
            className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <span
              className="font-poppins font-black uppercase"
              style={{ fontSize: "40px", color: "rgba(var(--fg-rgb),0.08)" }}
            >
              {course.title.slice(0, 1)}
            </span>
          </div>
        )}

        {/* Play / lock affordance */}
        <span
          className="absolute flex items-center justify-center"
          style={{
            bottom: "10px",
            right: "10px",
            width: "34px",
            height: "34px",
            borderRadius: "9999px",
            background: "rgba(0,0,0,0.55)",
            color: "#fff",
            backdropFilter: "blur(4px)",
          }}
        >
          {locked ? <Lock size={15} strokeWidth={2} /> : <Play size={15} strokeWidth={2} />}
        </span>

        {/* Progress bar pinned to the bottom edge */}
        {(inProgress || done) && (
          <span
            aria-hidden
            style={{
              position: "absolute",
              left: 0,
              bottom: 0,
              height: "3px",
              width: `${course.progress_percent}%`,
              background: "var(--accent)",
            }}
          />
        )}
      </div>

      {/* Body */}
      <div className="flex flex-col px-4 pt-3 pb-4" style={{ gap: "6px" }}>
        {course.topic && (
          <span
            className="font-poppins font-bold uppercase"
            style={{
              fontSize: "11px",
              letterSpacing: "0.18em",
              color: "rgba(var(--accent-2-rgb),0.7)",
            }}
          >
            {course.topic}
          </span>
        )}

        <h3
          className="font-poppins font-bold leading-snug"
          style={{ fontSize: "17px", color: "rgb(var(--fg-rgb))" }}
        >
          {course.title}
        </h3>

        {course.instructor_name && (
          <p
            className="font-playfair italic"
            style={{ fontSize: "14px", color: "rgba(var(--fg-rgb),0.45)" }}
          >
            {course.instructor_name}
            {course.instructor_title ? ` · ${course.instructor_title}` : ""}
          </p>
        )}

        <div
          className="flex items-center gap-2 mt-1 font-poppins"
          style={{ fontSize: "12px", color: "rgba(var(--fg-rgb),0.4)" }}
        >
          <span>{formatLessonCount(course.lesson_count)}</span>
          <span style={{ opacity: 0.4 }}>•</span>
          <span>{formatRuntime(course.total_duration_seconds)}</span>
          {done && (
            <>
              <span style={{ opacity: 0.4 }}>•</span>
              <span style={{ color: "var(--accent-2)" }}>Completed</span>
            </>
          )}
          {inProgress && (
            <>
              <span style={{ opacity: 0.4 }}>•</span>
              <span style={{ color: "var(--accent)" }}>
                {course.progress_percent}%
              </span>
            </>
          )}
        </div>
      </div>
    </Link>
  );
}
