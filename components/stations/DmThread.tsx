"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import Link from "next/link";
import { format } from "date-fns";
import { createClient } from "@/lib/supabase/client";
import {
  getMessages,
  sendDirectMessage,
  markConversationRead,
} from "@/lib/dm/messages";
import FounderMark from "@/components/ui/FounderMark";
import type { DirectMessage, DmParticipant, User } from "@/types";

const MAX_LEN = 2000;

export default function DmThread({
  user,
  conversationId,
  peer,
  initialMessages,
}: {
  user: User;
  conversationId: string;
  peer: DmParticipant;
  initialMessages: DirectMessage[];
}) {
  const [messages, setMessages] = useState<DirectMessage[]>(initialMessages);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = useCallback(() => {
    bottomRef.current?.scrollIntoView({ block: "end" });
  }, []);

  // Merge a message by id (de-dupes optimistic + realtime echoes).
  const upsert = useCallback((m: DirectMessage) => {
    setMessages((prev) => {
      if (prev.some((x) => x.id === m.id)) return prev;
      return [...prev, m].sort(
        (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
      );
    });
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
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [conversationId, user.id, upsert]);

  // Mark read on open and whenever messages change.
  useEffect(() => {
    markConversationRead(conversationId, user.id);
  }, [conversationId, user.id, messages.length]);

  useEffect(() => {
    scrollToBottom();
  }, [messages.length, scrollToBottom]);

  async function handleSend(e: React.FormEvent) {
    e.preventDefault();
    const content = draft.trim();
    if (!content || sending) return;
    setSending(true);
    setError(null);
    try {
      const saved = await sendDirectMessage(conversationId, user.id, content);
      upsert(saved);
      setDraft("");
    } catch {
      setError("Couldn't send. Try again.");
    } finally {
      setSending(false);
    }
  }

  // Re-fetch once on mount in case the server snapshot is stale.
  useEffect(() => {
    getMessages(conversationId).then(setMessages).catch(() => {});
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
          style={{ fontSize: "11px", letterSpacing: "0.15em" }}
        >
          ←
        </Link>
        <Avatar url={peer.avatar_url} username={peer.username} />
        <span className="font-poppins font-medium text-[rgb(var(--fg-rgb))] flex items-center gap-1.5" style={{ fontSize: "14px" }}>
          {peer.username}
          <FounderMark founderNumber={peer.founder_number} />
        </span>
      </div>

      {/* Messages */}
      <div className="flex-1 min-h-0 overflow-y-auto px-5 py-5 flex flex-col gap-2.5 max-w-2xl mx-auto w-full">
        {messages.length === 0 && (
          <p className="font-playfair italic text-[rgba(var(--fg-rgb),0.25)] text-center mt-8" style={{ fontSize: "14px" }}>
            This is the beginning of your conversation with {peer.username}.
          </p>
        )}
        {messages.map((m) => {
          const mine = m.sender_id === user.id;
          return (
            <div key={m.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
              <div
                className="font-poppins"
                style={{
                  maxWidth: "78%",
                  padding: "9px 13px",
                  borderRadius: "16px",
                  fontSize: "13px",
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
              </div>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>

      {/* Composer */}
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
            fontSize: "11px",
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
      {error && (
        <p className="px-5 pb-2 font-poppins text-center" style={{ color: "var(--accent)", fontSize: "11px" }}>
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
      <img src={url} alt={username} className="rounded-full object-cover shrink-0" style={{ width: "30px", height: "30px" }} />
    );
  }
  return (
    <div
      className="rounded-full flex items-center justify-center font-poppins font-bold shrink-0"
      style={{ width: "30px", height: "30px", fontSize: "12px", background: "rgba(var(--fg-rgb),0.1)", color: "rgba(var(--fg-rgb),0.6)" }}
    >
      {username.charAt(0).toUpperCase()}
    </div>
  );
}
