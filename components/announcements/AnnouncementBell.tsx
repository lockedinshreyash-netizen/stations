"use client";

import { useEffect, useState } from "react";
import { Bell, X } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { tap } from "@/lib/feedback";
import type { User } from "@/types";

interface Announcement {
  id: string;
  title: string;
  body: string;
  url: string | null;
  created_at: string;
}

function relTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  return `${d}d ago`;
}

/**
 * Global announcement bell — fixed top-right, shows a red dot when there's an
 * announcement newer than the member's seen-watermark. Opening the panel marks
 * everything seen. Admins additionally get a composer to publish (the API +
 * RLS enforce admin-only writes; non-admins only ever read).
 */
export default function AnnouncementBell({ user }: { user: User }) {
  const [items, setItems] = useState<Announcement[]>([]);
  const [seenAt, setSeenAt] = useState<string | null>(
    user.announcements_seen_at
  );
  const [open, setOpen] = useState(false);

  // Admin composer
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [url, setUrl] = useState("");
  const [push, setPush] = useState(true);
  const [posting, setPosting] = useState(false);
  const [postError, setPostError] = useState<string | null>(null);

  useEffect(() => {
    const supabase = createClient();
    void supabase
      .from("announcements")
      .select("id, title, body, url, created_at")
      .order("created_at", { ascending: false })
      .limit(20)
      .then(({ data }) => {
        if (data) setItems(data as Announcement[]);
      });
  }, []);

  const latest = items[0]?.created_at;
  const unread = !!latest && (!seenAt || new Date(latest) > new Date(seenAt));

  function openPanel() {
    tap();
    setOpen(true);
    if (unread) {
      const now = new Date().toISOString();
      setSeenAt(now);
      const supabase = createClient();
      void supabase
        .from("users")
        .update({ announcements_seen_at: now })
        .eq("id", user.id);
    }
  }

  async function publish() {
    const t = title.trim();
    const b = body.trim();
    if (!t || !b || posting) return;
    setPosting(true);
    setPostError(null);
    try {
      const res = await fetch("/api/announcements", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: t, body: b, url: url.trim() || undefined, push }),
      });
      if (!res.ok) {
        const { error } = await res.json().catch(() => ({ error: "" }));
        setPostError(error || "Couldn't publish. Try again.");
        return;
      }
      const { id } = await res.json();
      const now = new Date().toISOString();
      setItems((prev) => [
        { id, title: t, body: b, url: url.trim() || null, created_at: now },
        ...prev,
      ]);
      setSeenAt(now); // our own post shouldn't read as unread to us
      setTitle("");
      setBody("");
      setUrl("");
    } catch {
      setPostError("Couldn't publish. Try again.");
    } finally {
      setPosting(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={openPanel}
        aria-label="Announcements"
        title="Announcements"
        className="st-liquid fixed z-50 flex items-center justify-center"
        style={{
          top: "calc(14px + env(safe-area-inset-top))",
          right: "14px",
          width: "42px",
          height: "42px",
          borderRadius: "9999px",
          color: "rgba(var(--fg-rgb),0.7)",
          border: "none",
          cursor: "pointer",
        }}
      >
        <Bell size={18} strokeWidth={1.75} aria-hidden />
        {unread && (
          <span
            role="status"
            aria-label="Unread announcements"
            style={{
              position: "absolute",
              top: "9px",
              right: "9px",
              width: "9px",
              height: "9px",
              borderRadius: "9999px",
              background: "var(--accent)",
              boxShadow: "0 0 0 2px var(--glass-bg)",
            }}
          />
        )}
      </button>

      {open && (
        <>
          {/* Click-away backdrop */}
          <div
            className="fixed inset-0 z-50"
            onClick={() => setOpen(false)}
            aria-hidden
          />
          <div
            role="dialog"
            aria-label="Announcements"
            className="st-card fixed z-50 flex flex-col bg-[var(--bg-surface)]"
            style={{
              top: "calc(64px + env(safe-area-inset-top))",
              right: "14px",
              width: "340px",
              maxWidth: "calc(100vw - 28px)",
              maxHeight: "70vh",
              overflow: "hidden",
            }}
          >
            <div className="flex items-center justify-between px-5 pt-4 pb-3 border-b border-[rgba(var(--fg-rgb),0.08)]">
              <span
                className="font-poppins font-light uppercase text-[rgba(var(--fg-rgb),0.4)]"
                style={{ fontSize: "13px", letterSpacing: "0.2em" }}
              >
                Announcements
              </span>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Close"
                className="text-[rgba(var(--fg-rgb),0.4)] hover:text-[rgb(var(--fg-rgb))]"
                style={{ background: "transparent", border: "none", cursor: "pointer" }}
              >
                <X size={18} />
              </button>
            </div>

            <div className="overflow-y-auto px-5 py-4 flex flex-col gap-4">
              {user.is_admin && (
                <div className="flex flex-col gap-2 pb-4 border-b border-[rgba(var(--fg-rgb),0.08)]">
                  <span
                    className="font-poppins uppercase text-[var(--accent)]"
                    style={{ fontSize: "11px", letterSpacing: "0.18em" }}
                  >
                    Post announcement
                  </span>
                  <input
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="Title"
                    maxLength={120}
                    className="st-field bg-[var(--bg-primary)] text-[rgb(var(--fg-rgb))] px-3 py-2 text-sm outline-none border border-[rgba(var(--fg-rgb),0.12)] focus:border-[var(--accent)] placeholder:text-[rgba(var(--fg-rgb),0.25)]"
                  />
                  <textarea
                    value={body}
                    onChange={(e) => setBody(e.target.value)}
                    placeholder="What's the news?"
                    rows={3}
                    maxLength={1000}
                    className="st-field bg-[var(--bg-primary)] text-[rgb(var(--fg-rgb))] px-3 py-2 text-sm outline-none border border-[rgba(var(--fg-rgb),0.12)] focus:border-[var(--accent)] placeholder:text-[rgba(var(--fg-rgb),0.25)] resize-none"
                  />
                  <input
                    value={url}
                    onChange={(e) => setUrl(e.target.value)}
                    placeholder="Link (optional, e.g. /compete)"
                    className="st-field bg-[var(--bg-primary)] text-[rgb(var(--fg-rgb))] px-3 py-2 text-sm outline-none border border-[rgba(var(--fg-rgb),0.12)] focus:border-[var(--accent)] placeholder:text-[rgba(var(--fg-rgb),0.25)]"
                  />
                  <label className="flex items-center gap-2 font-poppins text-[rgba(var(--fg-rgb),0.6)] cursor-pointer" style={{ fontSize: "13px" }}>
                    <input
                      type="checkbox"
                      checked={push}
                      onChange={(e) => setPush(e.target.checked)}
                    />
                    Also send as push
                  </label>
                  {postError && (
                    <span className="text-[var(--accent)]" style={{ fontSize: "13px" }}>
                      {postError}
                    </span>
                  )}
                  <button
                    type="button"
                    onClick={publish}
                    disabled={posting || !title.trim() || !body.trim()}
                    className="st-btn self-start font-poppins uppercase"
                    style={{
                      background: "var(--accent)",
                      color: "#fff",
                      fontSize: "12px",
                      fontWeight: 500,
                      letterSpacing: "0.12em",
                      padding: "8px 16px",
                      border: "none",
                      cursor: posting ? "default" : "pointer",
                      opacity: posting || !title.trim() || !body.trim() ? 0.5 : 1,
                    }}
                  >
                    {posting ? "Publishing…" : "Publish"}
                  </button>
                </div>
              )}

              {items.length === 0 ? (
                <p
                  className="font-playfair italic text-[rgba(var(--fg-rgb),0.4)] py-2"
                  style={{ fontSize: "15px" }}
                >
                  Nothing yet. Check back soon.
                </p>
              ) : (
                items.map((a) => {
                  const card = (
                    <>
                      <div className="flex items-baseline justify-between gap-3">
                        <span
                          className="font-poppins text-[rgb(var(--fg-rgb))]"
                          style={{ fontSize: "15px", fontWeight: 500 }}
                        >
                          {a.title}
                        </span>
                        <span
                          className="font-poppins shrink-0 text-[rgba(var(--fg-rgb),0.35)]"
                          style={{ fontSize: "12px" }}
                        >
                          {relTime(a.created_at)}
                        </span>
                      </div>
                      <p
                        className="font-poppins font-light text-[rgba(var(--fg-rgb),0.6)] mt-1"
                        style={{ fontSize: "14px", lineHeight: 1.5, whiteSpace: "pre-wrap" }}
                      >
                        {a.body}
                      </p>
                    </>
                  );
                  return a.url ? (
                    <a key={a.id} href={a.url} className="block">
                      {card}
                    </a>
                  ) : (
                    <div key={a.id}>{card}</div>
                  );
                })
              )}
            </div>
          </div>
        </>
      )}
    </>
  );
}
