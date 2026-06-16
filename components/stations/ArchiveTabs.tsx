"use client";

import { useState } from "react";
import ArchiveCatalog from "@/components/stations/ArchiveCatalog";
import JourneysFeed from "@/components/stations/JourneysFeed";
import type { ArchiveCourseWithMeta, User } from "@/types";

type Tab = "journeys" | "courses";

/**
 * Archive (03) has two faces: Journeys (people building in public — the
 * default) and Courses (the existing Mux catalog, unchanged). A lightweight
 * segmented control swaps between them; the courses data is still fetched and
 * rendered exactly as before, so nothing about the catalog changes.
 */
export default function ArchiveTabs({
  user,
  courses,
}: {
  user: User;
  courses: ArchiveCourseWithMeta[];
}) {
  const [tab, setTab] = useState<Tab>("journeys");

  const tabs: { value: Tab; label: string }[] = [
    { value: "journeys", label: "Journeys" },
    { value: "courses", label: "Courses" },
  ];

  return (
    <div>
      {/* Segmented control */}
      <div className="px-5 md:px-10 pt-6">
        <div
          className="inline-flex"
          style={{
            gap: "4px",
            padding: "4px",
            borderRadius: "999px",
            background: "var(--bg-surface)",
            border: "0.5px solid rgba(var(--fg-rgb),0.1)",
          }}
        >
          {tabs.map((t) => {
            const active = tab === t.value;
            return (
              <button
                key={t.value}
                onClick={() => setTab(t.value)}
                aria-pressed={active}
                className="font-poppins uppercase"
                style={{
                  fontSize: "13px",
                  letterSpacing: "0.12em",
                  fontWeight: 500,
                  padding: "8px 20px",
                  borderRadius: "999px",
                  border: "none",
                  cursor: "pointer",
                  background: active ? "rgb(var(--fg-rgb))" : "transparent",
                  color: active ? "var(--bg-primary)" : "rgba(var(--fg-rgb),0.5)",
                  transition: "background 150ms, color 150ms",
                }}
              >
                {t.label}
              </button>
            );
          })}
        </div>
      </div>

      {tab === "journeys" ? (
        <JourneysFeed />
      ) : (
        <ArchiveCatalog user={user} courses={courses} />
      )}
    </div>
  );
}
