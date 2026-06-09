"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Circle, MessageCircle, UserMinus } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { searchUsers, startConversation } from "@/lib/dm/messages";
import {
  listPartners,
  listIncomingRequests,
  listOutgoingRequestIds,
  sendPartnerRequest,
  respondToRequest,
  removePartner,
} from "@/lib/partners/queries";
import { getPartnerTodayPlan } from "@/lib/todos/queries";
import { notifyPartnerRequest, notifyPartnerAccepted } from "@/lib/push/client";
import FounderMark from "@/components/ui/FounderMark";
import type {
  DmParticipant,
  PartnerRequest,
  PartnerSummary,
  PartnerTodo,
  User,
} from "@/types";

export default function PartnersPanel({
  user,
  onRequestCount,
}: {
  user: User;
  onRequestCount?: (n: number) => void;
}) {
  const router = useRouter();
  const [partners, setPartners] = useState<PartnerSummary[]>([]);
  const [requests, setRequests] = useState<PartnerRequest[]>([]);
  const [progress, setProgress] = useState<Record<string, PartnerTodo[]>>({});
  const [outgoing, setOutgoing] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState<string | null>(null);

  const [query, setQuery] = useState("");
  const [results, setResults] = useState<DmParticipant[]>([]);
  const [searching, setSearching] = useState(false);

  const load = useCallback(async () => {
    try {
      const [p, r, out] = await Promise.all([
        listPartners(user.id),
        listIncomingRequests(user.id),
        listOutgoingRequestIds(user.id),
      ]);
      setPartners(p);
      setRequests(r);
      setOutgoing(out);
      onRequestCount?.(r.length);

      // Each partner's plan is owner-only via RLS, so it's read through the
      // authorized RPC one call at a time (small N).
      const entries = await Promise.all(
        p.map(async (s) => {
          try {
            return [s.partner.id, await getPartnerTodayPlan(s.partner.id)] as const;
          } catch {
            return [s.partner.id, [] as PartnerTodo[]] as const;
          }
        })
      );
      setProgress(Object.fromEntries(entries));
    } catch {
      /* keep last good state */
    }
  }, [user.id, onRequestCount]);

  useEffect(() => {
    // Initial load on mount; setState runs post-fetch (async), so the rule's
    // synchronous cascading-render concern doesn't apply here.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load]);

  // Live-refresh when any partnership I'm part of changes (RLS-filtered).
  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel("partnerships_panel")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "partnerships" },
        () => load()
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [load]);

  // Debounced username search for new partners.
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
    }, 250);
    return () => {
      if (debounce.current) clearTimeout(debounce.current);
    };
  }, [query, user.id]);

  const partnerIds = new Set(partners.map((p) => p.partner.id));

  async function request(other: DmParticipant) {
    if (busy) return;
    setBusy(other.id);
    try {
      await sendPartnerRequest(user.id, other.id);
      notifyPartnerRequest(other.id);
      setOutgoing((s) => new Set(s).add(other.id));
    } catch (err) {
      alert(err instanceof Error ? err.message : "Couldn't send request.");
    } finally {
      setBusy(null);
    }
  }

  async function accept(r: PartnerRequest) {
    if (busy) return;
    setBusy(r.partnership_id);
    try {
      await respondToRequest(r.partnership_id, true);
      notifyPartnerAccepted(r.from.id);
      await load();
    } catch {
      /* ignore */
    } finally {
      setBusy(null);
    }
  }

  async function decline(r: PartnerRequest) {
    if (busy) return;
    setBusy(r.partnership_id);
    try {
      await respondToRequest(r.partnership_id, false);
      await load();
    } catch {
      /* ignore */
    } finally {
      setBusy(null);
    }
  }

  async function message(partner: DmParticipant) {
    try {
      const id = await startConversation(partner.id);
      router.push(`/messages/${id}`);
    } catch {
      /* ignore */
    }
  }

  async function unpartner(s: PartnerSummary) {
    if (busy) return;
    if (!confirm(`Remove ${s.partner.username} as a partner?`)) return;
    setBusy(s.partnership_id);
    try {
      await removePartner(s.partnership_id);
      await load();
    } catch {
      /* ignore */
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="flex flex-col gap-8">
      {/* Find + add a partner */}
      <div className="flex flex-col gap-2">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search a username to add as a partner…"
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
                const already = partnerIds.has(r.id);
                const requested = outgoing.has(r.id);
                return (
                  <div key={r.id} className="flex items-center gap-3 px-4 py-3">
                    <Avatar url={r.avatar_url} username={r.username} />
                    <span className="font-poppins text-[rgb(var(--fg-rgb))] flex items-center gap-1.5 flex-1" style={{ fontSize: "16px" }}>
                      {r.username}
                      <FounderMark founderNumber={r.founder_number} />
                    </span>
                    <button
                      type="button"
                      disabled={already || requested || busy === r.id}
                      onClick={() => request(r)}
                      className="st-btn px-3 py-1.5 font-poppins shrink-0 disabled:opacity-50"
                      style={{
                        fontSize: "13px",
                        fontWeight: 600,
                        background: already || requested ? "transparent" : "var(--accent)",
                        color: already || requested ? "rgba(var(--fg-rgb),0.4)" : "#fff",
                        border: already || requested ? "0.5px solid rgba(var(--fg-rgb),0.15)" : "none",
                      }}
                    >
                      {already ? "Partner" : requested ? "Requested" : "Add"}
                    </button>
                  </div>
                );
              })
            )}
          </div>
        )}
      </div>

      {/* Incoming requests */}
      {requests.length > 0 && (
        <section className="flex flex-col gap-3">
          <h2 className="font-poppins font-black uppercase text-[rgb(var(--fg-rgb))]" style={{ fontSize: "15px", letterSpacing: "0.2em" }}>
            Requests
          </h2>
          {requests.map((r) => (
            <div key={r.partnership_id} className="flex items-center gap-3">
              <Avatar url={r.from.avatar_url} username={r.from.username} />
              <span className="font-poppins text-[rgb(var(--fg-rgb))] flex items-center gap-1.5 flex-1 truncate" style={{ fontSize: "16px" }}>
                {r.from.username}
                <FounderMark founderNumber={r.from.founder_number} />
              </span>
              <button
                type="button"
                disabled={busy === r.partnership_id}
                onClick={() => accept(r)}
                className="st-btn px-3 py-1.5 font-poppins shrink-0 disabled:opacity-50"
                style={{ fontSize: "13px", fontWeight: 600, background: "var(--accent)", color: "#fff" }}
              >
                Accept
              </button>
              <button
                type="button"
                disabled={busy === r.partnership_id}
                onClick={() => decline(r)}
                className="st-pill px-2 py-1.5 font-poppins shrink-0 disabled:opacity-50"
                style={{ fontSize: "13px", color: "rgba(var(--fg-rgb),0.45)" }}
              >
                Decline
              </button>
            </div>
          ))}
        </section>
      )}

      {/* Accepted partners + their daily plans */}
      <section className="flex flex-col gap-4">
        <h2 className="font-poppins font-black uppercase text-[rgb(var(--fg-rgb))]" style={{ fontSize: "15px", letterSpacing: "0.2em" }}>
          Partners
        </h2>
        {partners.length === 0 ? (
          <p className="font-playfair italic text-[rgba(var(--fg-rgb),0.3)]" style={{ fontSize: "17px" }}>
            No partners yet. Search a username above to send your first request.
          </p>
        ) : (
          partners.map((s) => {
            const plan = progress[s.partner.id] ?? [];
            const done = plan.filter((t) => t.done).length;
            return (
              <div key={s.partnership_id} className="flex flex-col gap-2 border-b border-[rgba(var(--fg-rgb),0.06)] pb-4 last:border-0">
                <div className="flex items-center gap-3">
                  <Avatar url={s.partner.avatar_url} username={s.partner.username} />
                  <div className="flex-1 min-w-0">
                    <span className="font-poppins font-medium text-[rgb(var(--fg-rgb))] flex items-center gap-1.5" style={{ fontSize: "16px" }}>
                      {s.partner.username}
                      <FounderMark founderNumber={s.partner.founder_number} />
                    </span>
                    <span className="font-poppins font-light text-[rgba(var(--fg-rgb),0.4)]" style={{ fontSize: "13px" }}>
                      {plan.length === 0
                        ? "No plan yet today"
                        : done === plan.length
                          ? `All ${plan.length} done today 🎉`
                          : `${done}/${plan.length} done today`}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => message(s.partner)}
                    aria-label={`Message ${s.partner.username}`}
                    className="st-pill flex items-center justify-center shrink-0"
                    style={{ width: "38px", height: "38px", color: "rgba(var(--fg-rgb),0.6)" }}
                  >
                    <MessageCircle size={18} strokeWidth={1.75} />
                  </button>
                  <button
                    type="button"
                    onClick={() => unpartner(s)}
                    aria-label={`Remove ${s.partner.username}`}
                    className="st-pill flex items-center justify-center shrink-0"
                    style={{ width: "38px", height: "38px", color: "rgba(var(--fg-rgb),0.3)" }}
                  >
                    <UserMinus size={17} strokeWidth={1.75} />
                  </button>
                </div>
                {plan.length > 0 && (
                  <div className="flex flex-col gap-1 pl-[60px]">
                    {plan.map((t) => (
                      <span key={t.id} className="flex items-center gap-2 font-poppins" style={{ fontSize: "14px" }}>
                        {t.done ? (
                          <Check size={14} strokeWidth={2.5} color="var(--accent-2)" />
                        ) : (
                          <Circle size={13} strokeWidth={1.75} color="rgba(var(--fg-rgb),0.3)" />
                        )}
                        <span
                          style={{
                            color: t.done ? "rgba(var(--fg-rgb),0.4)" : "rgb(var(--fg-rgb))",
                            textDecoration: t.done ? "line-through" : "none",
                          }}
                        >
                          {t.title}
                        </span>
                      </span>
                    ))}
                  </div>
                )}
              </div>
            );
          })
        )}
      </section>
    </div>
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
