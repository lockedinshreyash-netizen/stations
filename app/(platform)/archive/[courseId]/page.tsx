import { notFound, redirect } from "next/navigation";
import CourseDetail, { type LessonView } from "@/components/stations/CourseDetail";
import { createClient } from "@/lib/supabase/server";
import type { ArchiveCourse, User } from "@/types";

export default async function CoursePage({
  params,
}: {
  params: Promise<{ courseId: string }>;
}) {
  const { courseId } = await params;

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
  if (!profile) redirect("/onboarding/complete");
  const user = profile as User;

  // RLS: non-admins can only read published courses, so a draft resolves to
  // null here → notFound.
  const { data: courseRow } = await supabase
    .from("archive_courses")
    .select("*")
    .eq("id", courseId)
    .maybeSingle();
  if (!courseRow) notFound();
  const course = courseRow as ArchiveCourse;

  const { data: lessonRows } = await supabase
    .from("archive_lessons")
    .select("id, title, description, order_index, duration_seconds, status")
    .eq("course_id", courseId)
    .order("order_index", { ascending: true });
  const lessons = (lessonRows as LessonView[]) ?? [];

  const isMember =
    user.membership_tier === "paid" || user.membership_tier === "founding";

  const lessonIds = lessons.map((l) => l.id);
  const { data: progressRows } =
    isMember && lessonIds.length
      ? await supabase
          .from("archive_lesson_progress")
          .select("lesson_id, completed, last_position_seconds")
          .eq("user_id", authUser.id)
          .in("lesson_id", lessonIds)
      : { data: [] };

  const initialProgress =
    (progressRows as {
      lesson_id: string;
      completed: boolean;
      last_position_seconds: number;
    }[]) ?? [];

  return (
    <CourseDetail
      user={user}
      course={course}
      lessons={lessons}
      initialProgress={initialProgress}
    />
  );
}
