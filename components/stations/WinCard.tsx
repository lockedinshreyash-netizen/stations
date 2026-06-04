"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import type { WinCategory, ReactionCounts, ReactionType } from "@/types";
import { REACTIONS, getCounts } from "@/lib/utils/reactions";
import { formatDistanceToNow } from "date-fns";
import EditWinModal, { type EditableWin } from "@/components/stations/EditWinModal";

export interface WinCardData {
  id: string;
  user_id: string;
  title: string;
  description: string;
  category: WinCategory;
  media_url: string | null;
  image_urls?: string[] | null;
  win_type?: string | null;
  reactions_count: number;
  reaction_counts: ReactionCounts | null;
  created_at: string;
  users: { username: string; avatar_url: string | null } | null;
}

interface WinCardProps {
  win: WinCardData;
  currentUserId: string;
  userReactions: Set<ReactionType>;
  onDeleted?: (id: string) => void;
  onUpdated?: (updated: WinCardData) => void;
}

const CATEGORY_COLORS: Record<WinCategory, string> = {
  startup:  "var(--accent)",
  project:  "rgba(var(--fg-rgb),0.45)",
  fitness:  "rgba(var(--fg-rgb),0.45)",
  exam:     "rgba(var(--fg-rgb),0.45)",
  personal: "rgba(var(--fg-rgb),0.45)",
  other:    "rgba(var(--fg-rgb),0.45)",
};

// Exported so WinDetail can reuse it
export function storagePathFromUrl(url: string): string | null {
  const marker = "/win-images/";
  const i = url.indexOf(marker);
  return i >= 0 ? url.slice(i + marker.length) : null;
}

export default function WinCard({ win: winProp, currentUserId, userReactions, onDeleted, onUpdated }: WinCardProps) {
  const [win, setWin] = useState<WinCardData>(winProp);
  const [counts, setCounts] = useState<ReactionCounts>(getCounts(winProp.reaction_counts));
  const [myReactions, setMyReactions] = useState<Set<ReactionType>>(new Set(userReactions));
  const [busy, setBusy] = useState<Set<ReactionType>>(new Set());

  const [menuOpen, setMenuOpen] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleted, setDeleted] = useState(false);
  const [editing, setEditing] = useState(false);
  const [actionError, setActionError] = useState("");
  const menuRef = useRef<HTMLDivElement>(null);

  const isOwner = win.user_id === currentUserId;
  const username = win.users?.username ?? "member";
  const timeAgo = formatDistanceToNow(new Date(win.created_at), { addSuffix: true });

  // Close menu on outside click
  useEffect(() => {
    if (!menuOpen) return;
    function handler(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
        setConfirmingDelete(false);
      }
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [menuOpen]);

  async function toggleReaction(type: ReactionType, e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (busy.has(type)) return;

    const reacted = myReactions.has(type);
    setBusy((b) => new Set(b).add(type));
    setMyReactions((prev) => {
      const next = new Set(prev);
      reacted ? next.delete(type) : next.add(type);
      return next;
    });
    setCounts((prev) => ({
      ...prev,
      [type]: Math.max(0, prev[type] + (reacted ? -1 : 1)),
    }));

    const supabase = createClient();
    const { data, error } = await supabase.rpc("toggle_reaction", {
      p_win_id: win.id,
      p_user_id: currentUserId,
      p_reaction_type: type,
    });

    if (error || !data) {
      setMyReactions((prev) => {
        const next = new Set(prev);
        reacted ? next.add(type) : next.delete(type);
        return next;
      });
      setCounts((prev) => ({
        ...prev,
        [type]: Math.max(0, prev[type] + (reacted ? 1 : -1)),
      }));
      console.error("Reaction toggle failed:", error?.message);
    }

    setBusy((b) => { const s = new Set(b); s.delete(type); return s; });
  }

  async function handleDelete(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    setDeleting(true);
    setActionError("");

    // Optimistic — hide immediately
    setDeleted(true);

    const supabase = createClient();
    const { error } = await supabase
      .from("wins")
      .delete()
      .eq("id", win.id)
      .eq("user_id", currentUserId);

    if (error) {
      setDeleted(false);
      setDeleting(false);
      setActionError("Could not delete. Try again.");
      return;
    }

    // Remove images from storage (best-effort)
    if (win.image_urls && win.image_urls.length > 0) {
      const paths = win.image_urls.map(storagePathFromUrl).filter((p): p is string => !!p);
      if (paths.length) await supabase.storage.from("win-images").remove(paths);
    }

    onDeleted?.(win.id);
  }

  // Removed from DOM after successful delete
  if (deleted && !actionError) return null;

  const editableWin: EditableWin = {
    id: win.id,
    user_id: win.user_id,
    title: win.title,
    description: win.description,
    category: win.category,
    media_url: win.media_url,
    image_urls: win.image_urls,
    win_type: win.win_type,
  };

  return (
    <article
      className="st-card st-card-hover flex flex-col relative"
      style={{
        padding: "22px 24px",
        background: "var(--bg-surface)",
        border: "0.5px solid rgba(var(--fg-rgb),0.08)",
      }}
    >
      {/* Owner ··· menu */}
      {isOwner && (
        <div ref={menuRef} style={{ position: "absolute", top: "18px", right: "18px", zIndex: 10 }}>
          <button
            onClick={(e) => { e.preventDefault(); e.stopPropagation(); setMenuOpen((v) => !v); setConfirmingDelete(false); }}
            aria-label="Win options"
            style={{ background: "none", border: "none", cursor: "pointer", color: "rgba(var(--fg-rgb),0.4)", fontSize: "16px", lineHeight: 1, padding: "2px 4px", letterSpacing: "0.1em" }}
          >
            ···
          </button>

          {menuOpen && (
            <div style={{ position: "absolute", top: "26px", right: 0, minWidth: "180px", background: "var(--bg-surface)", border: "0.5px solid rgba(var(--fg-rgb),0.1)", borderRadius: "var(--radius-md)", boxShadow: "var(--shadow-lg)", overflow: "hidden", zIndex: 20, display: "flex", flexDirection: "column" }}>
              {!confirmingDelete ? (
                <>
                  <button
                    onClick={(e) => { e.preventDefault(); e.stopPropagation(); setMenuOpen(false); setEditing(true); }}
                    style={{ background: "none", border: "none", cursor: "pointer", color: "rgba(var(--fg-rgb),0.6)", fontSize: "12px", padding: "12px 16px", textAlign: "left", fontFamily: "inherit", fontWeight: 300 }}
                  >
                    Edit
                  </button>
                  <button
                    onClick={(e) => { e.preventDefault(); e.stopPropagation(); setConfirmingDelete(true); }}
                    style={{ background: "none", border: "none", cursor: "pointer", color: "var(--accent)", fontSize: "12px", padding: "12px 16px", textAlign: "left", fontFamily: "inherit", fontWeight: 300, borderTop: "0.5px solid rgba(var(--fg-rgb),0.08)" }}
                  >
                    Delete
                  </button>
                </>
              ) : (
                <div style={{ padding: "14px 16px", display: "flex", flexDirection: "column", gap: "12px" }}>
                  <p style={{ fontSize: "11px", color: "rgba(var(--fg-rgb),0.6)", lineHeight: 1.5, margin: 0, fontFamily: "inherit", fontWeight: 300 }}>
                    Are you sure? This cannot be undone.
                  </p>
                  <div style={{ display: "flex", gap: "8px" }}>
                    <button
                      onClick={handleDelete}
                      disabled={deleting}
                      className="st-btn"
                      style={{ background: "var(--accent)", color: "rgb(var(--fg-rgb))", border: "none", cursor: deleting ? "default" : "pointer", fontSize: "10px", letterSpacing: "0.12em", textTransform: "uppercase", padding: "8px 12px", opacity: deleting ? 0.6 : 1, fontFamily: "inherit" }}
                    >
                      {deleting ? "…" : "Delete"}
                    </button>
                    <button
                      onClick={(e) => { e.preventDefault(); e.stopPropagation(); setConfirmingDelete(false); }}
                      className="st-btn"
                      style={{ background: "none", border: "0.5px solid rgba(var(--fg-rgb),0.15)", color: "rgba(var(--fg-rgb),0.5)", cursor: "pointer", fontSize: "10px", letterSpacing: "0.12em", textTransform: "uppercase", padding: "8px 12px", fontFamily: "inherit" }}
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Card content — navigates to detail */}
      <Link href={`/wins/${win.id}`} className="flex flex-col" style={{ gap: 0, textDecoration: "none" }}>
        {/* Top row */}
        <div className="flex items-center" style={{ gap: "10px", marginBottom: "8px", paddingRight: isOwner ? "28px" : 0 }}>
          <span className="font-poppins text-[rgb(var(--fg-rgb))]" style={{ fontSize: "12px", fontWeight: 500 }}>
            {username}
          </span>
          <span className="font-poppins uppercase" style={{ fontSize: "9px", letterSpacing: "0.15em", color: CATEGORY_COLORS[win.category] }}>
            {win.category}
          </span>
          <span className="font-poppins font-light text-[rgba(var(--fg-rgb),0.25)] ml-auto" style={{ fontSize: "11px" }}>
            {timeAgo}
          </span>
        </div>

        <h2 className="font-poppins font-black text-[rgb(var(--fg-rgb))] leading-tight" style={{ fontSize: "20px", marginBottom: "6px" }}>
          {win.title}
        </h2>

        <p className="font-poppins font-light text-[rgba(var(--fg-rgb),0.6)]" style={{ fontSize: "14px", lineHeight: 1.7 }}>
          {win.description}
        </p>

        {win.image_urls && win.image_urls.length > 0 && (
          <div style={{ marginTop: "14px", maxHeight: "240px", overflow: "hidden", borderRadius: "var(--radius-md)", boxShadow: "var(--shadow-sm)" }}>
            <img src={win.image_urls[0]} alt={win.title} className="w-full object-cover" style={{ maxHeight: "240px" }} />
          </div>
        )}

        {win.media_url && (
          <div className="flex items-center font-poppins font-light text-[rgba(var(--fg-rgb),0.35)]" style={{ marginTop: "12px", gap: "6px", fontSize: "11px" }}>
            <span style={{ fontSize: "12px" }}>🔗</span>
            <span>Link attached</span>
          </div>
        )}
      </Link>

      {actionError && (
        <p className="font-poppins" style={{ color: "var(--accent)", fontSize: "11px", marginTop: "8px" }}>{actionError}</p>
      )}

      {/* Reactions — outside Link */}
      <style>{`
        .reaction-btn { padding: 6px 10px; }
        @media (max-width: 767px) { .reaction-btn { padding: 4px 8px; } }
      `}</style>
      <div className="flex items-center" style={{ marginTop: "16px", gap: "8px", flexWrap: "wrap" }}>
        {REACTIONS.map(({ type, emoji, label }) => {
          const active = myReactions.has(type);
          const count = counts[type];
          return (
            <button
              key={type}
              onClick={(e) => toggleReaction(type, e)}
              className="reaction-btn st-pill font-poppins flex items-center"
              style={{
                gap: "5px",
                background: active ? "rgb(var(--fg-rgb))" : "transparent",
                color: active ? "var(--bg-primary)" : "rgba(var(--fg-rgb),0.35)",
                border: active ? "none" : "0.5px solid rgba(var(--fg-rgb),0.12)",
                cursor: busy.has(type) ? "default" : "pointer",
                fontSize: "13px",
                lineHeight: 1,
              }}
              title={label}
            >
              <span style={{ fontSize: "13px" }}>{emoji}</span>
              {count > 0 && <span style={{ fontSize: "11px", fontWeight: 500 }}>{count}</span>}
            </button>
          );
        })}
      </div>

      {/* Edit modal */}
      {editing && (
        <EditWinModal
          win={editableWin}
          onClose={() => setEditing(false)}
          onUpdated={(updated) => {
            const merged = { ...win, ...updated };
            setWin(merged);
            onUpdated?.(merged);
            setEditing(false);
          }}
        />
      )}
    </article>
  );
}
