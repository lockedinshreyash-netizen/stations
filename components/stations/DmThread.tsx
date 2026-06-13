"use client";

import { useState, useEffect, useRef, useCallback, type ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { format, isSameDay } from "date-fns";
import DateSeparator from "@/components/stations/DateSeparator";
import { openUserProfile } from "@/lib/userProfile";
import { createClient } from "@/lib/supabase/client";
import {
  DM_PAGE_SIZE,
  getMessages,
  sendDirectMessage,
  editDirectMessage,
  deleteDirectMessage,
  markConversationRead,
  respondToDmRequest,
} from "@/lib/dm/messages";
import { notifyNewDm, notifyDmRequestAccepted } from "@/lib/push/client";
import FounderMark from "@/components/ui/FounderMark";
import type {
  ConversationStatus,
  DirectMessage,
  DmParticipant,
  User,
} from "@/types";

const MAX_LEN = 2000;

export default function DmThread({
  user,
  conversationId,
  peer,
  initialMessages,
  initialStatus,
  viewerIsRequester,
}: {
  user: User;
  conversationId: string;
  peer: DmParticipant;
  initialMessages: DirectMessage[];
  initialStatus: ConversationStatus;
  // True when the caller is the one who sent the (still pending) request.
  viewerIsRequester: boolean;
}) {
  const router = useRouter();
  const [messages, setMessages] = useState<DirectMessage[]>(initialMessages);
  // Lifecycle of this conversation; flips to "accepted" once the request is
  // accepted (locally on accept, or live via the conversations channel below).
  const [status, setStatus] = useState<ConversationStatus>(initialStatus);
  const [responding, setResponding] = useState(false);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [menuFor, setMenuFor] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState("");
  // Older history paging: a full first page means there may be more.
  const [hasEarlier, setHasEarlier] = useState(initialMessages.length >= DM_PAGE_SIZE);
  const [loadingEarlier, setLoadingEarlier] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const skipAutoScrollRef = useRef(false);

  const scrollToBottom = useCallback(() => {
    bottomRef.current?.scrollIntoView({ block: "end" });
  }, []);

  // Merge a message by id — inserts new, or replaces an existing one in place
  // (so realtime edits and optimistic echoes both reconcile cleanly).
  const upsert = useCallback((m: DirectMessage) => {
    setMessages((prev) => {
      if (prev.some((x) => x.id === m.id)) {
        return prev.map((x) => (x.id === m.id ? m : x));
      }
      return [...prev, m].sort(
        (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
      );
    });
  }, []);

  const removeById = useCallback((id: string) => {
    setMessages((prev) => prev.filter((x) => x.id !== id));
  }, []);

  // Live messages for THIS conversation only. RLS ensures only the two
  // participants ever receive these events.
  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel(`dm_${conversationId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "direct_messages",
          filter: `conversation_id=eq.${conversationId}`,
        },
        (payload) => {
          const m = payload.new as DirectMessage;
          upsert(m);
          if (m.sender_id !== user.id) markConversationRead(conversationId, user.id);
        }
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "direct_messages",
          filter: `conversation_id=eq.${conversationId}`,
        },
        (payload) => upsert(payload.new as DirectMessage)
      )
      .on(
        "postgres_changes",
        {
          event: "DELETE",
          schema: "public",
          table: "direct_messages",
          filter: `conversation_id=eq.${conversationId}`,
        },
        (payload) => {
          const old = payload.old as Partial<DirectMessage>;
          if (old.id) removeById(old.id);
        }
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "conversations",
          filter: `id=eq.${conversationId}`,
        },
        (payload) => {
          const next = (payload.new as { status?: ConversationStatus }).status;
          if (next) setStatus(next);
        }
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [conversationId, user.id, upsert, removeById]);

  // Mark read on open and whenever messages change.
  useEffect(() => {
    markConversationRead(conversationId, user.id);
  }, [conversationId, user.id, messages.length]);

  useEffect(() => {
    if (skipAutoScrollRef.current) {
      skipAutoScrollRef.current = false;
      return;
    }
    scrollToBottom();
  }, [messages.length, scrollToBottom]);

  async function loadEarlier() {
    if (loadingEarlier || messages.length === 0) return;
    setLoadingEarlier(true);
    try {
      const older = await getMessages(conversationId, messages[0].created_at);
      setHasEarlier(older.length >= DM_PAGE_SIZE);
      if (older.length > 0) {
        skipAutoScrollRef.current = true; // keep the viewport where it is
        setMessages((prev) => [...older.filter((o) => !prev.some((p) => p.id === o.id)), ...prev]);
      }
    } catch {
      setError("Couldn't load earlier messages.");
    } finally {
      setLoadingEarlier(false);
    }
  }

  async function acceptRequest() {
    if (responding) return;
    setResponding(true);
    try {
      await respondToDmRequest(conversationId, true);
      notifyDmRequestAccepted(peer.id, conversationId);
      setStatus("accepted");
    } catch {
      setError("Couldn't accept. Try again.");
    } finally {
      setResponding(false);
    }
  }

  async function declineRequest() {
    if (responding) return;
    setResponding(true);
    try {
      await respondToDmRequest(conversationId, false);
      router.push("/messages");
    } catch {
      setError("Couldn't decline. Try again.");
      setResponding(false);
    }
  }

  async function handleSend(e: React.FormEvent) {
    e.preventDefault();
    const content = draft.trim();
    // Messages can only be sent once the request is accepted (DB enforces this
    // too); guard here so the composer never fires while pending/declined.
    if (!content || sending || status !== "accepted") return;
    setSending(true);
    setError(null);
    try {
      const saved = await sendDirectMessage(conversationId, user.id, content);
      upsert(saved);
      notifyNewDm(conversationId);
      setDraft("");
    } catch {
      setError("Couldn't send. Try again.");
    } finally {
      setSending(false);
    }
  }

  function startEdit(m: DirectMessage) {
    setMenuFor(null);
    setEditingId(m.id);
    setEditDraft(m.content);
  }

  function cancelEdit() {
    setEditingId(null);
    setEditDraft("");
  }

  async function saveEdit(m: DirectMessage) {
    const content = editDraft.trim();
    if (!content) return;
    if (content === m.content) {
      cancelEdit();
      return;
    }
    // Optimistic; realtime UPDATE will reconcile.
    upsert({ ...m, content, edited_at: new Date().toISOString() });
    cancelEdit();
    try {
      await editDirectMessage(m.id, user.id, content);
    } catch {
      setError("Couldn't edit. Try again.");
    }
  }

  async function handleDelete(m: DirectMessage) {
    setMenuFor(null);
    const prev = messages;
    removeById(m.id); // optimistic
    try {
      await deleteDirectMessage(m.id, user.id);
    } catch {
      setMessages(prev); // restore on failure
      setError("Couldn't delete. Try again.");
    }
  }

  // Re-fetch the latest page once on mount in case the server snapshot is stale.
  useEffect(() => {
    getMessages(conversationId)
      .then((latest) => {
        setMessages(latest);
        setHasEarlier(latest.length >= DM_PAGE_SIZE);
      })
      .catch(() => {});
  }, [conversationId]);

  return (
    <div className="flex flex-col" style={{ height: "100dvh" }}>
      {/* Header */}
      <div
        className="st-glass shrink-0 px-5 py-4 sticky top-0 z-10 flex items-center gap-3"
        style={{ borderBottom: "0.5px solid var(--glass-border)" }}
      >
        <Link
          href="/messages"
          className="font-poppins font-medium uppercase text-[rgba(var(--fg-rgb),0.4)] hover:text-[rgb(var(--fg-rgb))] transition-colors"
          style={{ fontSize: "14px", letterSpacing: "0.15em" }}
        >
          ←
        </Link>
        <button
          type="button"
          onClick={() => openUserProfile(peer.id)}
          className="flex items-center gap-3"
          style={{ background: "none", border: "none", padding: 0, cursor: "pointer" }}
          aria-label={`View ${peer.username}'s profile`}
        >
          <Avatar url={peer.avatar_url} username={peer.username} />
          <span className="font-poppins font-medium text-[rgb(var(--fg-rgb))] hover:text-[var(--accent)] transition-colors flex items-center gap-1.5" style={{ fontSize: "17px" }}>
            {peer.username}
            <FounderMark founderNumber={peer.founder_number} />
          </span>
        </button>
      </div>

      {/* Messages */}
      <div className="flex-1 min-h-0 overflow-y-auto px-5 py-5 flex flex-col gap-2.5 max-w-2xl mx-auto w-full">
        {hasEarlier && messages.length > 0 && (
          <button
            type="button"
            onClick={loadEarlier}
            disabled={loadingEarlier}
            className="font-poppins uppercase self-center text-[rgba(var(--fg-rgb),0.4)] hover:text-[rgb(var(--fg-rgb))] transition-colors"
            style={{
              fontSize: "13px",
              letterSpacing: "0.12em",
              background: "none",
              border: "none",
              cursor: loadingEarlier ? "default" : "pointer",
              padding: "6px 12px",
            }}
          >
            {loadingEarlier ? "Loading…" : "Load earlier messages"}
          </button>
        )}
        {messages.length === 0 && status === "accepted" && (
          <p className="font-playfair italic text-[rgba(var(--fg-rgb),0.25)] text-center mt-8" style={{ fontSize: "17px" }}>
            This is the beginning of your conversation with {peer.username}.
          </p>
        )}
        {messages.flatMap((m, i) => {
          const mine = m.sender_id === user.id;

          // WhatsApp-style day divider before the first message of each day.
          const prev = messages[i - 1];
          const nodes: ReactNode[] = [];
          if (!prev || !isSameDay(new Date(prev.created_at), new Date(m.created_at))) {
            nodes.push(<DateSeparator key={`s-${m.id}`} date={m.created_at} />);
          }

          if (mine && editingId === m.id) {
            nodes.push(
              <div key={m.id} className="flex justify-end">
                <div className="flex flex-col gap-2" style={{ maxWidth: "78%", width: "100%" }}>
                  <textarea
                    value={editDraft}
                    onChange={(e) => setEditDraft(e.target.value.slice(0, MAX_LEN))}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault();
                        saveEdit(m);
                      } else if (e.key === "Escape") {
                        cancelEdit();
                      }
                    }}
                    autoFocus
                    rows={2}
                    className="st-field bg-[var(--bg-surface)] text-[rgb(var(--fg-rgb))] px-3 py-2 text-base outline-none border border-[var(--accent)] resize-none rounded-[var(--radius-sm)]"
                  />
                  <div className="flex items-center justify-end gap-2">
                    <button
                      type="button"
                      onClick={cancelEdit}
                      className="font-poppins uppercase text-[rgba(var(--fg-rgb),0.4)] hover:text-[rgb(var(--fg-rgb))]"
                      style={{ fontSize: "13px", letterSpacing: "0.1em" }}
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={() => saveEdit(m)}
                      disabled={!editDraft.trim()}
                      className="font-poppins font-black uppercase"
                      style={{
                        fontSize: "13px",
                        letterSpacing: "0.1em",
                        padding: "5px 12px",
                        background: "rgb(var(--fg-rgb))",
                        color: "var(--bg-primary)",
                        border: "none",
                        borderRadius: "var(--radius-sm)",
                        cursor: editDraft.trim() ? "pointer" : "default",
                        opacity: editDraft.trim() ? 1 : 0.4,
                      }}
                    >
                      Save
                    </button>
                  </div>
                </div>
              </div>
            );
            return nodes;
          }

          nodes.push(
            <div key={m.id} className={`group flex items-center gap-1.5 ${mine ? "justify-end" : "justify-start"}`}>
              {/* Own-message actions (left of the bubble) */}
              {mine && (
                <div className="relative shrink-0">
                  <button
                    type="button"
                    aria-label="Message options"
                    onClick={() => setMenuFor((v) => (v === m.id ? null : m.id))}
                    className="font-poppins opacity-0 group-hover:opacity-100 transition-opacity"
                    style={{
                      background: "none",
                      border: "none",
                      cursor: "pointer",
                      color: "rgba(var(--fg-rgb),0.35)",
                      fontSize: "18px",
                      lineHeight: 1,
                      padding: "2px 4px",
                      opacity: menuFor === m.id ? 1 : undefined,
                    }}
                  >
                    ···
                  </button>
                  {menuFor === m.id && (
                    <div
                      className="absolute z-20"
                      style={{
                        bottom: "calc(100% + 4px)",
                        right: 0,
                        minWidth: "120px",
                        background: "var(--bg-surface)",
                        border: "0.5px solid rgba(var(--fg-rgb),0.12)",
                        borderRadius: "var(--radius-md)",
                        boxShadow: "var(--shadow-lg)",
                        overflow: "hidden",
                        display: "flex",
                        flexDirection: "column",
                      }}
                    >
                      <button
                        type="button"
                        onClick={() => startEdit(m)}
                        className="font-poppins text-left hover:bg-[rgba(var(--fg-rgb),0.05)]"
                        style={{ background: "none", border: "none", cursor: "pointer", color: "rgba(var(--fg-rgb),0.7)", fontSize: "15px", padding: "10px 14px", fontWeight: 300 }}
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDelete(m)}
                        className="font-poppins text-left hover:bg-[rgba(var(--fg-rgb),0.05)]"
                        style={{ background: "none", border: "none", cursor: "pointer", color: "var(--accent)", fontSize: "15px", padding: "10px 14px", fontWeight: 300, borderTop: "0.5px solid rgba(var(--fg-rgb),0.06)" }}
                      >
                        Delete
                      </button>
                    </div>
                  )}
                </div>
              )}

              <div
                className="font-poppins"
                style={{
                  maxWidth: "78%",
                  padding: "9px 13px",
                  borderRadius: "16px",
                  fontSize: "16px",
                  lineHeight: 1.5,
                  whiteSpace: "pre-wrap",
                  wordBreak: "break-word",
                  background: mine ? "rgb(var(--fg-rgb))" : "var(--bg-surface)",
                  color: mine ? "var(--bg-primary)" : "rgba(var(--fg-rgb),0.9)",
                  border: mine ? "none" : "0.5px solid rgba(var(--fg-rgb),0.1)",
                }}
                title={format(new Date(m.created_at), "MMM d, h:mm a")}
              >
                {m.content}
                {m.edited_at && (
                  <span
                    style={{
                      fontSize: "12px",
                      marginLeft: "6px",
                      opacity: 0.6,
                      fontStyle: "italic",
                    }}
                  >
                    (edited)
                  </span>
                )}
              </div>
            </div>
          );
          return nodes;
        })}
        <div ref={bottomRef} />

        {/* Click-away layer to dismiss an open message menu */}
        {menuFor && (
          <div
            className="fixed inset-0 z-10"
            onClick={() => setMenuFor(null)}
            aria-hidden
          />
        )}
      </div>

      {/* Composer — only once the request is accepted */}
      {status === "accepted" ? (
        <form
          onSubmit={handleSend}
          className="shrink-0 px-5 py-4 flex items-end gap-2 max-w-2xl mx-auto w-full"
          style={{ borderTop: "0.5px solid rgba(var(--fg-rgb),0.08)", paddingBottom: "calc(16px + env(safe-area-inset-bottom))" }}
        >
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value.slice(0, MAX_LEN))}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleSend(e);
              }
            }}
            rows={1}
            placeholder={`Message ${peer.username}…`}
            className="flex-1 st-field bg-[var(--bg-surface)] text-[rgb(var(--fg-rgb))] px-4 py-2.5 text-base outline-none border border-[rgba(var(--fg-rgb),0.1)] focus:border-[var(--accent)] placeholder:text-[rgba(var(--fg-rgb),0.25)] resize-none rounded-[var(--radius-sm)]"
            style={{ maxHeight: "120px" }}
          />
          <button
            type="submit"
            disabled={!draft.trim() || sending}
            className="st-btn font-poppins font-black uppercase shrink-0"
            style={{
              fontSize: "14px",
              letterSpacing: "0.12em",
              padding: "11px 18px",
              background: "rgb(var(--fg-rgb))",
              color: "var(--bg-primary)",
              border: "none",
              borderRadius: "var(--radius-sm)",
              cursor: !draft.trim() || sending ? "default" : "pointer",
              opacity: !draft.trim() || sending ? 0.4 : 1,
            }}
          >
            {sending ? "…" : "Send"}
          </button>
        </form>
      ) : status === "pending" && !viewerIsRequester ? (
        // The recipient landed on a pending request — let them respond here.
        <div
          className="shrink-0 px-5 py-4 flex flex-col items-center gap-3 max-w-2xl mx-auto w-full"
          style={{ borderTop: "0.5px solid rgba(var(--fg-rgb),0.08)", paddingBottom: "calc(16px + env(safe-area-inset-bottom))" }}
        >
          <p className="font-poppins text-center text-[rgba(var(--fg-rgb),0.6)]" style={{ fontSize: "15px" }}>
            <span className="font-medium text-[rgb(var(--fg-rgb))]">{peer.username}</span> wants to message you.
          </p>
          <div className="flex items-center gap-3">
            <button
              type="button"
              disabled={responding}
              onClick={acceptRequest}
              className="st-btn font-poppins uppercase disabled:opacity-50"
              style={{ fontSize: "13px", letterSpacing: "0.12em", fontWeight: 600, padding: "10px 22px", background: "var(--accent)", color: "#fff", border: "none", borderRadius: "var(--radius-sm)" }}
            >
              Accept
            </button>
            <button
              type="button"
              disabled={responding}
              onClick={declineRequest}
              className="st-pill font-poppins uppercase disabled:opacity-50"
              style={{ fontSize: "13px", letterSpacing: "0.12em", padding: "10px 18px", color: "rgba(var(--fg-rgb),0.45)" }}
            >
              Decline
            </button>
          </div>
        </div>
      ) : (
        // Requester waiting on a pending request, or a declined request.
        <div
          className="shrink-0 px-5 py-5 max-w-2xl mx-auto w-full text-center"
          style={{ borderTop: "0.5px solid rgba(var(--fg-rgb),0.08)", paddingBottom: "calc(20px + env(safe-area-inset-bottom))" }}
        >
          <p className="font-playfair italic text-[rgba(var(--fg-rgb),0.45)]" style={{ fontSize: "16px" }}>
            {status === "declined"
              ? "This message request was declined."
              : `Request sent — you can message ${peer.username} once they accept.`}
          </p>
        </div>
      )}
      {error && (
        <p className="px-5 pb-2 font-poppins text-center" style={{ color: "var(--accent)", fontSize: "14px" }}>
          {error}
        </p>
      )}
    </div>
  );
}

function Avatar({ url, username }: { url: string | null; username: string }) {
  if (url) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={url} alt={username} className="rounded-full object-cover shrink-0" style={{ width: "42px", height: "42px" }} />
    );
  }
  return (
    <div
      className="rounded-full flex items-center justify-center font-poppins font-bold shrink-0"
      style={{ width: "42px", height: "42px", fontSize: "15px", background: "rgba(var(--fg-rgb),0.1)", color: "rgba(var(--fg-rgb),0.6)" }}
    >
      {username.charAt(0).toUpperCase()}
    </div>
  );
}
