import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { signLessonPlayback } from "@/lib/mux/server";

/**
 * THE PAYWALL. Mints a short-lived signed Mux playback token for one lesson —
 * but only for paid/founding members, and only for a 'ready' lesson inside a
 * published course. Because every course asset uses the `signed` playback
 * policy, no token = no video, so this check is the real access gate (RLS on
 * the catalog tables is only about metadata visibility).
 */
export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  }

  let body: { lessonId?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid body" }, { status: 400 });
  }
  const lessonId = String(body.lessonId ?? "");
  if (!lessonId) {
    return NextResponse.json({ error: "missing lessonId" }, { status: 400 });
  }

  const { data: me } = await supabase
    .from("users")
    .select("membership_tier")
    .eq("id", user.id)
    .maybeSingle();
  if (
    !me ||
    (me.membership_tier !== "paid" && me.membership_tier !== "founding")
  ) {
    return NextResponse.json({ error: "upgrade_required" }, { status: 403 });
  }

  // Verify the lesson is playable and lives in a published course.
  const admin = createAdminClient();
  const { data: lesson } = await admin
    .from("archive_lessons")
    .select("mux_playback_id, status, course_id")
    .eq("id", lessonId)
    .maybeSingle();
  if (!lesson || !lesson.mux_playback_id || lesson.status !== "ready") {
    return NextResponse.json({ error: "not available" }, { status: 404 });
  }
  const { data: course } = await admin
    .from("archive_courses")
    .select("status")
    .eq("id", lesson.course_id)
    .maybeSingle();
  if (course?.status !== "published") {
    return NextResponse.json({ error: "not available" }, { status: 404 });
  }

  try {
    const token = await signLessonPlayback(lesson.mux_playback_id);
    return NextResponse.json({ token, playbackId: lesson.mux_playback_id });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "token failed" },
      { status: 500 }
    );
  }
}
