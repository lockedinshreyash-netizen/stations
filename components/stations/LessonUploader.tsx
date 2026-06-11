"use client";

import { useEffect, useRef, useState } from "react";
import * as UpChunk from "@mux/upchunk";
import { ArrowUp, ArrowDown, Trash2, Check, Loader2 } from "lucide-react";
import {
  requestLessonUpload,
  updateLesson,
  getLesson,
} from "@/lib/archive/courses";
import { formatRuntime } from "@/lib/archive/format";
import type { ArchiveLesson } from "@/types";

const inputStyle: React.CSSProperties = {
  background: "var(--bg-secondary)",
  border: "0.5px solid rgba(var(--fg-rgb),0.12)",
  color: "rgb(var(--fg-rgb))",
  outline: "none",
  width: "100%",
  fontFamily: "inherit",
  borderRadius: "var(--radius-sm)",
};

export default function LessonUploader({
  lesson,
  index,
  total,
  onUpdated,
  onDelete,
  onMove,
}: {
  lesson: ArchiveLesson;
  index: number;
  total: number;
  onUpdated: (lesson: ArchiveLesson) => void;
  onDelete: (lessonId: string) => void;
  onMove: (lessonId: string, dir: -1 | 1) => void;
}) {
  const [title, setTitle] = useState(lesson.title);
  const [description, setDescription] = useState(lesson.description ?? "");
  const [uploadPct, setUploadPct] = useState<number | null>(null);
  const [uploadError, setUploadError] = useState("");
  const [polling, setPolling] = useState(false);

  const pollRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const attemptsRef = useRef(0);

  // Clear any pending poll timer on unmount (cleanup only — no state writes here).
  useEffect(() => {
    return () => {
      if (pollRef.current) clearTimeout(pollRef.current);
    };
  }, []);

  async function saveMeta() {
    const t = title.trim();
    const d = description.trim();
    if (!t) return;
    if (t === lesson.title && d === (lesson.description ?? "")) return;
    try {
      await updateLesson(lesson.id, { title: t, description: d || null });
      onUpdated({ ...lesson, title: t, description: d || null });
    } catch {
      /* non-fatal; admin can retry */
    }
  }

  function poll() {
    attemptsRef.current += 1;
    pollRef.current = setTimeout(async () => {
      let fresh: ArchiveLesson | null = null;
      try {
        fresh = await getLesson(lesson.id);
      } catch {
        /* ignore transient errors */
      }
      if (fresh && (fresh.status === "ready" || fresh.status === "errored")) {
        onUpdated(fresh);
        setPolling(false);
        setUploadPct(null);
        return;
      }
      if (fresh) onUpdated(fresh);
      if (attemptsRef.current < 45) poll();
      else setPolling(false);
    }, 4000);
  }

  async function startUpload(file: File) {
    setUploadError("");
    setUploadPct(0);
    try {
      const { uploadUrl } = await requestLessonUpload(lesson.id);
      const upload = UpChunk.createUpload({
        endpoint: uploadUrl,
        file,
        chunkSize: 30720, // 30MB chunks
      });
      upload.on("progress", (e) => {
        const d = (e as CustomEvent).detail as number | { progress?: number };
        const pct = typeof d === "number" ? d : d?.progress ?? 0;
        setUploadPct(Math.round(pct));
      });
      upload.on("error", (e) => {
        const d = (e as CustomEvent).detail as { message?: string };
        setUploadError(d?.message ?? "Upload failed.");
        setUploadPct(null);
      });
      upload.on("success", () => {
        setUploadPct(100);
        setPolling(true);
        attemptsRef.current = 0;
        poll();
      });
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : "Upload failed.");
      setUploadPct(null);
    }
  }

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) startUpload(file);
    e.target.value = "";
  }

  const uploading = uploadPct !== null;
  const isReady = lesson.status === "ready";

  return (
    <div
      className="st-card flex flex-col gap-3 px-4 py-4"
      style={{
        background: "var(--bg-surface)",
        border: "0.5px solid rgba(var(--fg-rgb),0.1)",
      }}
    >
      <div className="flex items-start gap-3">
        {/* Order controls */}
        <div className="flex flex-col items-center gap-1 pt-1">
          <button
            type="button"
            onClick={() => onMove(lesson.id, -1)}
            disabled={index === 0}
            aria-label="Move up"
            style={{
              color: "rgba(var(--fg-rgb),0.4)",
              opacity: index === 0 ? 0.3 : 1,
              cursor: index === 0 ? "default" : "pointer",
            }}
          >
            <ArrowUp size={15} strokeWidth={2} />
          </button>
          <span
            className="font-poppins"
            style={{ fontSize: "12px", color: "rgba(var(--fg-rgb),0.4)" }}
          >
            {index + 1}
          </span>
          <button
            type="button"
            onClick={() => onMove(lesson.id, 1)}
            disabled={index === total - 1}
            aria-label="Move down"
            style={{
              color: "rgba(var(--fg-rgb),0.4)",
              opacity: index === total - 1 ? 0.3 : 1,
              cursor: index === total - 1 ? "default" : "pointer",
            }}
          >
            <ArrowDown size={15} strokeWidth={2} />
          </button>
        </div>

        {/* Fields */}
        <div className="flex-1 flex flex-col gap-2 min-w-0">
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onBlur={saveMeta}
            placeholder="Lesson title"
            className="st-field font-poppins font-medium"
            style={{ ...inputStyle, fontSize: "15px", padding: "9px 11px" }}
          />
          <input
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            onBlur={saveMeta}
            placeholder="Short description (optional)"
            className="st-field font-poppins"
            style={{ ...inputStyle, fontSize: "13px", padding: "8px 11px" }}
          />
        </div>

        {/* Delete */}
        <button
          type="button"
          onClick={() => onDelete(lesson.id)}
          aria-label="Delete lesson"
          style={{ color: "rgba(var(--fg-rgb),0.4)", cursor: "pointer", paddingTop: "4px" }}
        >
          <Trash2 size={16} strokeWidth={1.75} />
        </button>
      </div>

      {/* Video state row */}
      <div className="flex items-center gap-3 pl-9">
        <span
          className="font-poppins uppercase"
          style={{
            fontSize: "11px",
            letterSpacing: "0.12em",
            color: isReady
              ? "var(--accent-2)"
              : lesson.status === "errored"
                ? "var(--accent)"
                : "rgba(var(--fg-rgb),0.4)",
            display: "inline-flex",
            alignItems: "center",
            gap: "5px",
          }}
        >
          {isReady ? (
            <>
              <Check size={13} strokeWidth={2.5} /> Ready ·{" "}
              {formatRuntime(lesson.duration_seconds ?? 0)}
            </>
          ) : polling || lesson.status === "processing" ? (
            <>
              <Loader2 size={13} strokeWidth={2} className="animate-spin" />
              Processing…
            </>
          ) : lesson.status === "errored" ? (
            "Upload failed — try again"
          ) : (
            "No video yet"
          )}
        </span>

        {uploading ? (
          <span
            className="relative overflow-hidden"
            style={{
              flex: 1,
              maxWidth: "220px",
              height: "5px",
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
                width: `${uploadPct}%`,
                background: "var(--accent)",
              }}
            />
          </span>
        ) : (
          <label
            className="st-pill font-poppins uppercase cursor-pointer"
            style={{
              fontSize: "11px",
              letterSpacing: "0.1em",
              padding: "6px 12px",
              border: "0.5px solid rgba(var(--fg-rgb),0.2)",
              color: "rgba(var(--fg-rgb),0.6)",
              background: "var(--bg-secondary)",
            }}
          >
            {isReady ? "Replace video" : "Upload video"}
            <input
              type="file"
              accept="video/*"
              className="hidden"
              onChange={handleFile}
            />
          </label>
        )}

        {uploading && (
          <span
            className="font-poppins"
            style={{ fontSize: "11px", color: "rgba(var(--fg-rgb),0.4)" }}
          >
            {uploadPct}%
          </span>
        )}
      </div>

      {uploadError && (
        <p className="text-[var(--accent)] pl-9" style={{ fontSize: "12px" }}>
          {uploadError}
        </p>
      )}
    </div>
  );
}
