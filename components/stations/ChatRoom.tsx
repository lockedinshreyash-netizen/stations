"use client";

import { useState, useEffect, useRef, useCallback, useMemo, type ReactNode } from "react";
import { format, isSameDay } from "date-fns";
import { Smile, ArrowUp, Users } from "lucide-react";
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
import { ROOM_IDENTITY } from "@/lib/rooms/identity";
import { isFirebaseConfigured } from "@/lib/firebase/config";
import { joinRoom } from "@/lib/rooms/membership";
import { markRoomSeen } from "@/lib/rooms/useRoomStats";
import { notifyMentions } from "@/lib/push/client";
import { createClient } from "@/lib/supabase/client";
import type { User } from "@/types";
import FounderMark from "@/components/ui/FounderMark";

const EMOJIS = ["🔥", "💪", "🚀", "🎯", "👏", "🙌", "💡", "📈", "✅", "❤️", "😄", "🧠"];

// Consecutive messages from the same author inside this window collapse into a
// single visual group (one avatar + name header), Slack/Discord style.
const GROUP_WINDOW_MS = 5 * 60 * 1000;

interface ChatRoomProps {
  roomName: RoomName;
  user: User;
  /** Called after the user joins, with the updated memberships array. */
  onMembershipChange?: (memberships: string[]) => void;
}

export default function ChatRoom({ roomName, user, onMembershipChange }: ChatRoomProps) {
  const meta = ROOM_META[roomName];
  const identity = ROOM_IDENTITY[roomName];

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

  const Icon = identity.Icon;

  /* ----- Render ----- */
  return (
    <div className="flex flex-col h-full min-h-0">
      {/* Header — a lit platform sign: glyph tile, title + code, live status. */}
      <div
        className="relative shrink-0 flex items-center gap-3.5 px-5 md:px-6 py-3.5"
        style={{
          borderBottom: "0.5px solid rgba(var(--fg-rgb),0.08)",
          background:
            "linear-gradient(180deg, rgba(var(--accent-2-rgb),0.04), transparent)",
        }}
      >
        {/* Glyph tile */}
        <div
          className="shrink-0 flex items-center justify-center rounded-[12px]"
          style={{
            width: "44px",
            height: "44px",
            background: identity.sealed
              ? "rgba(var(--accent-2-rgb),0.14)"
              : "rgba(var(--fg-rgb),0.05)",
            border: `0.5px solid ${
              identity.sealed
                ? "rgba(var(--accent-2-rgb),0.35)"
                : "rgba(var(--fg-rgb),0.1)"
            }`,
            color: identity.sealed
              ? "var(--accent-2)"
              : "rgba(var(--fg-rgb),0.65)",
          }}
        >
          <Icon size={22} strokeWidth={1.75} aria-hidden />
        </div>

        {/* Title + code + description */}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2.5">
            <h2
              className="font-poppins font-black uppercase text-[rgb(var(--fg-rgb))] truncate"
              style={{ fontSize: "19px", letterSpacing: "0.01em", lineHeight: 1.1 }}
            >
              {meta.title}
            </h2>
            <span
              className="shrink-0 font-poppins font-bold uppercase rounded-full"
              style={{
                fontSize: "10px",
                letterSpacing: "0.18em",
                padding: "2px 8px",
                color: "rgba(var(--accent-2-rgb),0.85)",
                background: "rgba(var(--accent-2-rgb),0.08)",
                border: "0.5px solid rgba(var(--accent-2-rgb),0.22)",
              }}
            >
              {identity.sealed ? "SEALED" : `PLATFORM ${identity.code}`}
            </span>
          </div>
          <p
            className="font-poppins font-light text-[rgba(var(--fg-rgb),0.4)] truncate hidden sm:block"
            style={{ fontSize: "13px", marginTop: "1px" }}
          >
            {meta.description}
          </p>
        </div>

        {/* Live status */}
        <div className="shrink-0 flex flex-col items-end gap-1">
          <span className="flex items-center gap-1.5">
            {onlineCount > 0 && (
              <span className="st-live-dot" style={{ width: "7px", height: "7px" }} />
            )}
            <span
              className="font-poppins font-bold uppercase"
              style={{
                fontSize: "11px",
                letterSpacing: "0.14em",
                color: onlineCount > 0 ? "var(--accent-2)" : "rgba(var(--fg-rgb),0.3)",
              }}
            >
              {onlineCount} online
            </span>
          </span>
          <span
            className="flex items-center gap-1 font-poppins text-[rgba(var(--fg-rgb),0.3)]"
            style={{ fontSize: "12px" }}
          >
            <Users size={12} strokeWidth={2} aria-hidden />
            {memberCount}
          </span>
        </div>
      </div>

      {/* Messages */}
      <div
        ref={scrollRef}
        className="flex-1 min-h-0 overflow-y-auto px-4 md:px-6 py-5"
        style={{ background: "var(--bg-surface)" }}
      >
        {!isFirebaseConfigured ? (
          <p className="font-poppins text-[rgba(var(--fg-rgb),0.4)]" style={{ fontSize: "16px" }}>
            Chat is not configured. Add your Firebase keys to <code>.env.local</code>.
          </p>
        ) : sorted.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center gap-3 px-6">
            <Icon
              size={56}
              strokeWidth={1.25}
              aria-hidden
              style={{ color: "rgba(var(--accent-2-rgb),0.25)" }}
            />
            <p
              className="font-poppins font-bold uppercase"
              style={{
                fontSize: "13px",
                letterSpacing: "0.22em",
                color: "rgba(var(--accent-2-rgb),0.7)",
              }}
            >
              Platform clear
            </p>
            <p
              className="font-playfair italic text-[rgba(var(--fg-rgb),0.35)] max-w-xs"
              style={{ fontSize: "17px", lineHeight: 1.4 }}
            >
              {isMember
                ? "No departures yet. Be the first to say something."
                : "Join the room to start the conversation."}
            </p>
          </div>
        ) : (
          <div className="flex flex-col">
            {sorted.flatMap((m, i) => {
              const prev = sorted[i - 1];
              const out: ReactNode[] = [];
              const newDay = !prev || !isSameDay(prev.created_at, m.created_at);
              if (newDay) {
                out.push(<DateSeparator key={`s-${m.id}`} date={new Date(m.created_at)} />);
              }
              // First of a group when the day breaks, the author changes, or
              // there's a gap larger than the grouping window.
              const firstOfGroup =
                newDay ||
                prev.user_id !== m.user_id ||
                m.created_at - prev.created_at > GROUP_WINDOW_MS;
              out.push(
                <MessageRow
                  key={m.id}
                  message={m}
                  isOwn={m.user_id === user.id}
                  firstOfGroup={firstOfGroup}
                />
              );
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
          className="shrink-0 px-4 md:px-6 py-4"
          style={{ borderTop: "0.5px solid rgba(var(--fg-rgb),0.08)" }}
        >
          {showEmoji && (
            <div
              className="flex flex-wrap gap-1 mb-3 p-2 w-fit"
              style={{
                background: "var(--bg-surface)",
                border: "0.5px solid rgba(var(--accent-2-rgb),0.2)",
                borderRadius: "var(--radius-md)",
                boxShadow: "var(--shadow-md)",
              }}
            >
              {EMOJIS.map((e) => (
                <button
                  key={e}
                  type="button"
                  onClick={() => insertEmoji(e)}
                  className="rounded-lg hover:bg-[rgba(var(--fg-rgb),0.06)] hover:scale-110 transition-transform"
                  style={{ fontSize: "20px", width: "34px", height: "34px", lineHeight: 1 }}
                >
                  {e}
                </button>
              ))}
            </div>
          )}
          <div
            className="flex items-end gap-2 px-2 py-1.5"
            style={{
              background: "var(--bg-secondary)",
              border: "0.5px solid rgba(var(--fg-rgb),0.1)",
              borderRadius: "var(--radius-md)",
            }}
          >
            <button
              type="button"
              onClick={() => setShowEmoji((v) => !v)}
              aria-label="Emoji"
              className="shrink-0 flex items-center justify-center rounded-lg transition-colors"
              style={{
                width: "36px",
                height: "36px",
                color: showEmoji ? "var(--accent-2)" : "rgba(var(--fg-rgb),0.4)",
              }}
            >
              <Smile size={20} strokeWidth={1.75} />
            </button>
            <textarea
              ref={textareaRef}
              value={draft}
              onChange={(e) => setDraft(e.target.value.slice(0, MAX_MESSAGE_LENGTH))}
              onKeyDown={handleKeyDown}
              placeholder="Message the room…"
              rows={1}
              maxLength={MAX_MESSAGE_LENGTH}
              className="flex-1 resize-none bg-transparent font-poppins font-light text-[rgb(var(--fg-rgb))] placeholder:text-[rgba(var(--fg-rgb),0.25)] focus:outline-none py-2"
              style={{ fontSize: "16px", maxHeight: "120px", lineHeight: 1.5 }}
            />
            {draft.length > MAX_MESSAGE_LENGTH * 0.8 && (
              <span
                className="font-poppins pb-2.5 tabular-nums"
                style={{
                  fontSize: "12px",
                  color:
                    draft.length >= MAX_MESSAGE_LENGTH
                      ? "var(--accent)"
                      : "rgba(var(--fg-rgb),0.3)",
                }}
              >
                {MAX_MESSAGE_LENGTH - draft.length}
              </span>
            )}
            <button
              type="button"
              onClick={handleSend}
              disabled={sending || !draft.trim()}
              aria-label="Send message"
              className="st-btn shrink-0 flex items-center justify-center disabled:opacity-30 my-0.5"
              style={{
                width: "38px",
                height: "38px",
                borderRadius: "10px",
                background: draft.trim() ? "rgb(var(--fg-rgb))" : "rgba(var(--fg-rgb),0.12)",
                color: "var(--bg-primary)",
                transition: "background 200ms var(--ease), opacity 200ms var(--ease)",
              }}
            >
              <ArrowUp size={20} strokeWidth={2.5} />
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

/** Splits message text so @mentions render in brass. */
function renderContent(text: string): ReactNode[] {
  return text.split(/(@[\w-]+)/g).map((part, i) =>
    part.startsWith("@") && part.length > 1 ? (
      <span
        key={i}
        style={{
          color: "var(--accent-2)",
          fontWeight: 400,
          background: "rgba(var(--accent-2-rgb),0.08)",
          borderRadius: "4px",
          padding: "0 3px",
        }}
      >
        {part}
      </span>
    ) : (
      <span key={i}>{part}</span>
    )
  );
}

function MessageRow({
  message,
  isOwn,
  firstOfGroup,
}: {
  message: ChatMessage;
  isOwn: boolean;
  firstOfGroup: boolean;
}) {
  return (
    <div
      className="group flex gap-3 px-2 -mx-2 rounded-lg hover:bg-[rgba(var(--fg-rgb),0.03)]"
      style={{ paddingTop: firstOfGroup ? "8px" : "1px", paddingBottom: "1px" }}
    >
      {/* Gutter: avatar on the first message of a group, hover-time otherwise */}
      <div className="shrink-0 flex justify-center" style={{ width: "40px" }}>
        {firstOfGroup ? (
          <button
            type="button"
            onClick={() => openUserProfile(message.user_id)}
            style={{ background: "none", border: "none", padding: 0, cursor: "pointer" }}
            aria-label={`View ${message.username}'s profile`}
          >
            <Avatar url={message.avatar_url} username={message.username} />
          </button>
        ) : (
          <span
            className="opacity-0 group-hover:opacity-100 transition-opacity font-poppins tabular-nums self-start"
            style={{ fontSize: "10px", color: "rgba(var(--fg-rgb),0.3)", paddingTop: "3px" }}
          >
            {format(message.created_at, "h:mm")}
          </span>
        )}
      </div>

      <div className="flex-1 min-w-0">
        {firstOfGroup && (
          <div className="flex items-baseline gap-2">
            <span
              className="font-poppins font-medium hover:underline transition-colors"
              style={{
                fontSize: "15px",
                cursor: "pointer",
                color: isOwn ? "var(--accent-2)" : "rgb(var(--fg-rgb))",
              }}
              onClick={() => openUserProfile(message.user_id)}
            >
              {message.username}
            </span>
            <FounderMark founderNumber={message.founder_number} />
            <span
              className="font-poppins text-[rgba(var(--fg-rgb),0.25)]"
              style={{ fontSize: "12px" }}
            >
              {format(message.created_at, "h:mm a")}
            </span>
          </div>
        )}
        <p
          className="font-poppins font-light text-[rgba(var(--fg-rgb),0.82)] break-words whitespace-pre-wrap"
          style={{ fontSize: "16px", lineHeight: 1.5 }}
        >
          {renderContent(message.content)}
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
        width: "40px",
        height: "40px",
        fontSize: "16px",
        background: "rgba(var(--fg-rgb),0.1)",
        color: "rgba(var(--fg-rgb),0.6)",
      }}
    >
      {username.charAt(0).toUpperCase()}
    </div>
  );
}
