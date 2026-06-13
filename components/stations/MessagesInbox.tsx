"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import {
  searchUsers,
  startConversation,
  getConversations,
  listIncomingDmRequests,
  listOutgoingDmRequestIds,
  respondToDmRequest,
} from "@/lib/dm/messages";
import { notifyDmRequest, notifyDmRequestAccepted } from "@/lib/push/client";
import FounderMark from "@/components/ui/FounderMark";
import PartnersPanel from "@/components/stations/PartnersPanel";
import type {
  ConversationSummary,
  DmParticipant,
  DmRequest,
  User,
} from "@/types";

export default function MessagesInbox({
  user,
  initialConversations,
}: {
  user: User;
  initialConversations: ConversationSummary[];
}) {
  const router = useRouter();
  const [tab, setTab] = useState<"dms" | "partners">("dms");
  const [partnerReqCount, setPartnerReqCount] = useState(0);
  const [conversations, setConversations] =
    useState<ConversationSummary[]>(initialConversations);
  const [requests, setRequests] = useState<DmRequest[]>([]);
  const [outgoing, setOutgoing] = useState<Set<string>>(new Set());

  const [query, setQuery] = useState("");
  const [results, setResults] = useState<DmParticipant[]>([]);
  const [searching, setSearching] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      const [convos, incoming, out] = await Promise.all([
        getConversations(user.id),
        listIncomingDmRequests(user.id),
        listOutgoingDmRequestIds(user.id),
      ]);
      setConversations(convos);
      setRequests(incoming);
      setOutgoing(out);
    } catch {
      /* keep last good state */
    }
  }, [user.id]);

  // Pull requests + outgoing state once on mount (the server only seeds the
  // accepted-conversation list). setState runs after the await, so the
  // synchronous cascading-render concern the rule guards against doesn't apply.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    refresh();
  }, [refresh]);

  // Live inbox: a new DM, or any conversation change (a request arriving, being
  // accepted, or declined), refreshes the lists. RLS guarantees I only receive
  // events for conversations I'm part of.
  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel("dm_inbox")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "direct_messages" },
        () => refresh()
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "conversations" },
        () => refresh()
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [refresh]);

  // Debounced username search.
  const debounce = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (debounce.current) clearTimeout(debounce.current);
    const q = query.trim();
    debounce.current = setTimeout(async () => {
      if (!q) {
        setResults([]);
        setSearching(false);
        return;
      }
      setSearching(true);
      try {
        setResults(await searchUsers(q, user.id));
      } catch {
        setResults([]);
      } finally {
        setSearching(false);
      }
    }, q ? 250 : 0);
    return () => {
      if (debounce.current) clearTimeout(debounce.current);
    };
  }, [query, user.id]);

  // Lookups for the per-result action state.
  const convoByPeer = new Map(conversations.map((c) => [c.other.id, c.id]));
  const incomingByUser = new Map(requests.map((r) => [r.from.id, r.conversation_id]));

  // Send a DM request to someone new (or open the chat directly if we're already
  // partners — the RPC reports back an accepted conversation in that case).
  async function sendRequest(other: DmParticipant) {
    if (busy) return;
    setBusy(other.id);
    try {
      const { conversationId, status } = await startConversation(other.id);
      if (status === "accepted") {
        router.push(`/messages/${conversationId}`);
        return;
      }
      setOutgoing((s) => new Set(s).add(other.id));
      notifyDmRequest(other.id);
    } catch (err) {
      alert(err instanceof Error ? err.message : "Couldn't send request.");
    } finally {
      setBusy(null);
    }
  }

  // Accept an incoming request (from the Requests list or a search result), then
  // drop into the freshly-opened conversation.
  async function accept(conversationId: string, fromId: string) {
    if (busy) return;
    setBusy(conversationId);
    try {
      await respondToDmRequest(conversationId, true);
      notifyDmRequestAccepted(fromId, conversationId);
      router.push(`/messages/${conversationId}`);
    } catch {
      setBusy(null);
    }
  }

  async function decline(conversationId: string) {
    if (busy) return;
    setBusy(conversationId);
    try {
      await respondToDmRequest(conversationId, false);
      await refresh();
    } catch {
      /* ignore */
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="px-5 md:px-10 py-10 max-w-2xl mx-auto w-full flex flex-col gap-8">
      {/* Tabs — direct messages vs accountability partners */}
      <div className="flex items-center gap-2">
        <TabButton active={tab === "dms"} onClick={() => setTab("dms")} badge={requests.length}>
          Messages
        </TabButton>
        <TabButton active={tab === "partners"} onClick={() => setTab("partners")} badge={partnerReqCount}>
          Partners
        </TabButton>
      </div>

      {tab === "partners" && (
        <PartnersPanel user={user} onRequestCount={setPartnerReqCount} />
      )}

      {tab === "dms" && (
        <>
      {/* Search to start a new DM (sends a request the other person must accept) */}
      <div className="flex flex-col gap-2">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search a username to message…"
          autoComplete="off"
          spellCheck={false}
          className="st-field bg-[var(--bg-surface)] text-[rgb(var(--fg-rgb))] px-4 py-3 text-base outline-none border border-[rgba(var(--fg-rgb),0.1)] focus:border-[var(--accent)] placeholder:text-[rgba(var(--fg-rgb),0.25)] rounded-[var(--radius-sm)]"
        />

        {query.trim() && (
          <div className="flex flex-col border border-[rgba(var(--fg-rgb),0.08)] rounded-[var(--radius-sm)] overflow-hidden">
            {searching && results.length === 0 ? (
              <span className="px-4 py-3 font-poppins font-light text-[rgba(var(--fg-rgb),0.3)]" style={{ fontSize: "16px" }}>
                Searching…
              </span>
            ) : results.length === 0 ? (
              <span className="px-4 py-3 font-poppins font-light text-[rgba(var(--fg-rgb),0.3)]" style={{ fontSize: "16px" }}>
                No members found.
              </span>
            ) : (
              results.map((r) => {
                const convoId = convoByPeer.get(r.id);
                const incomingId = incomingByUser.get(r.id);
                const requested = outgoing.has(r.id);
                return (
                  <div key={r.id} className="flex items-center gap-3 px-4 py-3">
                    <Avatar url={r.avatar_url} username={r.username} />
                    <span className="font-poppins text-[rgb(var(--fg-rgb))] flex items-center gap-1.5 flex-1" style={{ fontSize: "16px" }}>
                      {r.username}
                      <FounderMark founderNumber={r.founder_number} />
                    </span>
                    {convoId ? (
                      <Link
                        href={`/messages/${convoId}`}
                        className="st-btn px-3 py-1.5 font-poppins shrink-0"
                        style={{ fontSize: "13px", fontWeight: 600, background: "transparent", color: "rgba(var(--fg-rgb),0.55)", border: "0.5px solid rgba(var(--fg-rgb),0.15)" }}
                      >
                        Open
                      </Link>
                    ) : incomingId ? (
                      <button
                        type="button"
                        disabled={busy === incomingId}
                        onClick={() => accept(incomingId, r.id)}
                        className="st-btn px-3 py-1.5 font-poppins shrink-0 disabled:opacity-50"
                        style={{ fontSize: "13px", fontWeight: 600, background: "var(--accent)", color: "#fff", border: "none" }}
                      >
                        Accept
                      </button>
                    ) : (
                      <button
                        type="button"
                        disabled={requested || busy === r.id}
                        onClick={() => sendRequest(r)}
                        className="st-btn px-3 py-1.5 font-poppins shrink-0 disabled:opacity-50"
                        style={{
                          fontSize: "13px",
                          fontWeight: 600,
                          background: requested ? "transparent" : "var(--accent)",
                          color: requested ? "rgba(var(--fg-rgb),0.4)" : "#fff",
                          border: requested ? "0.5px solid rgba(var(--fg-rgb),0.15)" : "none",
                        }}
                      >
                        {requested ? "Requested" : "Message"}
                      </button>
                    )}
                  </div>
                );
              })
            )}
          </div>
        )}
      </div>

      {/* Incoming DM requests */}
      {requests.length > 0 && (
        <section className="flex flex-col gap-3">
          <h2 className="font-poppins font-black uppercase text-[rgb(var(--fg-rgb))]" style={{ fontSize: "15px", letterSpacing: "0.2em" }}>
            Requests
          </h2>
          {requests.map((r) => (
            <div key={r.conversation_id} className="flex items-center gap-3">
              <Avatar url={r.from.avatar_url} username={r.from.username} />
              <div className="flex-1 min-w-0">
                <span className="font-poppins text-[rgb(var(--fg-rgb))] flex items-center gap-1.5 truncate" style={{ fontSize: "16px" }}>
                  {r.from.username}
                  <FounderMark founderNumber={r.from.founder_number} />
                </span>
                <span className="font-poppins font-light text-[rgba(var(--fg-rgb),0.4)]" style={{ fontSize: "13px" }}>
                  wants to message you
                </span>
              </div>
              <button
                type="button"
                disabled={busy === r.conversation_id}
                onClick={() => accept(r.conversation_id, r.from.id)}
                className="st-btn px-3 py-1.5 font-poppins shrink-0 disabled:opacity-50"
                style={{ fontSize: "13px", fontWeight: 600, background: "var(--accent)", color: "#fff", border: "none" }}
              >
                Accept
              </button>
              <button
                type="button"
                disabled={busy === r.conversation_id}
                onClick={() => decline(r.conversation_id)}
                className="st-pill px-2 py-1.5 font-poppins shrink-0 disabled:opacity-50"
                style={{ fontSize: "13px", color: "rgba(var(--fg-rgb),0.45)" }}
              >
                Decline
              </button>
            </div>
          ))}
        </section>
      )}

      {/* Conversation list */}
      <div className="flex flex-col">
        <h2 className="font-poppins font-black uppercase text-[rgb(var(--fg-rgb))] mb-4" style={{ fontSize: "15px", letterSpacing: "0.2em" }}>
          Messages
        </h2>
        {conversations.length === 0 ? (
          <p className="font-playfair italic text-[rgba(var(--fg-rgb),0.3)]" style={{ fontSize: "17px" }}>
            No conversations yet. Search a username above to send a message request.
          </p>
        ) : (
          <div className="flex flex-col">
            {conversations.map((c) => (
              <Link
                key={c.id}
                href={`/messages/${c.id}`}
                className="flex items-center gap-3 py-3 border-b border-[rgba(var(--fg-rgb),0.06)] hover:bg-[rgba(var(--fg-rgb),0.03)] transition-colors -mx-2 px-2 rounded-[var(--radius-sm)]"
              >
                <Avatar url={c.other.avatar_url} username={c.other.username} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="font-poppins font-medium text-[rgb(var(--fg-rgb))] truncate" style={{ fontSize: "16px" }}>
                      {c.other.username}
                    </span>
                    <FounderMark founderNumber={c.other.founder_number} />
                    {c.unread && (
                      <span aria-label="Unread" className="ml-1 shrink-0 rounded-full" style={{ width: "7px", height: "7px", background: "var(--accent)" }} />
                    )}
                  </div>
                  <span
                    className="font-poppins font-light text-[rgba(var(--fg-rgb),0.4)] truncate block"
                    style={{ fontSize: "15px", fontWeight: c.unread ? 500 : 300 }}
                  >
                    {c.last_message ?? "Say hello."}
                  </span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
        </>
      )}
    </div>
  );
}

/** A pill tab with an optional count badge (used for pending requests). */
function TabButton({
  active,
  onClick,
  badge,
  children,
}: {
  active: boolean;
  onClick: () => void;
  badge?: number;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="st-pill relative px-4 py-2 font-poppins uppercase"
      style={{
        fontSize: "12px",
        letterSpacing: "0.12em",
        fontWeight: 600,
        color: active ? "var(--accent)" : "rgba(var(--fg-rgb),0.45)",
        background: active ? "rgba(var(--accent-rgb),0.1)" : "transparent",
        border: active ? "0.5px solid rgba(var(--accent-rgb),0.3)" : "0.5px solid rgba(var(--fg-rgb),0.1)",
      }}
    >
      {children}
      {badge ? (
        <span
          aria-label={`${badge} pending`}
          className="absolute flex items-center justify-center font-poppins"
          style={{
            top: "-6px",
            right: "-6px",
            minWidth: "18px",
            height: "18px",
            padding: "0 5px",
            borderRadius: "9999px",
            fontSize: "10px",
            fontWeight: 700,
            color: "#fff",
            background: "var(--accent)",
          }}
        >
          {badge}
        </span>
      ) : null}
    </button>
  );
}

function Avatar({ url, username }: { url: string | null; username: string }) {
  if (url) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={url} alt={username} className="rounded-full object-cover shrink-0" style={{ width: "48px", height: "48px" }} />
    );
  }
  return (
    <div
      className="rounded-full flex items-center justify-center font-poppins font-bold shrink-0"
      style={{ width: "48px", height: "48px", fontSize: "16px", background: "rgba(var(--fg-rgb),0.1)", color: "rgba(var(--fg-rgb),0.6)" }}
    >
      {username.charAt(0).toUpperCase()}
    </div>
  );
}
