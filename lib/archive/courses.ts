"use client";

import { createClient } from "@/lib/supabase/client";
import type { ArchiveCourse, ArchiveLesson, CourseStatus } from "@/types";

/* ------------------------------------------------------------------ */
/* Reads (client — used by the admin builder to refetch after upload)  */
/* ------------------------------------------------------------------ */

/** Ordered lessons for a course. Admins see every lesson regardless of state. */
export async function getCourseLessons(
  courseId: string
): Promise<ArchiveLesson[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("archive_lessons")
    .select("*")
    .eq("course_id", courseId)
    .order("order_index", { ascending: true });
  if (error) throw new Error(error.message);
  return (data as ArchiveLesson[]) ?? [];
}

/** A single lesson row — used to poll processing status after an upload. */
export async function getLesson(lessonId: string): Promise<ArchiveLesson | null> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("archive_lessons")
    .select("*")
    .eq("id", lessonId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return (data as ArchiveLesson) ?? null;
}

/* ------------------------------------------------------------------ */
/* Course CRUD (admin)                                                 */
/* ------------------------------------------------------------------ */

export interface CourseInput {
  title: string;
  subtitle?: string | null;
  description?: string | null;
  instructor_name?: string;
  instructor_title?: string | null;
  instructor_avatar_url?: string | null;
  thumbnail_url?: string | null;
  topic?: string | null;
  sort_order?: number;
}

/** Creates a draft course owned by the current admin. */
export async function createCourse(input: CourseInput): Promise<ArchiveCourse> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Session expired.");

  const { data, error } = await supabase
    .from("archive_courses")
    .insert({
      title: input.title.trim().slice(0, 120),
      subtitle: input.subtitle ?? null,
      description: input.description ?? null,
      instructor_name: input.instructor_name?.trim() ?? "",
      instructor_title: input.instructor_title ?? null,
      instructor_avatar_url: input.instructor_avatar_url ?? null,
      thumbnail_url: input.thumbnail_url ?? null,
      topic: input.topic ?? null,
      sort_order: input.sort_order ?? 0,
      status: "draft" as CourseStatus,
      created_by: user.id,
    })
    .select("*")
    .single();
  if (error) throw new Error(error.message);
  return data as ArchiveCourse;
}

/** Patches a course's metadata. Always bumps updated_at. */
export async function updateCourse(
  courseId: string,
  patch: Partial<CourseInput>
): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase
    .from("archive_courses")
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq("id", courseId);
  if (error) throw new Error(error.message);
}

/** Flips publish state (draft ↔ published, or archived). */
export async function setCourseStatus(
  courseId: string,
  status: CourseStatus
): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase
    .from("archive_courses")
    .update({ status, updated_at: new Date().toISOString() })
    .eq("id", courseId);
  if (error) throw new Error(error.message);
}

export async function deleteCourse(courseId: string): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase
    .from("archive_courses")
    .delete()
    .eq("id", courseId);
  if (error) throw new Error(error.message);
}

/* ------------------------------------------------------------------ */
/* Lesson CRUD (admin)                                                 */
/* ------------------------------------------------------------------ */

/** Adds a lesson at the end of a course (status 'awaiting_upload'). */
export async function createLesson(
  courseId: string,
  title: string,
  description: string | null,
  orderIndex: number
): Promise<ArchiveLesson> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("archive_lessons")
    .insert({
      course_id: courseId,
      title: title.trim().slice(0, 140),
      description: description?.trim() || null,
      order_index: orderIndex,
      status: "awaiting_upload",
    })
    .select("*")
    .single();
  if (error) throw new Error(error.message);
  return data as ArchiveLesson;
}

export async function updateLesson(
  lessonId: string,
  patch: { title?: string; description?: string | null }
): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase
    .from("archive_lessons")
    .update(patch)
    .eq("id", lessonId);
  if (error) throw new Error(error.message);
}

export async function deleteLesson(lessonId: string): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase
    .from("archive_lessons")
    .delete()
    .eq("id", lessonId);
  if (error) throw new Error(error.message);
}

/** Persists a new lesson ordering. `orderedIds` is the desired top-to-bottom order. */
export async function reorderLessons(orderedIds: string[]): Promise<void> {
  const supabase = createClient();
  await Promise.all(
    orderedIds.map((id, index) =>
      supabase.from("archive_lessons").update({ order_index: index }).eq("id", id)
    )
  );
}

/**
 * Requests a Mux direct upload for a lesson (server creates it + stamps the
 * lesson). Returns the URL the client streams the file to via UpChunk.
 */
export async function requestLessonUpload(
  lessonId: string
): Promise<{ uploadUrl: string; uploadId: string }> {
  const res = await fetch("/api/mux/upload", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ lessonId }),
  });
  if (!res.ok) {
    const { error } = await res.json().catch(() => ({ error: "upload failed" }));
    throw new Error(error ?? "upload failed");
  }
  return res.json();
}
