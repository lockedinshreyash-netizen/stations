import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  notifyDm,
  notifyReaction,
  notifySessionStart,
  notifyMention,
  notifyPartnerRequest,
  notifyPartnerAccepted,
  notifyDailyComplete,
  notifyTest,
} from "@/lib/push/events";

/**
 * Session-authenticated push entry point. The client calls this AFTER a write
 * has already committed (a DM was sent, a reaction added, a session started).
 * It is deliberately NOT in any database transaction, so a push failure can
 * never undo the user's action — that was the bug in the old trigger design.
 *
 * Each kind authorizes the caller before fanning out so a member can't spoof a
 * notification they have no part in.
 */
export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  }

  let body: { kind?: string; [k: string]: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid body" }, { status: 400 });
  }

  const admin = createAdminClient();

  try {
    switch (body.kind) {
      case "dm": {
        const conversationId = String(body.conversationId ?? "");
        if (!conversationId) return bad("missing conversationId");
        // Authorize: caller must be a participant of the conversation.
        const { data: convo } = await admin
          .from("conversations")
          .select("user_low, user_high")
          .eq("id", conversationId)
          .maybeSingle();
        if (
          !convo ||
          (convo.user_low !== user.id && convo.user_high !== user.id)
        ) {
          return NextResponse.json({ error: "forbidden" }, { status: 403 });
        }
        await notifyDm(conversationId, user.id);
        break;
      }

      case "reaction": {
        const winId = String(body.winId ?? "");
        if (!winId) return bad("missing winId");
        // notifyReaction confirms the caller actually has a reaction row.
        await notifyReaction(winId, user.id);
        break;
      }

      case "session_start": {
        const sessionId = String(body.sessionId ?? "");
        if (!sessionId) return bad("missing sessionId");
        // Authorize: only the host may broadcast a session start.
        const { data: session } = await admin
          .from("work_sessions")
          .select("host_id")
          .eq("id", sessionId)
          .maybeSingle();
        if (!session || session.host_id !== user.id) {
          return NextResponse.json({ error: "forbidden" }, { status: 403 });
        }
        await notifySessionStart(sessionId);
        break;
      }

      case "mention": {
        const room = String(body.room ?? "").toLowerCase();
        const usernames = Array.isArray(body.usernames)
          ? (body.usernames as unknown[]).map(String)
          : [];
        if (!/^[a-z]+$/.test(room)) return bad("invalid room");
        await notifyMention(room, usernames, user.id);
        break;
      }

      case "partner_request": {
        const addresseeId = String(body.addresseeId ?? "");
        if (!addresseeId) return bad("missing addresseeId");
        // Authorize: a pending request from the caller to this addressee exists.
        const { data: pr } = await admin
          .from("partnerships")
          .select("id")
          .eq("requester_id", user.id)
          .eq("addressee_id", addresseeId)
          .eq("status", "pending")
          .maybeSingle();
        if (!pr) {
          return NextResponse.json({ error: "forbidden" }, { status: 403 });
        }
        await notifyPartnerRequest(addresseeId, user.id);
        break;
      }

      case "partner_accepted": {
        const requesterId = String(body.requesterId ?? "");
        if (!requesterId) return bad("missing requesterId");
        // Authorize: the caller is the addressee who accepted this requester.
        const { data: pa } = await admin
          .from("partnerships")
          .select("id")
          .eq("requester_id", requesterId)
          .eq("addressee_id", user.id)
          .eq("status", "accepted")
          .maybeSingle();
        if (!pa) {
          return NextResponse.json({ error: "forbidden" }, { status: 403 });
        }
        await notifyPartnerAccepted(requesterId, user.id);
        break;
      }

      case "daily_complete": {
        // The caller can only announce their OWN completion; the resolver
        // re-verifies every task is done and dedupes to once per day.
        await notifyDailyComplete(user.id);
        break;
      }

      case "test": {
        await notifyTest(user.id);
        break;
      }

      default:
        return bad("unknown kind");
    }
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "send failed" },
      { status: 500 }
    );
  }

  return NextResponse.json({ ok: true });
}

function bad(message: string) {
  return NextResponse.json({ error: message }, { status: 400 });
}
