"use client";

import { useState, useRef } from "react";
import Link from "next/link";
import MuxPlayer from "@mux/mux-player-react";
import type { MuxPlayerRefAttributes } from "@mux/mux-player-react";
import { ChevronLeft, Play, Check, Lock, Loader2 } from "lucide-react";
import type { ArchiveCourse, LessonStatus, User } from "@/types";
import { formatRuntime, formatLessonCount } from "@/lib/archive/format";
import {
  getPlaybackToken,
  upsertLessonProgress,
  UpgradeRequiredError,
} from "@/lib/archive/progress";
import UpgradeUpsell from "./UpgradeUpsell";

/** The lesson fields the detail view needs (no Mux internals reach the client). */
export interface LessonView {
  id: string;
  title: string;
  description: string | null;
  order_index: number;
  duration_seconds: number | null;
  status: LessonStatus;
}

interface ProgressEntry {
  completed: boolean;
  last_position_seconds: number;
}

type Playing = {
  lessonId: string;
  token: string;
  playbackId: string;
  startAt: number;
};

const BRAND_RED = "#c0392b"; // MuxPlayer accent needs a literal color value.

export default function CourseDetail({
  user,
  course,
  lessons,
  initialProgress,
}: {
  user: User;
  course: ArchiveCourse;
  lessons: LessonView[];
  initialProgress: {
    lesson_id: string;
    completed: boolean;
    last_position_seconds: number;
  }[];
}) {
  const isMember =
    user.membership_tier === "paid" || user.membership_tier === "founding";

  const [progress, setProgress] = useState<Record<string, ProgressEntry>>(() => {
    const map: Record<string, ProgressEntry> = {};
    for (const p of initialProgress) {
      map[p.lesson_id] = {
        completed: p.completed,
        last_position_seconds: p.last_position_seconds,
      };
    }
    return map;
  });
  const [playing, setPlaying] = useState<Playing | null>(null);
  const [loadingLessonId, setLoadingLessonId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showUpsell, setShowUpsell] = useState(false);

  const playerRef = useRef<MuxPlayerRefAttributes | null>(null);

  const readyLessons = lessons.filter((l) => l.status === "ready");
  const resumeLesson =
    readyLessons.find((l) => !progress[l.id]?.completed) ?? readyLessons[0] ?? null;
  const hasProgress = lessons.some(
    (l) => progress[l.id]?.completed || progress[l.id]?.last_position_seconds
  );

  const completedCount = lessons.filter((l) => progress[l.id]?.completed).length;
  const coursePercent =
    lessons.length > 0 ? Math.round((completedCount / lessons.length) * 100) : 0;

  async function playLesson(lesson: LessonView) {
    if (!isMember) {
      setShowUpsell(true);
      return;
    }
    if (lesson.status !== "ready") return;

    setError(null);
    setLoadingLessonId(lesson.id);
    try {
      const { token, playbackId } = await getPlaybackToken(lesson.id);
      const entry = progress[lesson.id];
      const startAt = entry?.completed ? 0 : entry?.last_position_seconds ?? 0;
      setPlaying({ lessonId: lesson.id, token, playbackId, startAt });
    } catch (e) {
      if (e instanceof UpgradeRequiredError) setShowUpsell(true);
      else setError(e instanceof Error ? e.message : "Could not load this video.");
    } finally {
      setLoadingLessonId(null);
    }
  }

  function saveProgress(completed: boolean) {
    if (!playing) return;
    const pos = playerRef.current?.currentTime ?? playing.startAt;
    const lessonId = playing.lessonId;
    void upsertLessonProgress(lessonId, completed, pos).catch(() => {});
    setProgress((prev) => ({
      ...prev,
      [lessonId]: { completed, last_position_seconds: Math.round(pos) },
    }));
  }

  const playingTitle = playing
    ? lessons.find((l) => l.id === playing.lessonId)?.title ?? course.title
    : course.title;

  return (
    <div className="px-5 md:px-10 py-8 max-w-5xl mx-auto flex flex-col" style={{ gap: "28px" }}>
      {/* Back */}
      <Link
        href="/archive"
        className="inline-flex items-center gap-1.5 font-poppins uppercase w-fit"
        style={{
          fontSize: "12px",
          letterSpacing: "0.14em",
          color: "rgba(var(--fg-rgb),0.45)",
        }}
      >
        <ChevronLeft size={15} strokeWidth={2} />
        Archive
      </Link>

      {/* Course header */}
      <header className="flex flex-col" style={{ gap: "10px" }}>
        {course.topic && (
          <span
            className="font-poppins font-bold uppercase"
            style={{
              fontSize: "12px",
              letterSpacing: "0.18em",
              color: "rgba(var(--accent-2-rgb),0.7)",
            }}
          >
            {course.topic}
          </span>
        )}
        <h1
          className="font-poppins font-black uppercase"
          style={{
            fontSize: "clamp(30px, 5vw, 46px)",
            lineHeight: 0.98,
            letterSpacing: "-0.02em",
            color: "rgb(var(--fg-rgb))",
          }}
        >
          {course.title}
        </h1>
        {course.subtitle && (
          <p
            className="font-playfair italic"
            style={{ fontSize: "19px", color: "rgba(var(--fg-rgb),0.5)" }}
          >
            {course.subtitle}
          </p>
        )}

        {/* Instructor + stats */}
        <div className="flex items-center flex-wrap gap-3 mt-2">
          {course.instructor_avatar_url && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={course.instructor_avatar_url}
              alt=""
              className="object-cover"
              style={{
                width: "34px",
                height: "34px",
                borderRadius: "9999px",
                border: "0.5px solid rgba(var(--fg-rgb),0.2)",
              }}
            />
          )}
          {course.instructor_name && (
            <span
              className="font-poppins"
              style={{ fontSize: "15px", color: "rgba(var(--fg-rgb),0.75)" }}
            >
              {course.instructor_name}
              {course.instructor_title && (
                <span style={{ color: "rgba(var(--fg-rgb),0.4)" }}>
                  {" · "}
                  {course.instructor_title}
                </span>
              )}
            </span>
          )}
          <span
            className="font-poppins"
            style={{ fontSize: "13px", color: "rgba(var(--fg-rgb),0.4)" }}
          >
            {formatLessonCount(lessons.length)} ·{" "}
            {formatRuntime(
              lessons.reduce((s, l) => s + (l.duration_seconds ?? 0), 0)
            )}
          </span>
        </div>

        {/* Course progress (members) */}
        {isMember && coursePercent > 0 && (
          <div className="flex items-center gap-3 mt-1">
            <span
              className="relative overflow-hidden"
              style={{
                height: "4px",
                width: "160px",
                borderRadius: "9999px",
                background: "rgba(var(--fg-rgb),0.12)",
              }}
            >
              <span
                style={{
                  position: "absolute",
                  left: 0,
                  top: 0,
                  bottom: 0,
                  width: `${coursePercent}%`,
                  background: "var(--accent)",
                }}
              />
            </span>
            <span
              className="font-poppins"
              style={{ fontSize: "12px", color: "rgba(var(--fg-rgb),0.5)" }}
            >
              {coursePercent}% complete
            </span>
          </div>
        )}
      </header>

      {/* Stage */}
      <section>
        {playing ? (
          <MuxPlayer
            ref={playerRef}
            playbackId={playing.playbackId}
            tokens={{ playback: playing.token }}
            streamType="on-demand"
            autoPlay
            startTime={playing.startAt}
            accentColor={BRAND_RED}
            poster={course.thumbnail_url ?? undefined}
            metadata={{
              video_title: playingTitle,
              viewer_user_id: user.id,
            }}
            onPause={() =>
              saveProgress(progress[playing.lessonId]?.completed ?? false)
            }
            onEnded={() => saveProgress(true)}
            style={{
              width: "100%",
              aspectRatio: "16 / 9",
              borderRadius: "var(--radius-card)",
              overflow: "hidden",
              background: "#000",
            }}
          />
        ) : !isMember || showUpsell ? (
          <UpgradeUpsell />
        ) : (
          <button
            type="button"
            onClick={() => resumeLesson && playLesson(resumeLesson)}
            disabled={!resumeLesson || loadingLessonId !== null}
            className="st-card st-card-hover relative w-full overflow-hidden flex items-center justify-center"
            style={{
              aspectRatio: "16 / 9",
              background: "var(--bg-secondary)",
              border: "0.5px solid rgba(var(--fg-rgb),0.1)",
              cursor: resumeLesson ? "pointer" : "default",
            }}
          >
            {course.thumbnail_url && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={course.thumbnail_url}
                alt=""
                className="absolute inset-0 w-full h-full object-cover"
                style={{ opacity: 0.5 }}
              />
            )}
            <span className="relative flex flex-col items-center gap-3">
              <span
                className="flex items-center justify-center"
                style={{
                  width: "64px",
                  height: "64px",
                  borderRadius: "9999px",
                  background: "var(--accent)",
                  color: "#fff",
                }}
              >
                {loadingLessonId ? (
                  <Loader2 size={26} strokeWidth={2} className="animate-spin" />
                ) : (
                  <Play size={26} strokeWidth={2} style={{ marginLeft: "3px" }} />
                )}
              </span>
              <span
                className="font-poppins font-bold uppercase"
                style={{
                  fontSize: "13px",
                  letterSpacing: "0.16em",
                  color: "rgb(var(--fg-rgb))",
                }}
              >
                {resumeLesson
                  ? hasProgress
                    ? "Resume course"
                    : "Start course"
                  : "Lessons coming soon"}
              </span>
            </span>
          </button>
        )}

        {error && (
          <p className="text-[var(--accent)] mt-3" style={{ fontSize: "14px" }}>
            {error}
          </p>
        )}
      </section>

      {/* Description */}
      {course.description && (
        <p
          className="font-poppins whitespace-pre-line"
          style={{
            fontSize: "16px",
            lineHeight: 1.7,
            color: "rgba(var(--fg-rgb),0.65)",
            maxWidth: "640px",
          }}
        >
          {course.description}
        </p>
      )}

      {/* Lessons */}
      <section className="flex flex-col" style={{ gap: "12px" }}>
        <h2
          className="font-poppins font-bold uppercase"
          style={{
            fontSize: "13px",
            letterSpacing: "0.2em",
            color: "rgba(var(--fg-rgb),0.4)",
          }}
        >
          Lessons
        </h2>

        <ol className="flex flex-col" style={{ gap: "8px" }}>
          {lessons.map((lesson, i) => {
            const entry = progress[lesson.id];
            const isReady = lesson.status === "ready";
            const isActive = playing?.lessonId === lesson.id;
            const isLoading = loadingLessonId === lesson.id;

            return (
              <li key={lesson.id}>
                <button
                  type="button"
                  onClick={() => playLesson(lesson)}
                  disabled={!isReady && isMember}
                  className="st-card w-full flex items-center gap-4 text-left px-4 py-3"
                  style={{
                    background: isActive
                      ? "rgba(var(--accent-rgb),0.08)"
                      : "var(--bg-surface)",
                    border: isActive
                      ? "0.5px solid rgba(var(--accent-rgb),0.4)"
                      : "0.5px solid rgba(var(--fg-rgb),0.08)",
                    cursor: isReady || !isMember ? "pointer" : "default",
                    opacity: isReady || !isMember ? 1 : 0.55,
                  }}
                >
                  {/* Status / index marker */}
                  <span
                    className="flex items-center justify-center shrink-0"
                    style={{
                      width: "30px",
                      height: "30px",
                      borderRadius: "9999px",
                      background: entry?.completed
                        ? "var(--accent)"
                        : "rgba(var(--fg-rgb),0.08)",
                      color: entry?.completed
                        ? "#fff"
                        : "rgba(var(--fg-rgb),0.5)",
                    }}
                  >
                    {!isMember ? (
                      <Lock size={13} strokeWidth={2} />
                    ) : isLoading ? (
                      <Loader2 size={14} strokeWidth={2} className="animate-spin" />
                    ) : entry?.completed ? (
                      <Check size={15} strokeWidth={2.5} />
                    ) : isReady ? (
                      <Play size={13} strokeWidth={2} style={{ marginLeft: "1px" }} />
                    ) : (
                      <span className="font-poppins" style={{ fontSize: "12px" }}>
                        {i + 1}
                      </span>
                    )}
                  </span>

                  {/* Title + meta */}
                  <span className="flex flex-col min-w-0 flex-1">
                    <span
                      className="font-poppins font-medium truncate"
                      style={{ fontSize: "15px", color: "rgb(var(--fg-rgb))" }}
                    >
                      {lesson.title}
                    </span>
                    {lesson.description && (
                      <span
                        className="font-poppins truncate"
                        style={{
                          fontSize: "13px",
                          color: "rgba(var(--fg-rgb),0.4)",
                        }}
                      >
                        {lesson.description}
                      </span>
                    )}
                  </span>

                  {/* Right meta */}
                  <span
                    className="font-poppins shrink-0"
                    style={{ fontSize: "12px", color: "rgba(var(--fg-rgb),0.4)" }}
                  >
                    {isReady
                      ? formatRuntime(lesson.duration_seconds ?? 0)
                      : lesson.status === "errored"
                        ? "Unavailable"
                        : "Preparing…"}
                  </span>
                </button>
              </li>
            );
          })}

          {lessons.length === 0 && (
            <p
              className="font-playfair italic"
              style={{ fontSize: "16px", color: "rgba(var(--fg-rgb),0.3)" }}
            >
              Lessons are being prepared.
            </p>
          )}
        </ol>
      </section>
    </div>
  );
}
