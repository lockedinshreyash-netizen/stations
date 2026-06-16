"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import type { JourneyWithAuthor } from "@/types";
import { categoryLabel, stageLabel } from "@/lib/journeys/meta";
import { openUserProfile } from "@/lib/userProfile";
import FounderMark from "@/components/ui/FounderMark";
import JourneyModal from "@/components/stations/JourneyModal";
import { formatDistanceToNow } from "date-fns";

interface LinkedWin {
  id: string;
  title: string;
  category: string;
  created_at: string;
}

const sectionLabel: React.CSSProperties = {
  fontSize: "12px",
  letterSpacing: "0.18em",
  textTransform: "uppercase",
  color: "rgba(var(--fg-rgb),0.35)",
  fontWeight: 300,
};

export default function JourneyDetail({
  journey: initial,
  recentWins,
  currentUserId,
}: {
  journey: JourneyWithAuthor;
  recentWins: LinkedWin[];
  currentUserId: string;
}) {
  const router = useRouter();
  const [journey, setJourney] = useState<JourneyWithAuthor>(initial);
  const [editing, setEditing] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [actionError, setActionError] = useState("");

  const isOwner = journey.user_id === currentUserId;
  const username = journey.users?.username ?? "member";

  async function handleDelete() {
    setDeleting(true);
    setActionError("");
    const supabase = createClient();
    const { error } = await supabase
      .from("journeys")
      .delete()
      .eq("id", journey.id)
      .eq("user_id", currentUserId);
    if (error) {
      setDeleting(false);
      setActionError("Could not delete. Try again.");
      return;
    }
    router.push("/archive");
  }

  return (
    <div className="flex flex-col" style={{ gap: "32px" }}>
      <Link
        href="/archive"
        className="font-poppins uppercase self-start transition-colors hover:text-[rgb(var(--fg-rgb))]"
        style={{
          fontSize: "13px",
          letterSpacing: "0.15em",
          color: "rgba(var(--fg-rgb),0.4)",
          textDecoration: "none",
        }}
      >
        ← Archive
      </Link>

      {/* Header */}
      <div className="flex items-start" style={{ gap: "16px" }}>
        <span
          aria-hidden
          className="flex items-center justify-center shrink-0"
          style={{
            width: "60px",
            height: "60px",
            borderRadius: "var(--radius-md)",
            background: "var(--bg-surface)",
            border: "0.5px solid rgba(var(--fg-rgb),0.08)",
            fontSize: "32px",
            lineHeight: 1,
          }}
        >
          {journey.emoji}
        </span>
        <div className="flex flex-col" style={{ gap: "8px", minWidth: 0 }}>
          <h1
            className="font-poppins font-black text-[rgb(var(--fg-rgb))] leading-tight"
            style={{ fontSize: "30px" }}
          >
            {journey.title}
          </h1>
          <div className="flex items-center flex-wrap" style={{ gap: "8px" }}>
            <span
              className="font-poppins text-[rgba(var(--fg-rgb),0.5)] hover:text-[var(--accent)] transition-colors"
              style={{ fontSize: "15px", cursor: "pointer" }}
              onClick={() => openUserProfile(journey.user_id)}
            >
              @{username}
            </span>
            <FounderMark founderNumber={journey.users?.founder_number} />
            <span
              className="st-pill font-poppins uppercase"
              style={{
                fontSize: "11px",
                letterSpacing: "0.12em",
                padding: "4px 10px",
                color: "rgba(var(--fg-rgb),0.5)",
                border: "0.5px solid rgba(var(--fg-rgb),0.15)",
              }}
            >
              {categoryLabel(journey.category)}
            </span>
            <span
              className="st-pill font-poppins uppercase"
              style={{
                fontSize: "11px",
                letterSpacing: "0.12em",
                padding: "4px 10px",
                color: "var(--accent)",
                background: "rgba(var(--accent-rgb),0.08)",
                border: "0.5px solid rgba(var(--accent-rgb),0.2)",
              }}
            >
              {stageLabel(journey.stage)}
            </span>
          </div>
        </div>
      </div>

      {/* Why */}
      {journey.why && (
        <section className="flex flex-col" style={{ gap: "10px" }}>
          <span className="font-poppins" style={sectionLabel}>
            Why this matters to me
          </span>
          <p
            className="font-playfair italic text-[rgba(var(--fg-rgb),0.8)]"
            style={{ fontSize: "20px", lineHeight: 1.6 }}
          >
            {journey.why}
          </p>
        </section>
      )}

      {/* Challenge */}
      {journey.challenges && (
        <section className="flex flex-col" style={{ gap: "10px" }}>
          <span className="font-poppins" style={sectionLabel}>
            Current challenge
          </span>
          <p
            className="font-poppins font-light text-[rgba(var(--fg-rgb),0.65)]"
            style={{ fontSize: "17px", lineHeight: 1.7 }}
          >
            {journey.challenges}
          </p>
        </section>
      )}

      {/* Recent wins */}
      <section className="flex flex-col" style={{ gap: "12px" }}>
        <span className="font-poppins" style={sectionLabel}>
          Recent wins
        </span>
        {recentWins.length === 0 ? (
          <p
            className="font-playfair italic text-[rgba(var(--fg-rgb),0.25)]"
            style={{ fontSize: "16px" }}
          >
            {isOwner
              ? "No wins linked yet — post a Win and tag it to this journey."
              : "No wins linked yet."}
          </p>
        ) : (
          <div className="flex flex-col" style={{ gap: "8px" }}>
            {recentWins.map((w) => (
              <Link
                key={w.id}
                href={`/wins/${w.id}`}
                className="st-card st-card-hover flex items-center justify-between"
                style={{
                  padding: "14px 16px",
                  background: "var(--bg-surface)",
                  border: "0.5px solid rgba(var(--fg-rgb),0.08)",
                  textDecoration: "none",
                  gap: "12px",
                }}
              >
                <span
                  className="font-poppins font-light text-[rgb(var(--fg-rgb))]"
                  style={{ fontSize: "16px" }}
                >
                  {w.title}
                </span>
                <span
                  className="font-poppins font-light shrink-0"
                  style={{ fontSize: "13px", color: "rgba(var(--fg-rgb),0.3)" }}
                >
                  {formatDistanceToNow(new Date(w.created_at), {
                    addSuffix: true,
                  })}
                </span>
              </Link>
            ))}
          </div>
        )}
      </section>

      {/* Actions */}
      <div className="flex items-center flex-wrap" style={{ gap: "10px" }}>
        {isOwner ? (
          <>
            <button
              onClick={() => setEditing(true)}
              className="st-btn font-poppins uppercase"
              style={{
                fontSize: "13px",
                letterSpacing: "0.15em",
                padding: "12px 22px",
                background: "rgb(var(--fg-rgb))",
                color: "var(--bg-primary)",
                border: "none",
                cursor: "pointer",
              }}
            >
              Edit journey
            </button>
            {!confirmingDelete ? (
              <button
                onClick={() => setConfirmingDelete(true)}
                className="font-poppins uppercase"
                style={{
                  fontSize: "13px",
                  letterSpacing: "0.15em",
                  padding: "12px 22px",
                  background: "transparent",
                  color: "rgba(var(--fg-rgb),0.5)",
                  border: "0.5px solid rgba(var(--fg-rgb),0.18)",
                  cursor: "pointer",
                }}
              >
                Delete
              </button>
            ) : (
              <div className="flex items-center" style={{ gap: "8px" }}>
                <button
                  onClick={handleDelete}
                  disabled={deleting}
                  className="font-poppins uppercase"
                  style={{
                    fontSize: "13px",
                    letterSpacing: "0.15em",
                    padding: "12px 22px",
                    background: "var(--accent)",
                    color: "#fff",
                    border: "none",
                    cursor: deleting ? "default" : "pointer",
                    opacity: deleting ? 0.6 : 1,
                  }}
                >
                  {deleting ? "Deleting…" : "Confirm delete"}
                </button>
                <button
                  onClick={() => setConfirmingDelete(false)}
                  className="font-poppins uppercase"
                  style={{
                    fontSize: "13px",
                    letterSpacing: "0.15em",
                    padding: "12px 22px",
                    background: "transparent",
                    color: "rgba(var(--fg-rgb),0.5)",
                    border: "0.5px solid rgba(var(--fg-rgb),0.18)",
                    cursor: "pointer",
                  }}
                >
                  Cancel
                </button>
              </div>
            )}
          </>
        ) : (
          <button
            onClick={() => openUserProfile(journey.user_id)}
            className="st-btn font-poppins uppercase"
            style={{
              fontSize: "13px",
              letterSpacing: "0.15em",
              padding: "12px 22px",
              background: "rgb(var(--fg-rgb))",
              color: "var(--bg-primary)",
              border: "none",
              cursor: "pointer",
            }}
          >
            {journey.is_open_to_connect ? "Connect" : "View profile"}
          </button>
        )}
      </div>

      {actionError && (
        <p className="text-[var(--accent)]" style={{ fontSize: "15px" }}>
          {actionError}
        </p>
      )}

      {editing && (
        <JourneyModal
          mode="edit"
          journey={journey}
          onClose={() => setEditing(false)}
          onSaved={(updated) => {
            setJourney(updated);
            setEditing(false);
            router.refresh();
          }}
        />
      )}
    </div>
  );
}
