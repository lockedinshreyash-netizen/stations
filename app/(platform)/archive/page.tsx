import { redirect } from "next/navigation";
import StationHeader from "@/components/layout/StationHeader";
import ArchiveCatalog from "@/components/stations/ArchiveCatalog";
import { createClient } from "@/lib/supabase/server";
import type { ArchiveCourse, ArchiveCourseWithMeta, User } from "@/types";

export default async function ArchivePage() {
  const supabase = await createClient();
  const {
    data: { user: authUser },
  } = await supabase.auth.getUser();
  if (!authUser) redirect("/login");

  const { data: profile } = await supabase
    .from("users")
    .select("*")
    .eq("id", authUser.id)
    .single();
  if (!profile) redirect("/onboarding/step-2");

  const user = profile as User;
  const isMember =
    user.membership_tier === "paid" || user.membership_tier === "founding";

  // Published catalog (RLS lets free users read published rows too).
  const { data: courseRows } = await supabase
    .from("archive_courses")
    .select("*")
    .eq("status", "published")
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: false });
  const courses = (courseRows as ArchiveCourse[]) ?? [];

  // Lessons (lightweight) for counts + runtime.
  const courseIds = courses.map((c) => c.id);
  const { data: lessonRows } = courseIds.length
    ? await supabase
        .from("archive_lessons")
        .select("id, course_id, duration_seconds")
        .in("course_id", courseIds)
    : { data: [] };
  const lessons =
    (lessonRows as {
      id: string;
      course_id: string;
      duration_seconds: number | null;
    }[]) ?? [];

  // Caller's completed lessons (members only).
  const lessonIds = lessons.map((l) => l.id);
  const { data: progressRows } =
    isMember && lessonIds.length
      ? await supabase
          .from("archive_lesson_progress")
          .select("lesson_id, completed")
          .eq("user_id", authUser.id)
          .in("lesson_id", lessonIds)
      : { data: [] };
  const completedSet = new Set(
    ((progressRows as { lesson_id: string; completed: boolean }[]) ?? [])
      .filter((p) => p.completed)
      .map((p) => p.lesson_id)
  );

  const lessonsByCourse = new Map<
    string,
    { id: string; duration_seconds: number | null }[]
  >();
  for (const l of lessons) {
    const arr = lessonsByCourse.get(l.course_id) ?? [];
    arr.push(l);
    lessonsByCourse.set(l.course_id, arr);
  }

  const catalog: ArchiveCourseWithMeta[] = courses.map((c) => {
    const cl = lessonsByCourse.get(c.id) ?? [];
    const lesson_count = cl.length;
    const total_duration_seconds = cl.reduce(
      (s, l) => s + (l.duration_seconds ?? 0),
      0
    );
    const completed_lessons = cl.filter((l) => completedSet.has(l.id)).length;
    const progress_percent =
      lesson_count > 0
        ? Math.round((completed_lessons / lesson_count) * 100)
        : 0;
    return {
      ...c,
      lesson_count,
      total_duration_seconds,
      completed_lessons,
      progress_percent,
    };
  });

  return (
    <div>
      <StationHeader
        number="03"
        name="ARCHIVE"
        tagline="Courses from people who've done it. Watch, learn, build."
      />
      <ArchiveCatalog user={user} courses={catalog} />
    </div>
  );
}
