"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { type WinCardData, storagePathFromUrl } from "@/components/stations/WinCard";
import EditWinModal from "@/components/stations/EditWinModal";
import type { ReactionType, ReactionCounts } from "@/types";
import { REACTIONS, getCounts } from "@/lib/utils/reactions";
import { formatDistanceToNow } from "date-fns";

interface WinDetailProps {
  win: WinCardData;
  currentUserId: string;
  initialUserReactions: ReactionType[];
}

export default function WinDetail({ win: winProp, currentUserId, initialUserReactions }: WinDetailProps) {
  const router = useRouter();
  const [win, setWin] = useState<WinCardData>(winProp);
  const [counts, setCounts] = useState<ReactionCounts>(getCounts(winProp.reaction_counts));
  const [myReactions, setMyReactions] = useState<Set<ReactionType>>(new Set(initialUserReactions));
  const [busy, setBusy] = useState<Set<ReactionType>>(new Set());

  const [menuOpen, setMenuOpen] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [editing, setEditing] = useState(false);
  const [actionError, setActionError] = useState("");
  const menuRef = useRef<HTMLDivElement>(null);

  const isOwner = win.user_id === currentUserId;
  const username = win.users?.username ?? "member";
  const timeAgo = formatDistanceToNow(new Date(win.created_at), { addSuffix: true });
  const images: string[] = win.image_urls?.length ? win.image_urls.slice(0, 2) : [];

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

  async function handleDelete() {
    setDeleting(true);
    setActionError("");
    const supabase = createClient();

    const { error } = await supabase
      .from("wins")
      .delete()
      .eq("id", win.id)
      .eq("user_id", currentUserId);

    if (error) {
      setDeleting(false);
      setActionError("Could not delete. Try again.");
      console.error("Delete failed:", error.message);
      return;
    }

    if (win.image_urls && win.image_urls.length > 0) {
      const paths = win.image_urls.map(storagePathFromUrl).filter((p): p is string => !!p);
      if (paths.length) await supabase.storage.from("win-images").remove(paths);
    }

    router.push("/wins");
  }

  // Realtime: refresh counts when another user reacts
  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel(`win-detail-${win.id}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "wins", filter: `id=eq.${win.id}` },
        (payload) => {
          const updated = payload.new as { reaction_counts: ReactionCounts | null };
          setCounts(getCounts(updated.reaction_counts));
        }
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [win.id]);

  async function toggleReaction(type: ReactionType, e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (busy.has(type)) return;

    const reacted = myReactions.has(type);
    setBusy((b) => new Set(b).add(type));

    // Optimistic
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
    const { error } = await supabase.rpc("toggle_reaction", {
      p_win_id: win.id,
      p_user_id: currentUserId,
      p_reaction_type: type,
    });

    if (error) {
      // Revert
      setMyReactions((prev) => {
        const next = new Set(prev);
        reacted ? next.add(type) : next.delete(type);
        return next;
      });
      setCounts((prev) => ({
        ...prev,
        [type]: Math.max(0, prev[type] + (reacted ? 1 : -1)),
      }));
      console.error("Reaction failed:", error.message);
    }

    setBusy((b) => { const s = new Set(b); s.delete(type); return s; });
  }

  return (
    <article className="flex flex-col relative" style={{ gap: 0 }}>
      {/* Owner menu */}
      {isOwner && (
        <div ref={menuRef} style={{ position: "absolute", top: 0, right: 0, zIndex: 10 }}>
          <button
            onClick={() => { setMenuOpen((v) => !v); setConfirmingDelete(false); }}
            aria-label="Win options"
            className="font-poppins transition-colors hover:text-[rgb(var(--fg-rgb))]"
            style={{ background: "none", border: "none", cursor: "pointer", color: "rgba(var(--fg-rgb),0.4)", fontSize: "18px", lineHeight: 1, padding: "2px 4px" }}
          >
            ···
          </button>
          {menuOpen && (
            <div style={{
              position: "absolute", top: "28px", right: 0, minWidth: "190px",
              background: "var(--bg-surface)", border: "0.5px solid rgba(var(--fg-rgb),0.1)",
              borderRadius: 0, zIndex: 20, display: "flex", flexDirection: "column",
            }}>
              {!confirmingDelete ? (
                <>
                  <button
                    onClick={() => { setMenuOpen(false); setEditing(true); }}
                    className="font-poppins font-light transition-colors hover:text-[rgb(var(--fg-rgb))] text-left"
                    style={{ background: "none", border: "none", cursor: "pointer", color: "rgba(var(--fg-rgb),0.6)", fontSize: "12px", padding: "12px 16px" }}
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => setConfirmingDelete(true)}
                    className="font-poppins font-light text-left"
                    style={{ background: "none", border: "none", cursor: "pointer", color: "var(--accent)", fontSize: "12px", padding: "12px 16px", borderTop: "0.5px solid rgba(var(--fg-rgb),0.08)" }}
                  >
                    Delete
                  </button>
                </>
              ) : (
                <div style={{ padding: "14px 16px", display: "flex", flexDirection: "column", gap: "12px" }}>
                  <p className="font-poppins font-light" style={{ fontSize: "11px", color: "rgba(var(--fg-rgb),0.6)", lineHeight: 1.5 }}>
                    Are you sure? This cannot be undone.
                  </p>
                  <div style={{ display: "flex", gap: "8px" }}>
                    <button onClick={handleDelete} disabled={deleting} className="font-poppins"
                      style={{ background: "var(--accent)", color: "rgb(var(--fg-rgb))", border: "none", cursor: deleting ? "default" : "pointer", fontSize: "10px", letterSpacing: "0.12em", textTransform: "uppercase", padding: "8px 12px", borderRadius: 0, opacity: deleting ? 0.6 : 1 }}>
                      {deleting ? "…" : "Delete"}
                    </button>
                    <button onClick={() => setConfirmingDelete(false)} className="font-poppins font-light"
                      style={{ background: "none", border: "0.5px solid rgba(var(--fg-rgb),0.15)", color: "rgba(var(--fg-rgb),0.5)", cursor: "pointer", fontSize: "10px", letterSpacing: "0.12em", textTransform: "uppercase", padding: "8px 12px", borderRadius: 0 }}>
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Back */}
      <Link
        href="/wins"
        className="font-poppins font-light text-[rgba(var(--fg-rgb),0.3)] hover:text-[rgba(var(--fg-rgb),0.6)] transition-colors"
        style={{ fontSize: "11px", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: "32px", display: "inline-block" }}
      >
        ← Wins
      </Link>

      {/* Meta */}
      <div className="flex items-center flex-wrap" style={{ gap: "10px", marginBottom: "16px" }}>
        <span className="font-poppins text-[rgb(var(--fg-rgb))]" style={{ fontSize: "12px", fontWeight: 500 }}>{username}</span>
        <span
          className="font-poppins uppercase"
          style={{ fontSize: "9px", letterSpacing: "0.15em", color: "rgba(var(--fg-rgb),0.4)" }}
        >
          {win.category}
        </span>
        <span className="font-poppins font-light text-[rgba(var(--fg-rgb),0.25)]" style={{ fontSize: "11px" }}>{timeAgo}</span>
      </div>

      {/* Title */}
      <h1 className="font-poppins font-black text-[rgb(var(--fg-rgb))] leading-tight" style={{ fontSize: "36px", marginBottom: "20px" }}>
        {win.title}
      </h1>

      {/* Description */}
      <p className="font-poppins font-light text-[rgba(var(--fg-rgb),0.7)]" style={{ fontSize: "16px", lineHeight: 1.8 }}>
        {win.description}
      </p>

      {/* Images */}
      {images.length === 1 && (
        <div style={{ marginTop: "28px" }}>
          <img
            src={images[0]}
            alt={win.title}
            onClick={() => window.open(images[0], "_blank")}
            className="w-full object-cover"
            style={{ maxHeight: "500px", cursor: "pointer" }}
          />
        </div>
      )}
      {images.length === 2 && (
        <div className="flex" style={{ marginTop: "28px", gap: "8px" }}>
          {images.map((url, i) => (
            <img
              key={i}
              src={url}
              alt={win.title}
              onClick={() => window.open(url, "_blank")}
              className="object-cover"
              style={{ flex: 1, maxHeight: "360px", minWidth: 0, cursor: "pointer" }}
            />
          ))}
        </div>
      )}

      {/* Link */}
      {win.media_url && (
        <div className="flex flex-col" style={{ marginTop: "28px", gap: "8px" }}>
          <p
            className="font-poppins font-light uppercase"
            style={{ fontSize: "10px", letterSpacing: "0.18em", color: "rgba(var(--fg-rgb),0.3)" }}
          >
            Link
          </p>
          <a
            href={win.media_url}
            target="_blank"
            rel="noopener noreferrer"
            className="font-poppins font-light hover:underline"
            style={{ fontSize: "13px", color: "var(--accent)", wordBreak: "break-all" }}
          >
            {win.media_url}
          </a>
        </div>
      )}

      {/* Reactions */}
      <div className="flex items-center flex-wrap" style={{ marginTop: "32px", gap: "8px" }}>
        {REACTIONS.map(({ type, emoji, label }) => {
          const active = myReactions.has(type);
          const count = counts[type];
          return (
            <button
              key={type}
              onClick={(e) => toggleReaction(type, e)}
              className="font-poppins flex items-center transition-colors"
              style={{
                gap: "6px",
                padding: "8px 14px",
                background: active ? "rgb(var(--fg-rgb))" : "transparent",
                color: active ? "var(--bg-primary)" : "rgba(var(--fg-rgb),0.35)",
                border: active ? "none" : "0.5px solid rgba(var(--fg-rgb),0.12)",
                cursor: busy.has(type) ? "default" : "pointer",
                fontSize: "14px",
                borderRadius: 0,
              }}
              title={label}
            >
              <span style={{ fontSize: "14px" }}>{emoji}</span>
              {count > 0 && (
                <span style={{ fontSize: "12px", fontWeight: 500 }}>{count}</span>
              )}
            </button>
          );
        })}
      </div>

      {actionError && (
        <p className="font-poppins" style={{ color: "var(--accent)", fontSize: "12px", marginTop: "16px" }}>{actionError}</p>
      )}

      {/* Edit modal */}
      {editing && (
        <EditWinModal
          win={win}
          onClose={() => setEditing(false)}
          onUpdated={(updated) => {
            setWin((prev) => ({ ...prev, ...updated }));
            setEditing(false);
          }}
        />
      )}
    </article>
  );
}
