"use client";

import { createClient } from "@/lib/supabase/client";

/** Thrown by getPlaybackToken when the caller isn't a paid/founding member. */
export class UpgradeRequiredError extends Error {
  constructor() {
    super("upgrade_required");
    this.name = "UpgradeRequiredError";
  }
}

/**
 * Records the caller's progress on a lesson. Upsert keyed on (user, lesson):
 * pass the latest `completed` + resume position. RLS guarantees a member can
 * only write their own row (and only paid/founding members can write at all).
 */
export async function upsertLessonProgress(
  lessonId: string,
  completed: boolean,
  lastPositionSeconds: number
): Promise<void> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  const { error } = await supabase.from("archive_lesson_progress").upsert(
    {
      user_id: user.id,
      lesson_id: lessonId,
      completed,
      last_position_seconds: Math.max(0, Math.round(lastPositionSeconds)),
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id,lesson_id" }
  );
  if (error) throw new Error(error.message);
}

/**
 * Fetches a signed Mux playback token for a lesson — the paywalled call.
 * Throws UpgradeRequiredError on 403 so the UI can show the upsell.
 */
export async function getPlaybackToken(
  lessonId: string
): Promise<{ token: string; playbackId: string }> {
  const res = await fetch("/api/mux/playback-token", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ lessonId }),
  });
  if (res.status === 403) throw new UpgradeRequiredError();
  if (!res.ok) {
    const { error } = await res
      .json()
      .catch(() => ({ error: "playback failed" }));
    throw new Error(error ?? "playback failed");
  }
  return res.json();
}
