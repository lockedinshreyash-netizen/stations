import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createLessonUpload } from "@/lib/mux/server";

/**
 * Admin-only. Creates a Mux direct upload for a lesson and stamps the lesson
 * with the upload id (status → 'processing'). The admin builder then uploads
 * the file straight to Mux via the returned URL (UpChunk); the asset becomes
 * playable when the `video.asset.ready` webhook lands.
 */
export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  }

  const { data: me } = await supabase
    .from("users")
    .select("is_admin")
    .eq("id", user.id)
    .maybeSingle();
  if (!me?.is_admin) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
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

  const admin = createAdminClient();
  const { data: lesson } = await admin
    .from("archive_lessons")
    .select("id")
    .eq("id", lessonId)
    .maybeSingle();
  if (!lesson) {
    return NextResponse.json({ error: "lesson not found" }, { status: 404 });
  }

  try {
    const { uploadId, uploadUrl } = await createLessonUpload(lessonId);
    await admin
      .from("archive_lessons")
      .update({ mux_upload_id: uploadId, status: "processing" })
      .eq("id", lessonId);
    return NextResponse.json({ uploadUrl, uploadId });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "upload failed" },
      { status: 500 }
    );
  }
}
