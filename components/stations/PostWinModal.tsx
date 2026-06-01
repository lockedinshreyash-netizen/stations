"use client";

import { useState, useRef } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { createClient } from "@/lib/supabase/client";
import type { WinCategory } from "@/types";

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
const ACCEPTED_TYPES = ["image/jpeg", "image/png", "image/webp"];

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
  { value: "exam",    label: "Exam"    },
  { value: "personal",label: "Personal"},
  { value: "other",   label: "Other"   },
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

interface ImageSlot {
  preview: string;   // object URL for preview
  url: string;       // public Supabase URL after upload
  uploading: boolean;
  error: string;
}

interface PostWinModalProps {
  onClose: () => void;
  onPosted: () => void;
}

export default function PostWinModal({ onClose, onPosted }: PostWinModalProps) {
  const [loading, setLoading] = useState(false);
  const [serverError, setServerError] = useState("");
  const [images, setImages] = useState<(ImageSlot | null)[]>([null, null]);
  const fileRefs = [useRef<HTMLInputElement>(null), useRef<HTMLInputElement>(null)];

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

  async function handleImageSelect(slotIndex: number, e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!ACCEPTED_TYPES.includes(file.type)) {
      setImages((prev) => {
        const next = [...prev];
        next[slotIndex] = { preview: "", url: "", uploading: false, error: "JPEG, PNG or WebP only" };
        return next;
      });
      return;
    }
    if (file.size > MAX_FILE_SIZE) {
      setImages((prev) => {
        const next = [...prev];
        next[slotIndex] = { preview: "", url: "", uploading: false, error: "Max 5MB" };
        return next;
      });
      return;
    }

    const preview = URL.createObjectURL(file);
    setImages((prev) => {
      const next = [...prev];
      next[slotIndex] = { preview, url: "", uploading: true, error: "" };
      return next;
    });

    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const ext = file.name.split(".").pop();
    const path = `${user.id}/${Date.now()}-${slotIndex}.${ext}`;
    const { error: uploadError } = await supabase.storage
      .from("win-images")
      .upload(path, file, { upsert: true });

    if (uploadError) {
      setImages((prev) => {
        const next = [...prev];
        next[slotIndex] = { preview, url: "", uploading: false, error: uploadError.message };
        return next;
      });
      return;
    }

    const { data: urlData } = supabase.storage.from("win-images").getPublicUrl(path);
    setImages((prev) => {
      const next = [...prev];
      next[slotIndex] = { preview, url: urlData.publicUrl, uploading: false, error: "" };
      return next;
    });
  }

  function removeImage(slotIndex: number) {
    setImages((prev) => {
      const next = [...prev];
      next[slotIndex] = null;
      return next;
    });
    if (fileRefs[slotIndex].current) fileRefs[slotIndex].current!.value = "";
  }

  async function onSubmit(data: FormData) {
    const uploading = images.some((s) => s?.uploading);
    if (uploading) { setServerError("Images still uploading, please wait."); return; }

    setLoading(true);
    setServerError("");
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setServerError("Session expired."); setLoading(false); return; }

    const image_urls = images.filter((s): s is ImageSlot => !!s?.url).map((s) => s.url);

    const { error } = await supabase.from("wins").insert({
      user_id: user.id,
      title: data.title,
      description: data.description,
      category: data.category,
      media_url: data.media_url || null,
      image_urls: image_urls.length > 0 ? image_urls : null,
      reactions_count: 0,
      reaction_counts: { respect: 0, fire: 0, build: 0, focused: 0, strong: 0 },
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
          <span className="font-poppins font-black uppercase text-[#f0ebe0]" style={{ fontSize: "24px", letterSpacing: "0.05em" }}>
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
                  <button key={c.value} type="button" onClick={() => setValue("category", c.value)}
                    className="font-poppins font-light uppercase transition-colors"
                    style={{
                      fontSize: "10px", letterSpacing: "0.15em", padding: "6px 12px",
                      background: active ? "#f0ebe0" : "#1a1a1a",
                      color: active ? "#0a0a0a" : "rgba(240,235,224,0.45)",
                      border: active ? "none" : "0.5px solid rgba(240,235,224,0.15)",
                      cursor: "pointer", borderRadius: 0,
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
            <input {...register("title")} type="text" placeholder="Keep it sharp."
              className="font-poppins text-[#f0ebe0] outline-none" style={fieldStyle} maxLength={80} />
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
            <textarea {...register("description")} rows={5}
              placeholder="What happened? What does it mean? Be honest."
              className="font-poppins text-[#f0ebe0] outline-none resize-none"
              style={{ ...fieldStyle, lineHeight: 1.7 }} maxLength={500} />
            {errors.description && <span className="text-[#c0392b]" style={{ fontSize: "11px" }}>{errors.description.message}</span>}
          </div>

          {/* Image upload */}
          <div className="flex flex-col" style={{ gap: "10px" }}>
            <label className="font-poppins" style={labelStyle}>
              Images <span style={{ opacity: 0.5 }}>(optional, max 2)</span>
            </label>
            <div className="flex" style={{ gap: "10px" }}>
              {[0, 1].map((slotIndex) => {
                const slot = images[slotIndex];
                return (
                  <div key={slotIndex} style={{ position: "relative", width: "120px", height: "120px", flexShrink: 0 }}>
                    {slot ? (
                      <>
                        {slot.uploading ? (
                          <div
                            className="flex items-center justify-center"
                            style={{ width: "120px", height: "120px", background: "#1a1a1a", border: "0.5px solid rgba(240,235,224,0.12)" }}
                          >
                            <span className="font-poppins font-light text-[rgba(240,235,224,0.3)]" style={{ fontSize: "10px" }}>
                              Uploading…
                            </span>
                          </div>
                        ) : slot.error ? (
                          <div
                            className="flex flex-col items-center justify-center"
                            style={{ width: "120px", height: "120px", background: "#1a1a1a", border: "0.5px solid rgba(192,57,43,0.4)", gap: "4px" }}
                          >
                            <span className="text-[#c0392b]" style={{ fontSize: "10px", textAlign: "center", padding: "4px" }}>{slot.error}</span>
                          </div>
                        ) : (
                          <img src={slot.preview} alt="" className="object-cover" style={{ width: "120px", height: "120px" }} />
                        )}
                        {/* Remove button */}
                        <button
                          type="button"
                          onClick={() => removeImage(slotIndex)}
                          className="font-poppins"
                          style={{
                            position: "absolute", top: "4px", right: "4px",
                            width: "20px", height: "20px",
                            background: "rgba(0,0,0,0.7)", color: "#f0ebe0",
                            border: "none", cursor: "pointer", fontSize: "14px", lineHeight: 1,
                            display: "flex", alignItems: "center", justifyContent: "center",
                            borderRadius: 0,
                          }}
                        >
                          ×
                        </button>
                      </>
                    ) : (
                      <button
                        type="button"
                        onClick={() => fileRefs[slotIndex].current?.click()}
                        className="flex flex-col items-center justify-center transition-colors"
                        style={{
                          width: "120px", height: "120px",
                          background: "transparent",
                          border: "1px dashed rgba(240,235,224,0.2)",
                          cursor: "pointer", gap: "6px", borderRadius: 0,
                        }}
                      >
                        <span style={{ fontSize: "20px", color: "rgba(240,235,224,0.2)", lineHeight: 1 }}>+</span>
                        <span className="font-poppins font-light" style={{ fontSize: "9px", letterSpacing: "0.1em", color: "rgba(240,235,224,0.2)", textTransform: "uppercase" }}>
                          Add image
                        </span>
                      </button>
                    )}
                    <input
                      ref={fileRefs[slotIndex]}
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      className="hidden"
                      onChange={(e) => handleImageSelect(slotIndex, e)}
                    />
                  </div>
                );
              })}
            </div>
          </div>

          {/* Project link (optional) */}
          <div className="flex flex-col" style={{ gap: "8px" }}>
            <label className="font-poppins" style={labelStyle}>Project Link <span style={{ opacity: 0.5 }}>(optional)</span></label>
            <input {...register("media_url")} type="url" placeholder="Link to what you built — site, repo, demo…"
              className="font-poppins text-[#f0ebe0] outline-none" style={fieldStyle} />
            {errors.media_url && <span className="text-[#c0392b]" style={{ fontSize: "11px" }}>{errors.media_url.message}</span>}
          </div>

          {serverError && <p className="text-[#c0392b]" style={{ fontSize: "12px" }}>{serverError}</p>}

          {/* Submit */}
          <button
            type="submit"
            disabled={loading}
            className="font-poppins font-black uppercase text-[#0a0a0a]"
            style={{
              background: "#f0ebe0", fontSize: "12px", letterSpacing: "0.15em",
              padding: "16px", border: "none",
              cursor: loading ? "not-allowed" : "pointer",
              opacity: loading ? 0.5 : 1, transition: "opacity 150ms", borderRadius: 0,
            }}
          >
            {loading ? "Posting…" : "POST IT"}
          </button>
        </form>
      </div>
    </div>
  );
}
