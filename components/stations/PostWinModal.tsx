"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { createClient } from "@/lib/supabase/client";
import type { WinCategory } from "@/types";

const schema = z.object({
  title: z.string().min(3, "Title is required").max(80, "Max 80 characters"),
  description: z.string().min(20, "Write at least 20 characters").max(500, "Max 500 characters"),
  category: z.enum(["startup", "project", "fitness", "exam", "personal", "other"]),
  media_url: z.string().url("Enter a valid URL").or(z.literal("")).optional(),
});

type FormData = z.infer<typeof schema>;

const CATEGORIES: { value: WinCategory; label: string }[] = [
  { value: "startup", label: "Startup" },
  { value: "project", label: "Project" },
  { value: "fitness", label: "Fitness" },
  { value: "exam", label: "Exam" },
  { value: "personal", label: "Personal" },
  { value: "other", label: "Other" },
];

const fieldStyle: React.CSSProperties = {
  background: "#1a1a1a",
  border: "0.5px solid rgba(240,235,224,0.12)",
  color: "#f0ebe0",
  fontSize: "14px",
  padding: "12px 14px",
  outline: "none",
  width: "100%",
  fontFamily: "inherit",
  borderRadius: 0,
};

const labelStyle: React.CSSProperties = {
  fontSize: "10px",
  letterSpacing: "0.18em",
  color: "rgba(240,235,224,0.3)",
  textTransform: "uppercase",
  fontWeight: 300,
};

interface PostWinModalProps {
  onClose: () => void;
  onPosted: () => void;
}

export default function PostWinModal({ onClose, onPosted }: PostWinModalProps) {
  const [loading, setLoading] = useState(false);
  const [serverError, setServerError] = useState("");

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { category: "project", media_url: "" },
  });

  const selectedCategory = watch("category");
  const titleVal = watch("title") ?? "";
  const descVal = watch("description") ?? "";

  async function onSubmit(data: FormData) {
    setLoading(true);
    setServerError("");
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setServerError("Session expired."); setLoading(false); return; }

    const { error } = await supabase.from("wins").insert({
      user_id: user.id,
      title: data.title,
      description: data.description,
      category: data.category,
      media_url: data.media_url || null,
      reactions_count: 0,
    });

    if (error) { setServerError(error.message); setLoading(false); return; }
    onPosted();
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ background: "rgba(0,0,0,0.85)" }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        className="w-full flex flex-col"
        style={{
          maxWidth: "560px",
          maxHeight: "90vh",
          overflowY: "auto",
          background: "#111111",
          border: "0.5px solid rgba(240,235,224,0.1)",
          borderRadius: 0,
        }}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between px-8 py-6 sticky top-0"
          style={{ borderBottom: "0.5px solid rgba(240,235,224,0.08)", background: "#111111" }}
        >
          <span
            className="font-poppins font-black uppercase text-[#f0ebe0]"
            style={{ fontSize: "24px", letterSpacing: "0.05em" }}
          >
            POST A WIN
          </span>
          <button
            onClick={onClose}
            className="text-[rgba(240,235,224,0.4)] hover:text-[#f0ebe0] transition-colors"
            style={{ fontSize: "24px", lineHeight: 1, background: "none", border: "none", cursor: "pointer", padding: "0 0 2px 8px" }}
          >
            ×
          </button>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col px-8 py-6" style={{ gap: "22px" }}>

          {/* Category */}
          <div className="flex flex-col" style={{ gap: "10px" }}>
            <label className="font-poppins" style={labelStyle}>Category</label>
            <div className="flex flex-wrap" style={{ gap: "6px" }}>
              {CATEGORIES.map((c) => {
                const active = selectedCategory === c.value;
                return (
                  <button
                    key={c.value}
                    type="button"
                    onClick={() => setValue("category", c.value)}
                    className="font-poppins font-light uppercase transition-colors"
                    style={{
                      fontSize: "10px",
                      letterSpacing: "0.15em",
                      padding: "6px 12px",
                      background: active ? "#f0ebe0" : "#1a1a1a",
                      color: active ? "#0a0a0a" : "rgba(240,235,224,0.45)",
                      border: active ? "none" : "0.5px solid rgba(240,235,224,0.15)",
                      cursor: "pointer",
                      borderRadius: 0,
                    }}
                  >
                    {c.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Title */}
          <div className="flex flex-col" style={{ gap: "8px" }}>
            <div className="flex items-center justify-between">
              <label className="font-poppins" style={labelStyle}>What did you win?</label>
              <span className="font-poppins font-light" style={{ fontSize: "10px", color: titleVal.length > 72 ? "#c0392b" : "rgba(240,235,224,0.2)" }}>
                {titleVal.length}/80
              </span>
            </div>
            <input
              {...register("title")}
              type="text"
              placeholder="Keep it sharp."
              className="font-poppins text-[#f0ebe0] outline-none"
              style={fieldStyle}
              maxLength={80}
            />
            {errors.title && <span className="text-[#c0392b]" style={{ fontSize: "11px" }}>{errors.title.message}</span>}
          </div>

          {/* Description */}
          <div className="flex flex-col" style={{ gap: "8px" }}>
            <div className="flex items-center justify-between">
              <label className="font-poppins" style={labelStyle}>Tell us more</label>
              <span className="font-poppins font-light" style={{ fontSize: "10px", color: descVal.length > 450 ? "#c0392b" : "rgba(240,235,224,0.2)" }}>
                {descVal.length}/500
              </span>
            </div>
            <textarea
              {...register("description")}
              rows={5}
              placeholder="What happened? What does it mean? Be honest."
              className="font-poppins text-[#f0ebe0] outline-none resize-none"
              style={{ ...fieldStyle, lineHeight: 1.7 }}
              maxLength={500}
            />
            {errors.description && <span className="text-[#c0392b]" style={{ fontSize: "11px" }}>{errors.description.message}</span>}
          </div>

          {/* Media URL (optional) */}
          <div className="flex flex-col" style={{ gap: "8px" }}>
            <label className="font-poppins" style={labelStyle}>Media URL <span style={{ opacity: 0.5 }}>(optional)</span></label>
            <input
              {...register("media_url")}
              type="url"
              placeholder="https://..."
              className="font-poppins text-[#f0ebe0] outline-none"
              style={fieldStyle}
            />
            {errors.media_url && <span className="text-[#c0392b]" style={{ fontSize: "11px" }}>{errors.media_url.message}</span>}
          </div>

          {serverError && (
            <p className="text-[#c0392b]" style={{ fontSize: "12px" }}>{serverError}</p>
          )}

          {/* Submit */}
          <button
            type="submit"
            disabled={loading}
            className="font-poppins font-black uppercase text-[#0a0a0a]"
            style={{
              background: "#f0ebe0",
              fontSize: "12px",
              letterSpacing: "0.15em",
              padding: "16px",
              border: "none",
              cursor: loading ? "not-allowed" : "pointer",
              opacity: loading ? 0.5 : 1,
              transition: "opacity 150ms",
              borderRadius: 0,
            }}
          >
            {loading ? "Posting…" : "POST IT"}
          </button>
        </form>
      </div>
    </div>
  );
}
