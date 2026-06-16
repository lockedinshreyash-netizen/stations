"use client";

import Link from "next/link";
import type { JourneyWithAuthor } from "@/types";
import { categoryLabel, stageLabel } from "@/lib/journeys/meta";
import { openUserProfile } from "@/lib/userProfile";
import FounderMark from "@/components/ui/FounderMark";

/**
 * A single Journey in the Archive feed. Personal, browsable — the title +
 * emoji lead, the "why" gives the human hook. Tapping opens the detail page;
 * tapping the author opens their profile card.
 */
export default function JourneyCard({ journey }: { journey: JourneyWithAuthor }) {
  const username = journey.users?.username ?? "member";

  return (
    <Link
      href={`/archive/journeys/${journey.id}`}
      className="st-card st-card-hover flex flex-col"
      style={{
        padding: "22px 24px",
        background: "var(--bg-surface)",
        border: "0.5px solid rgba(var(--fg-rgb),0.08)",
        textDecoration: "none",
      }}
    >
      {/* Top row: emoji + title + author */}
      <div className="flex items-start" style={{ gap: "14px" }}>
        <span
          aria-hidden
          className="flex items-center justify-center shrink-0"
          style={{
            width: "46px",
            height: "46px",
            borderRadius: "var(--radius-md)",
            background: "var(--bg-secondary)",
            border: "0.5px solid rgba(var(--fg-rgb),0.08)",
            fontSize: "24px",
            lineHeight: 1,
          }}
        >
          {journey.emoji}
        </span>

        <div className="flex flex-col" style={{ gap: "4px", minWidth: 0 }}>
          <h2
            className="font-poppins font-black text-[rgb(var(--fg-rgb))] leading-tight"
            style={{ fontSize: "20px" }}
          >
            {journey.title}
          </h2>
          <div className="flex items-center" style={{ gap: "8px" }}>
            <span
              className="font-poppins text-[rgba(var(--fg-rgb),0.5)] hover:text-[var(--accent)] transition-colors"
              style={{ fontSize: "14px", cursor: "pointer" }}
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                openUserProfile(journey.user_id);
              }}
            >
              @{username}
            </span>
            <FounderMark founderNumber={journey.users?.founder_number} />
            <span
              className="font-poppins uppercase"
              style={{
                fontSize: "12px",
                letterSpacing: "0.15em",
                color: "rgba(var(--fg-rgb),0.4)",
              }}
            >
              {categoryLabel(journey.category)}
            </span>
          </div>
        </div>

        {/* Stage pill */}
        <span
          className="st-pill font-poppins uppercase ml-auto shrink-0"
          style={{
            fontSize: "11px",
            letterSpacing: "0.12em",
            padding: "5px 10px",
            color: "var(--accent)",
            background: "rgba(var(--accent-rgb),0.08)",
            border: "0.5px solid rgba(var(--accent-rgb),0.2)",
            alignSelf: "flex-start",
          }}
        >
          {stageLabel(journey.stage)}
        </span>
      </div>

      {/* Why — the emotional hook */}
      {journey.why && (
        <p
          className="font-playfair italic text-[rgba(var(--fg-rgb),0.6)]"
          style={{
            fontSize: "17px",
            lineHeight: 1.55,
            marginTop: "14px",
            display: "-webkit-box",
            WebkitLineClamp: 2,
            WebkitBoxOrient: "vertical",
            overflow: "hidden",
          }}
        >
          {journey.why}
        </p>
      )}
    </Link>
  );
}
