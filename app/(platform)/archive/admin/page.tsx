import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import ArchiveAdmin, { type AdminCourse } from "@/components/stations/ArchiveAdmin";
import type { ArchiveCourse, User } from "@/types";

export default async function ArchiveAdminPage() {
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
  if (!(profile as User).is_admin) redirect("/archive");

  const { data: rows } = await supabase
    .from("archive_courses")
    .select("*, lessons:archive_lessons(count)")
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: false });

  type Row = ArchiveCourse & { lessons: { count: number }[] | null };
  const courses: AdminCourse[] = ((rows as Row[]) ?? []).map(
    ({ lessons, ...c }) => ({
      ...(c as ArchiveCourse),
      lesson_count: lessons?.[0]?.count ?? 0,
    })
  );

  return <ArchiveAdmin initialCourses={courses} />;
}
