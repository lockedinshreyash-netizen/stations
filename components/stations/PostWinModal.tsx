"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { createClient } from "@/lib/supabase/client";
import type { WinCategory } from "@/types";

const schema = z.object({
  title: z.string().min(3, "Title is required").max(120),
  description: z.string().min(10, "Tell us more").max(1000),
  category: z.enum(["startup", "project", "fitness", "exam", "personal", "other"]),
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
    defaultValues: { category: "project" },
  });

  const selectedCategory = watch("category");

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
      reactions_count: 0,
    });

    if (error) { setServerError(error.message); setLoading(false); return; }
    onPosted();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: "rgba(0,0,0,0.8)" }}>
      <div
        className="w-full max-w-lg flex flex-col"
        style={{ background: "#111111", border: "0.5px solid rgba(240,235,224,0.1)" }}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between px-8 py-6"
          style={{ borderBottom: "0.5px solid rgba(240,235,224,0.08)" }}
        >
          <span
            className="font-poppins font-black uppercase text-[#f0ebe0]"
            style={{ fontSize: "13px", letterSpacing: "0.2em" }}
          >
            Post a Win
          </span>
          <button
            onClick={onClose}
            className="text-[rgba(240,235,224,0.4)] hover:text-[#f0ebe0] transition-colors"
            style={{ fontSize: "20px", lineHeight: 1, background: "none", border: "none", cursor: "pointer" }}
          >
            ×
          </button>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col px-8 py-6" style={{ gap: "20px" }}>
          {/* Category */}
          <div className="flex flex-col" style={{ gap: "8px" }}>
            <label className="font-poppins font-light uppercase text-[rgba(240,235,224,0.3)]" style={{ fontSize: "10px", letterSpacing: "0.18em" }}>
              Category
            </label>
            <div className="flex flex-wrap" style={{ gap: "6px" }}>
              {CATEGORIES.map((c) => (
                <button
                  key={c.value}
                  type="button"
                  onClick={() => setValue("category", c.value)}
                  className="font-poppins font-light uppercase transition-colors"
                  style={{
                    fontSize: "10px",
                    letterSpacing: "0.15em",
                    padding: "5px 10px",
                    background: selectedCategory === c.value ? "#f0ebe0" : "#1a1a1a",
                    color: selectedCategory === c.value ? "#0a0a0a" : "rgba(240,235,224,0.5)",
                    border: "none",
                    cursor: "pointer",
                  }}
                >
                  {c.label}
                </button>
              ))}
            </div>
          </div>

          {/* Title */}
          <div className="flex flex-col" style={{ gap: "8px" }}>
            <label className="font-poppins font-light uppercase text-[rgba(240,235,224,0.3)]" style={{ fontSize: "10px", letterSpacing: "0.18em" }}>
              What did you win?
            </label>
            <input
              {...register("title")}
              type="text"
              placeholder="Keep it sharp."
              className="font-poppins text-[#f0ebe0] outline-none"
              style={{
                background: "#1a1a1a",
                border: "0.5px solid rgba(240,235,224,0.1)",
                padding: "12px 14px",
                fontSize: "14px",
              }}
            />
            {errors.title && <span className="text-[#c0392b]" style={{ fontSize: "12px" }}>{errors.title.message}</span>}
          </div>

          {/* Description */}
          <div className="flex flex-col" style={{ gap: "8px" }}>
            <label className="font-poppins font-light uppercase text-[rgba(240,235,224,0.3)]" style={{ fontSize: "10px", letterSpacing: "0.18em" }}>
              Tell us more
            </label>
            <textarea
              {...register("description")}
              rows={4}
              placeholder="What happened? What does it mean? Be honest."
              className="font-poppins text-[#f0ebe0] outline-none resize-none"
              style={{
                background: "#1a1a1a",
                border: "0.5px solid rgba(240,235,224,0.1)",
                padding: "12px 14px",
                fontSize: "14px",
                lineHeight: 1.7,
              }}
            />
            {errors.description && <span className="text-[#c0392b]" style={{ fontSize: "12px" }}>{errors.description.message}</span>}
          </div>

          {serverError && <p className="text-[#c0392b]" style={{ fontSize: "12px" }}>{serverError}</p>}

          <button
            type="submit"
            disabled={loading}
            className="font-poppins font-black uppercase text-[#0a0a0a]"
            style={{
              background: "#f0ebe0",
              fontSize: "11px",
              letterSpacing: "0.15em",
              padding: "14px",
              border: "none",
              cursor: loading ? "not-allowed" : "pointer",
              opacity: loading ? 0.5 : 1,
              transition: "opacity 150ms",
            }}
          >
            {loading ? "Posting…" : "Post Win"}
          </button>
        </form>
      </div>
    </div>
  );
}
