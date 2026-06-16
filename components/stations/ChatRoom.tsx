"use client";

import { useState, useEffect, useRef, useCallback, useMemo, type ReactNode } from "react";
import { format, isSameDay } from "date-fns";
import DateSeparator from "@/components/stations/DateSeparator";
import { openUserProfile } from "@/lib/userProfile";
import {
  subscribeMessages,
  subscribeMemberCount,
  subscribeOnlineCount,
  markPresent,
  sendMessage,
  canPost,
  isRecent,
  ROOM_META,
  MAX_MESSAGE_LENGTH,
  type RoomName,
  type ChatMessage,
} from "@/lib/firebase/rooms";
import { isFirebaseConfigured } from "@/lib/firebase/config";
import { joinRoom } from "@/lib/rooms/membership";
import { markRoomSeen } from "@/lib/rooms/useRoomStats";
import { notifyMentions } from "@/lib/push/client";
import { createClient } from "@/lib/supabase/client";
import type { User } from "@/types";
import FounderMark from "@/components/ui/FounderMark";

const EMOJIS = ["🔥", "💪", "🚀", "🎯", "👏", "🙌", "💡", "📈", "✅", "❤️", "😄", "🧠"];

interface ChatRoomProps {
  roomName: RoomName;
  user: User;
  /** Called after the user joins, with the updated memberships array. */
  onMembershipChange?: (memberships: string[]) => void;
}

export default function ChatRoom({ roomName, user, onMembershipChange }: ChatRoomProps) {
  const meta = ROOM_META[roomName];

  const [memberships, setMemberships] = useState<string[]>(user.room_memberships ?? []);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [memberCount, setMemberCount] = useState(0);
  const [onlineCount, setOnlineCount] = useState(0);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [joining, setJoining] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showEmoji, setShowEmoji] = useState(false);

  const seenIds = useRef<Set<string>>(new Set());
  const scrollRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  // Credit the "introduce yourself" activation item once per session after a
  // successful post (idempotent server-side; the ref avoids an RPC per message).
  const introStamped = useRef(false);

  const isMember = canPost(user.category, memberships, roomName);

  /* ----- Subscriptions -----
     ChatRoom is mounted with key={roomName} by its parent, so a room switch
     remounts with fresh state — no in-effect reset needed here. */
  useEffect(() => {
    const unsubMsg = subscribeMessages(roomName, (msg) => {
      if (seenIds.current.has(msg.id)) return;
      seenIds.current.add(msg.id);
      if (!isRecent(msg)) return; // 7-day client-side prune
      setMessages((prev) => [...prev, msg]);
    });
    const unsubMembers = subscribeMemberCount(roomName, setMemberCount);
    const unsubOnline = subscribeOnlineCount(roomName, setOnlineCount);

    markRoomSeen(roomName); // opening the room clears its unread badge

    return () => {
      unsubMsg();
      unsubMembers();
      unsubOnline();
    };
  }, [roomName]);

  /* ----- Presence (only when a member) ----- */
  useEffect(() => {
    if (!isMember) return;
    const clear = markPresent(roomName, user.id);
    return clear;
  }, [roomName, user.id, isMember]);

  /* ----- Auto-scroll to bottom on new messages ----- */
  const sorted = useMemo(
    () => [...messages].sort((a, b) => a.created_at - b.created_at),
    [messages]
  );

  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [sorted.length]);

  /* ----- Send ----- */
  const handleSend = useCallback(async () => {
    const content = draft.trim();
    if (!content || sending) return;
    if (content.length > MAX_MESSAGE_LENGTH) {
      setError(`Messages are limited to ${MAX_MESSAGE_LENGTH} characters.`);
      return;
    }
    if (!canPost(user.category, memberships, roomName)) {
      setError("You can only post in your category room or rooms you've joined.");
      return;
    }
    setSending(true);
    setError(null);
    try {
      await sendMessage(roomName, {
        user_id: user.id,
        username: user.username,
        avatar_url: user.avatar_url,
        category: user.category,
        founder_number: user.founder_number,
        content,
      });
      notifyMentions(roomName, content);
      if (!introStamped.current) {
        introStamped.current = true;
        const supabase = createClient();
        void supabase
          .rpc("complete_activation_task", { p_item_key: "room_intro" })
          .then(() => {}, () => {});
      }
      setDraft("");
      setShowEmoji(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to send message.");
    } finally {
      setSending(false);
    }
  }, [draft, sending, user, memberships, roomName]);

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  function insertEmoji(emoji: string) {
    setDraft((prev) => (prev + emoji).slice(0, MAX_MESSAGE_LENGTH));
    textareaRef.current?.focus();
  }

  async function handleJoin() {
    if (joining) return;
    setJoining(true);
    setError(null);
    try {
      const next = await joinRoom(user.id, memberships, roomName);
      setMemberships(next);
      onMembershipChange?.(next);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to join room.");
    } finally {
      setJoining(false);
    }
  }

  /* ----- Render ----- */
  return (
    <div className="flex flex-col h-full min-h-0">
      {/* Header */}
      <div
        className="flex items-baseline justify-between px-6 py-4 shrink-0"
        style={{ borderBottom: "0.5px solid rgba(var(--fg-rgb),0.08)" }}
      >
        <h2
          className="font-poppins font-black uppercase text-[rgb(var(--fg-rgb))]"
          style={{ fontSize: "21px", letterSpacing: "0.02em" }}
        >
          {meta.title}
        </h2>
        <span
          className="font-poppins text-[rgba(var(--fg-rgb),0.3)]"
          style={{ fontSize: "14px" }}
        >
          <span style={{ color: "var(--accent)" }}>{onlineCount} online</span>
          {" · "}
          {memberCount} total
        </span>
      </div>

      {/* Messages */}
      <div
        ref={scrollRef}
        className="flex-1 min-h-0 overflow-y-auto px-6 py-4"
        style={{ background: "var(--bg-surface)" }}
      >
        {!isFirebaseConfigured ? (
          <p className="font-poppins text-[rgba(var(--fg-rgb),0.4)]" style={{ fontSize: "16px" }}>
            Chat is not configured. Add your Firebase keys to <code>.env.local</code>.
          </p>
        ) : sorted.length === 0 ? (
          <p
            className="font-playfair italic text-[rgba(var(--fg-rgb),0.25)]"
            style={{ fontSize: "17px" }}
          >
            No messages yet. {isMember ? "Say something." : "Join to start the conversation."}
          </p>
        ) : (
          <div className="flex flex-col gap-4">
            {sorted.flatMap((m, i) => {
              const prev = sorted[i - 1];
              const out: ReactNode[] = [];
              if (!prev || !isSameDay(prev.created_at, m.created_at)) {
                out.push(<DateSeparator key={`s-${m.id}`} date={new Date(m.created_at)} />);
              }
              out.push(<MessageRow key={m.id} message={m} />);
              return out;
            })}
          </div>
        )}
      </div>

      {/* Error */}
      {error && (
        <div
          className="px-6 py-2 font-poppins shrink-0"
          style={{ fontSize: "14px", color: "var(--accent)" }}
        >
          {error}
        </div>
      )}

      {/* Input or Join */}
      {isMember ? (
        <div
          className="shrink-0 px-6 py-4"
          style={{ borderTop: "0.5px solid rgba(var(--fg-rgb),0.08)" }}
        >
          {showEmoji && (
            <div className="flex flex-wrap gap-2 mb-3">
              {EMOJIS.map((e) => (
                <button
                  key={e}
                  type="button"
                  onClick={() => insertEmoji(e)}
                  className="hover:scale-125 transition-transform"
                  style={{ fontSize: "21px" }}
                >
                  {e}
                </button>
              ))}
            </div>
          )}
          <div
            className="flex items-end gap-3 px-3 py-1.5"
            style={{
              background: "var(--bg-surface)",
              border: "0.5px solid rgba(var(--fg-rgb),0.1)",
              borderRadius: "var(--radius-md)",
            }}
          >
            <button
              type="button"
              onClick={() => setShowEmoji((v) => !v)}
              aria-label="Emoji"
              className="text-[rgba(var(--fg-rgb),0.4)] hover:text-[rgb(var(--fg-rgb))] transition-colors pb-2"
              style={{ fontSize: "21px" }}
            >
              ☺
            </button>
            <textarea
              ref={textareaRef}
              value={draft}
              onChange={(e) => setDraft(e.target.value.slice(0, MAX_MESSAGE_LENGTH))}
              onKeyDown={handleKeyDown}
              placeholder="Message the room..."
              rows={1}
              maxLength={MAX_MESSAGE_LENGTH}
              className="flex-1 resize-none bg-transparent font-poppins font-light text-[rgb(var(--fg-rgb))] placeholder:text-[rgba(var(--fg-rgb),0.25)] focus:outline-none py-2"
              style={{ fontSize: "16px", maxHeight: "120px", lineHeight: 1.5 }}
            />
            <span
              className="font-poppins text-[rgba(var(--fg-rgb),0.25)] pb-2.5"
              style={{ fontSize: "13px" }}
            >
              {draft.length}/{MAX_MESSAGE_LENGTH}
            </span>
            <button
              type="button"
              onClick={handleSend}
              disabled={sending || !draft.trim()}
              className="st-btn font-poppins font-bold uppercase disabled:opacity-40 my-1"
              style={{
                fontSize: "14px",
                letterSpacing: "0.1em",
                background: "var(--accent)",
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
          className="shrink-0 px-6 py-4 flex items-center justify-between gap-4"
          style={{ borderTop: "0.5px solid rgba(var(--fg-rgb),0.08)" }}
        >
          <span
            className="font-poppins font-light text-[rgba(var(--fg-rgb),0.4)]"
            style={{ fontSize: "15px" }}
          >
            You&apos;re viewing this room. Join to post.
          </span>
          <button
            type="button"
            onClick={handleJoin}
            disabled={joining}
            className="st-btn font-poppins font-bold uppercase disabled:opacity-50"
            style={{
              fontSize: "14px",
              letterSpacing: "0.1em",
              background: "var(--accent)",
              color: "var(--bg-primary)",
              padding: "10px 20px",
            }}
          >
            {joining ? "Joining…" : "Join Room"}
          </button>
        </div>
      )}
    </div>
  );
}

function MessageRow({ message }: { message: ChatMessage }) {
  return (
    <div className="flex gap-3">
      <button
        type="button"
        onClick={() => openUserProfile(message.user_id)}
        className="shrink-0"
        style={{ background: "none", border: "none", padding: 0, cursor: "pointer" }}
        aria-label={`View ${message.username}'s profile`}
      >
        <Avatar url={message.avatar_url} username={message.username} />
      </button>
      <div className="flex-1 min-w-0">
        <div className="flex items-baseline gap-2">
          <span
            className="font-poppins font-medium text-[rgb(var(--fg-rgb))] hover:text-[var(--accent)] transition-colors"
            style={{ fontSize: "15px", cursor: "pointer" }}
            onClick={() => openUserProfile(message.user_id)}
          >
            {message.username}
          </span>
          <FounderMark founderNumber={message.founder_number} />
          <span
            className="font-poppins text-[rgba(var(--fg-rgb),0.25)] ml-auto"
            style={{ fontSize: "13px" }}
          >
            {format(message.created_at, "h:mm a")}
          </span>
        </div>
        <p
          className="font-poppins font-light text-[rgba(var(--fg-rgb),0.8)] break-words whitespace-pre-wrap"
          style={{ fontSize: "16px", lineHeight: 1.5 }}
        >
          {message.content}
        </p>
      </div>
    </div>
  );
}

function Avatar({ url, username }: { url: string | null; username: string }) {
  if (url) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={url}
        alt={username}
        width={40}
        height={40}
        className="rounded-full object-cover shrink-0"
        style={{ width: "40px", height: "40px" }}
      />
    );
  }
  return (
    <div
      className="rounded-full shrink-0 flex items-center justify-center font-poppins font-bold"
      style={{
        width: "28px",
        height: "28px",
        fontSize: "14px",
        background: "rgba(var(--fg-rgb),0.1)",
        color: "rgba(var(--fg-rgb),0.6)",
      }}
    >
      {username.charAt(0).toUpperCase()}
    </div>
  );
}
