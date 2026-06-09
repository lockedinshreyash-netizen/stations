"use client";

import { createClient } from "@/lib/supabase/client";
import type {
  DmParticipant,
  Partnership,
  PartnerRequest,
  PartnerSummary,
} from "@/types";

/** Profiles for a set of user ids, as a lookup map (one query). */
async function profilesById(
  ids: string[]
): Promise<Map<string, DmParticipant>> {
  if (ids.length === 0) return new Map();
  const supabase = createClient();
  const { data } = await supabase
    .from("users")
    .select("id, username, avatar_url, founder_number")
    .in("id", [...new Set(ids)]);
  return new Map(((data as DmParticipant[]) ?? []).map((p) => [p.id, p]));
}

/**
 * Send a partner request to another member. RLS guarantees it's created as a
 * pending request from the caller. Throws a friendly error if a partnership (in
 * either direction, any status) already exists for the pair.
 */
export async function sendPartnerRequest(
  selfId: string,
  addresseeId: string
): Promise<Partnership> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("partnerships")
    .insert({ requester_id: selfId, addressee_id: addresseeId, status: "pending" })
    .select("*")
    .single();
  if (error) {
    if (error.code === "23505") {
      throw new Error("You're already partners or have a pending request.");
    }
    throw new Error(error.message);
  }
  return data as Partnership;
}

/** The caller's accepted accountability partners, with their profiles. */
export async function listPartners(selfId: string): Promise<PartnerSummary[]> {
  const supabase = createClient();
  // RLS limits this to partnerships the caller is part of.
  const { data, error } = await supabase
    .from("partnerships")
    .select("id, requester_id, addressee_id")
    .eq("status", "accepted");
  if (error) throw new Error(error.message);

  const rows =
    (data as { id: string; requester_id: string; addressee_id: string }[]) ?? [];
  const byId = await profilesById(
    rows.map((r) => (r.requester_id === selfId ? r.addressee_id : r.requester_id))
  );

  return rows.map((r) => {
    const otherId = r.requester_id === selfId ? r.addressee_id : r.requester_id;
    return {
      partnership_id: r.id,
      partner:
        byId.get(otherId) ??
        { id: otherId, username: "member", avatar_url: null, founder_number: null },
    } satisfies PartnerSummary;
  });
}

/** Pending requests addressed TO the caller, with the requester's profile. */
export async function listIncomingRequests(
  selfId: string
): Promise<PartnerRequest[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("partnerships")
    .select("id, requester_id, created_at")
    .eq("status", "pending")
    .eq("addressee_id", selfId)
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);

  const rows =
    (data as { id: string; requester_id: string; created_at: string }[]) ?? [];
  const byId = await profilesById(rows.map((r) => r.requester_id));

  return rows.map((r) => ({
    partnership_id: r.id,
    from:
      byId.get(r.requester_id) ??
      { id: r.requester_id, username: "member", avatar_url: null, founder_number: null },
    created_at: r.created_at,
  }));
}

/** User ids the caller has an outstanding (pending) outgoing request to. */
export async function listOutgoingRequestIds(
  selfId: string
): Promise<Set<string>> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("partnerships")
    .select("addressee_id")
    .eq("status", "pending")
    .eq("requester_id", selfId);
  if (error) throw new Error(error.message);
  return new Set(((data as { addressee_id: string }[]) ?? []).map((r) => r.addressee_id));
}

/** Accept or decline an incoming request. RLS allows only the addressee. */
export async function respondToRequest(
  partnershipId: string,
  accept: boolean
): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase
    .from("partnerships")
    .update({
      status: accept ? "accepted" : "declined",
      responded_at: new Date().toISOString(),
    })
    .eq("id", partnershipId);
  if (error) throw new Error(error.message);
}

/** Remove a partnership (cancel a request, or un-partner). */
export async function removePartner(partnershipId: string): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase
    .from("partnerships")
    .delete()
    .eq("id", partnershipId);
  if (error) throw new Error(error.message);
}
