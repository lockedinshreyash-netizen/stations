"use client";

import Link from "next/link";
import { Settings } from "lucide-react";
import type { ArchiveCourseWithMeta, User } from "@/types";
import CourseCard from "./CourseCard";

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <h2
      className="font-poppins font-bold uppercase"
      style={{
        fontSize: "13px",
        letterSpacing: "0.2em",
        color: "rgba(var(--fg-rgb),0.4)",
        marginBottom: "16px",
      }}
    >
      {children}
    </h2>
  );
}

function Grid({
  courses,
  locked,
}: {
  courses: ArchiveCourseWithMeta[];
  locked: boolean;
}) {
  return (
    <div
      className="grid gap-5"
      style={{ gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))" }}
    >
      {courses.map((c) => (
        <CourseCard key={c.id} course={c} locked={locked} />
      ))}
    </div>
  );
}

export default function ArchiveCatalog({
  user,
  courses,
}: {
  user: User;
  courses: ArchiveCourseWithMeta[];
}) {
  const isMember =
    user.membership_tier === "paid" || user.membership_tier === "founding";

  const continueWatching = isMember
    ? courses.filter((c) => c.progress_percent > 0 && c.progress_percent < 100)
    : [];

  return (
    <div className="px-5 md:px-10 py-10 flex flex-col" style={{ gap: "44px" }}>
      {/* Admin entry point */}
      {user.is_admin && (
        <div className="flex justify-end -mb-6">
          <Link
            href="/archive/admin"
            className="st-pill inline-flex items-center gap-2 font-poppins uppercase"
            style={{
              fontSize: "12px",
              letterSpacing: "0.12em",
              padding: "8px 14px",
              color: "rgba(var(--fg-rgb),0.6)",
              border: "0.5px solid rgba(var(--fg-rgb),0.18)",
              background: "var(--bg-surface)",
            }}
          >
            <Settings size={14} strokeWidth={1.75} />
            Manage courses
          </Link>
        </div>
      )}

      {!isMember && (
        <div
          className="st-card flex flex-col gap-2 px-6 py-5"
          style={{
            background: "rgba(var(--accent-rgb),0.06)",
            border: "0.5px solid rgba(var(--accent-rgb),0.25)",
          }}
        >
          <span
            className="font-poppins font-bold uppercase"
            style={{
              fontSize: "12px",
              letterSpacing: "0.16em",
              color: "var(--accent)",
            }}
          >
            Members only
          </span>
          <p
            className="font-playfair italic"
            style={{ fontSize: "17px", color: "rgba(var(--fg-rgb),0.7)" }}
          >
            Browse the library below. Watching is reserved for Stations+ and
            Founding members — open any course to learn more.
          </p>
        </div>
      )}

      {continueWatching.length > 0 && (
        <section>
          <SectionLabel>Continue watching</SectionLabel>
          <Grid courses={continueWatching} locked={false} />
        </section>
      )}

      <section>
        <SectionLabel>
          {continueWatching.length > 0 ? "All courses" : "The library"}
        </SectionLabel>
        {courses.length === 0 ? (
          <p
            className="font-playfair italic"
            style={{ fontSize: "18px", color: "rgba(var(--fg-rgb),0.25)" }}
          >
            No courses published yet. The first ones are on their way.
          </p>
        ) : (
          <Grid courses={courses} locked={!isMember} />
        )}
      </section>
    </div>
  );
}
