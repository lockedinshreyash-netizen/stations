import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { unwrapWebhook } from "@/lib/mux/server";

/**
 * Mux webhook receiver. Signature-verified (no user session — this is a
 * server-to-server call). On `video.asset.ready` it fills the lesson's
 * playback id + duration and flips it to 'ready'; on `video.asset.errored`
 * it marks the lesson 'errored'. Writes use the service-role client.
 *
 * Assets carry the lesson id as `passthrough`; we fall back to matching on
 * `upload_id` in case passthrough is ever absent.
 */
export async function POST(request: Request) {
  const raw = await request.text();
  const headers = Object.fromEntries(request.headers);

  let event;
  try {
    event = await unwrapWebhook(raw, headers);
  } catch {
    return NextResponse.json({ error: "invalid signature" }, { status: 403 });
  }

  const admin = createAdminClient();

  try {
    if (event.type === "video.asset.ready") {
      const asset = event.data;
      const playbackId =
        asset.playback_ids?.find((p) => p.policy === "signed")?.id ??
        asset.playback_ids?.[0]?.id ??
        null;
      const duration =
        typeof asset.duration === "number" ? Math.round(asset.duration) : null;
      const patch = {
        mux_asset_id: asset.id,
        mux_playback_id: playbackId,
        duration_seconds: duration,
        status: "ready" as const,
      };

      if (asset.passthrough) {
        await admin
          .from("archive_lessons")
          .update(patch)
          .eq("id", asset.passthrough);
      } else if (asset.upload_id) {
        await admin
          .from("archive_lessons")
          .update(patch)
          .eq("mux_upload_id", asset.upload_id);
      }
    } else if (event.type === "video.asset.errored") {
      const asset = event.data;
      if (asset.passthrough) {
        await admin
          .from("archive_lessons")
          .update({ status: "errored" })
          .eq("id", asset.passthrough);
      } else if (asset.upload_id) {
        await admin
          .from("archive_lessons")
          .update({ status: "errored" })
          .eq("mux_upload_id", asset.upload_id);
      }
    }
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "handler failed" },
      { status: 500 }
    );
  }

  return NextResponse.json({ ok: true });
}
