import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import CourseBuilder from "@/components/stations/CourseBuilder";
import type { ArchiveCourse, ArchiveLesson, User } from "@/types";

export default async function ArchiveAdminCoursePage({
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
  if (!profile) redirect("/onboarding/step-2");
  if (!(profile as User).is_admin) redirect("/archive");

  const { data: courseRow } = await supabase
    .from("archive_courses")
    .select("*")
    .eq("id", courseId)
    .maybeSingle();
  if (!courseRow) notFound();

  const { data: lessonRows } = await supabase
    .from("archive_lessons")
    .select("*")
    .eq("course_id", courseId)
    .order("order_index", { ascending: true });

  return (
    <CourseBuilder
      course={courseRow as ArchiveCourse}
      initialLessons={(lessonRows as ArchiveLesson[]) ?? []}
    />
  );
}
