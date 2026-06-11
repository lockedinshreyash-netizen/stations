import Mux from "@mux/mux-node";

/**
 * Mux helper — SERVER ONLY. Never import this into client code: it carries the
 * Mux API secret and the playback signing key. Used by the /api/mux/* route
 * handlers to (1) create admin direct uploads, (2) verify webhooks, and
 * (3) mint short-lived signed playback tokens — the actual paywall, since
 * every course asset uses the `signed` playback policy and therefore cannot be
 * played without a token we only issue to paid/founding members.
 */

let client: Mux | null = null;

function getMux(): Mux {
  if (!client) {
    client = new Mux({
      tokenId: process.env.MUX_TOKEN_ID!,
      tokenSecret: process.env.MUX_TOKEN_SECRET!,
    });
  }
  return client;
}

/**
 * Creates a Mux direct upload for a lesson. The resulting asset uses the
 * `signed` playback policy and carries the lesson id as `passthrough`, so the
 * `video.asset.ready` webhook can map the finished asset back to its lesson.
 */
export async function createLessonUpload(
  lessonId: string
): Promise<{ uploadId: string; uploadUrl: string }> {
  const upload = await getMux().video.uploads.create({
    cors_origin: "*",
    new_asset_settings: {
      playback_policy: ["signed"],
      passthrough: lessonId,
      mp4_support: "none",
    },
  });
  if (!upload.url) throw new Error("Mux did not return an upload URL.");
  return { uploadId: upload.id, uploadUrl: upload.url };
}

/**
 * Signs a short-lived playback JWT for a course video. This is minted only
 * after the caller's paid/founding tier is verified in the route handler.
 */
export async function signLessonPlayback(playbackId: string): Promise<string> {
  return getMux().jwt.signPlaybackId(playbackId, {
    type: "video",
    keyId: process.env.MUX_SIGNING_KEY_ID!,
    keySecret: process.env.MUX_SIGNING_KEY_PRIVATE!,
    expiration: "2h",
  });
}

/**
 * Verifies + parses a Mux webhook payload. Throws if the signature is invalid.
 * `rawBody` must be the unparsed request text.
 */
export async function unwrapWebhook(
  rawBody: string,
  headers: Record<string, string>
) {
  return getMux().webhooks.unwrap(
    rawBody,
    headers,
    process.env.MUX_WEBHOOK_SECRET!
  );
}
