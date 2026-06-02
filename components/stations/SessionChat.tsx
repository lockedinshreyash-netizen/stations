"use client";

import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { format } from "date-fns";
import {
  subscribeSessionMessages,
  sendSessionMessage,
  MAX_MESSAGE_LENGTH,
  type WorkChatMessage,
} from "@/lib/firebase/work-chat";
import { isFirebaseConfigured } from "@/lib/firebase/config";
import { closeChat } from "@/lib/work/sessions";
import type { User } from "@/types";

interface SessionChatProps {
  sessionId: string;
  user: User;
  /** Host-set read-only flag from work_sessions.chat_closed. */
  chatClosed: boolean;
  /** Whether this user is allowed to post (member, not left early, session live). */
  canSend: boolean;
  isHost: boolean;
}

export default function SessionChat({
  sessionId,
  user,
  chatClosed,
  canSend,
  isHost,
}: SessionChatProps) {
  const [messages, setMessages] = useState<WorkChatMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [closing, setClosing] = useState(false);
  // Locally-set close (host action) ORed with the persisted prop, so we don't
  // need an effect to mirror the prop into state.
  const [locallyClosed, setLocallyClosed] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const closed = chatClosed || locallyClosed;

  const seenIds = useRef<Set<string>>(new Set());
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const unsub = subscribeSessionMessages(sessionId, (msg) => {
      if (seenIds.current.has(msg.id)) return;
      seenIds.current.add(msg.id);
      setMessages((prev) => [...prev, msg]);
    });
    return unsub;
  }, [sessionId]);

  const sorted = useMemo(
    () => [...messages].sort((a, b) => a.created_at - b.created_at),
    [messages]
  );

  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [sorted.length]);

  const writable = canSend && !closed;

  const handleSend = useCallback(async () => {
    const content = draft.trim();
    if (!content || sending || !writable) return;
    setSending(true);
    setError(null);
    try {
      await sendSessionMessage(sessionId, {
        user_id: user.id,
        username: user.username,
        avatar_url: user.avatar_url,
        content: content.slice(0, MAX_MESSAGE_LENGTH),
      });
      setDraft("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to send.");
    } finally {
      setSending(false);
    }
  }, [draft, sending, writable, sessionId, user]);

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  async function handleCloseChat() {
    if (closing) return;
    setClosing(true);
    try {
      await closeChat(sessionId);
      setLocallyClosed(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to close chat.");
    } finally {
      setClosing(false);
    }
  }

  return (
    <div className="flex flex-col h-full min-h-0">
      {/* Header */}
      <div
        className="flex items-center justify-between px-6 py-4 shrink-0"
        style={{ borderBottom: "0.5px solid rgba(var(--fg-rgb),0.08)" }}
      >
        <h2
          className="font-poppins font-black uppercase text-[rgb(var(--fg-rgb))]"
          style={{ fontSize: "14px", letterSpacing: "0.04em" }}
        >
          Session Chat
        </h2>
        {isHost && !closed && (
          <button
            type="button"
            onClick={handleCloseChat}
            disabled={closing}
            className="font-poppins font-bold uppercase text-[rgba(var(--fg-rgb),0.4)] hover:text-[var(--accent)] transition-colors disabled:opacity-50"
            style={{ fontSize: "10px", letterSpacing: "0.1em" }}
          >
            {closing ? "Closing…" : "Close chat"}
          </button>
        )}
        {closed && (
          <span
            className="font-poppins uppercase text-[rgba(var(--fg-rgb),0.3)]"
            style={{ fontSize: "10px", letterSpacing: "0.1em" }}
          >
            Read-only
          </span>
        )}
      </div>

      {/* Messages */}
      <div
        ref={scrollRef}
        className="flex-1 min-h-0 overflow-y-auto px-6 py-4"
        style={{ background: "var(--bg-surface)" }}
      >
        {!isFirebaseConfigured ? (
          <p className="font-poppins text-[rgba(var(--fg-rgb),0.4)]" style={{ fontSize: "13px" }}>
            Chat is not configured. Add your Firebase keys to <code>.env.local</code>.
          </p>
        ) : sorted.length === 0 ? (
          <p
            className="font-playfair italic text-[rgba(var(--fg-rgb),0.25)]"
            style={{ fontSize: "14px" }}
          >
            No messages yet. Focus together.
          </p>
        ) : (
          <div className="flex flex-col gap-4">
            {sorted.map((m) =>
              m.system ? (
                <SystemRow key={m.id} message={m} />
              ) : (
                <MessageRow key={m.id} message={m} />
              )
            )}
          </div>
        )}
      </div>

      {error && (
        <div
          className="px-6 py-2 font-poppins shrink-0"
          style={{ fontSize: "11px", color: "var(--accent)" }}
        >
          {error}
        </div>
      )}

      {/* Input */}
      {writable ? (
        <div
          className="shrink-0 px-6 py-4"
          style={{ borderTop: "0.5px solid rgba(var(--fg-rgb),0.08)" }}
        >
          <div className="flex items-end gap-3">
            <textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value.slice(0, MAX_MESSAGE_LENGTH))}
              onKeyDown={handleKeyDown}
              placeholder="Message the session..."
              rows={1}
              maxLength={MAX_MESSAGE_LENGTH}
              className="flex-1 resize-none bg-transparent font-poppins font-light text-[rgb(var(--fg-rgb))] placeholder:text-[rgba(var(--fg-rgb),0.25)] focus:outline-none"
              style={{ fontSize: "13px", maxHeight: "120px", lineHeight: 1.5 }}
            />
            <span
              className="font-poppins text-[rgba(var(--fg-rgb),0.25)] pb-2"
              style={{ fontSize: "10px" }}
            >
              {draft.length}/{MAX_MESSAGE_LENGTH}
            </span>
            <button
              type="button"
              onClick={handleSend}
              disabled={sending || !draft.trim()}
              className="font-poppins font-bold uppercase disabled:opacity-40"
              style={{
                fontSize: "11px",
                letterSpacing: "0.1em",
                background: "rgb(var(--fg-rgb))",
                color: "var(--bg-primary)",
                padding: "8px 16px",
              }}
            >
              Send
            </button>
          </div>
        </div>
      ) : (
        <div
          className="shrink-0 px-6 py-4"
          style={{ borderTop: "0.5px solid rgba(var(--fg-rgb),0.08)" }}
        >
          <span
            className="font-poppins font-light text-[rgba(var(--fg-rgb),0.4)]"
            style={{ fontSize: "12px" }}
          >
            {closed
              ? "The host closed this chat."
              : "Chat is read-only."}
          </span>
        </div>
      )}
    </div>
  );
}

function MessageRow({ message }: { message: WorkChatMessage }) {
  return (
    <div className="flex gap-3">
      <Avatar url={message.avatar_url} username={message.username} />
      <div className="flex-1 min-w-0">
        <div className="flex items-baseline gap-2">
          <span
            className="font-poppins font-medium text-[rgb(var(--fg-rgb))]"
            style={{ fontSize: "12px" }}
          >
            {message.username}
          </span>
          <span
            className="font-poppins text-[rgba(var(--fg-rgb),0.25)] ml-auto"
            style={{ fontSize: "10px" }}
          >
            {format(message.created_at, "h:mm a")}
          </span>
        </div>
        <p
          className="font-poppins font-light text-[rgba(var(--fg-rgb),0.8)] break-words whitespace-pre-wrap"
          style={{ fontSize: "13px", lineHeight: 1.5 }}
        >
          {message.content}
        </p>
      </div>
    </div>
  );
}

function SystemRow({ message }: { message: WorkChatMessage }) {
  return (
    <p
      className="font-playfair italic text-[rgba(var(--fg-rgb),0.4)] text-center"
      style={{ fontSize: "12px" }}
    >
      {message.content}
    </p>
  );
}

function Avatar({ url, username }: { url: string | null; username: string }) {
  if (url) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={url}
        alt={username}
        width={28}
        height={28}
        className="rounded-full object-cover shrink-0"
        style={{ width: "28px", height: "28px" }}
      />
    );
  }
  return (
    <div
      className="rounded-full shrink-0 flex items-center justify-center font-poppins font-bold"
      style={{
        width: "28px",
        height: "28px",
        fontSize: "11px",
        background: "rgba(var(--fg-rgb),0.1)",
        color: "rgba(var(--fg-rgb),0.6)",
      }}
    >
      {username.charAt(0).toUpperCase()}
    </div>
  );
}
