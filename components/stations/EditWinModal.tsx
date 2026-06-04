"use client";

import { useState, useRef } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { createClient } from "@/lib/supabase/client";
import type { WinCategory } from "@/types";

const MAX_FILE_SIZE = 5 * 1024 * 1024;
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

export interface EditableWin {
  id: string;
  user_id: string;
  title: string;
  description: string;
  category: WinCategory;
  media_url: string | null;
  image_urls?: string[] | null;
  win_type?: string | null;
}

interface ImageSlot {
  preview: string;
  url: string;
  uploading: boolean;
  error: string;
}

interface EditWinModalProps {
  win: EditableWin;
  onClose: () => void;
  onUpdated: (updated: Partial<EditableWin>) => void;
}

// Extract storage path from a public Supabase URL
function storagePath(url: string): string | null {
  const marker = "/win-images/";
  const i = url.indexOf(marker);
  return i >= 0 ? url.slice(i + marker.length) : null;
}

const fieldStyle: React.CSSProperties = {
  background: "var(--bg-surface)",
  border: "0.5px solid rgba(var(--fg-rgb),0.12)",
  color: "rgb(var(--fg-rgb))",
  fontSize: "14px",
  padding: "12px 14px",
  outline: "none",
  width: "100%",
  fontFamily: "inherit",
  borderRadius: "var(--radius-sm)",
};

const labelStyle: React.CSSProperties = {
  fontSize: "10px",
  letterSpacing: "0.18em",
  color: "rgba(var(--fg-rgb),0.3)",
  textTransform: "uppercase",
  fontWeight: 300,
};

export default function EditWinModal({ win, onClose, onUpdated }: EditWinModalProps) {
  const [loading, setLoading] = useState(false);
  const [serverError, setServerError] = useState("");

  const initialSlots: (ImageSlot | null)[] = [null, null];
  (win.image_urls ?? []).slice(0, 2).forEach((u, i) => {
    initialSlots[i] = { preview: u, url: u, uploading: false, error: "" };
  });
  const [images, setImages] = useState<(ImageSlot | null)[]>(initialSlots);
  const fileRef0 = useRef<HTMLInputElement>(null);
  const fileRef1 = useRef<HTMLInputElement>(null);
  const fileRefs = [fileRef0, fileRef1];

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      title: win.title,
      description: win.description,
      category: win.category,
      media_url: win.media_url ?? "",
    },
  });

  const selectedCategory = watch("category");
  const titleVal = watch("title") ?? "";
  const descVal = watch("description") ?? "";

  async function handleImageSelect(slotIndex: number, e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!ACCEPTED_TYPES.includes(file.type)) {
      setImages((prev) => { const n = [...prev]; n[slotIndex] = { preview: "", url: "", uploading: false, error: "JPEG, PNG or WebP only" }; return n; });
      return;
    }
    if (file.size > MAX_FILE_SIZE) {
      setImages((prev) => { const n = [...prev]; n[slotIndex] = { preview: "", url: "", uploading: false, error: "Max 5MB" }; return n; });
      return;
    }

    const preview = URL.createObjectURL(file);
    setImages((prev) => { const n = [...prev]; n[slotIndex] = { preview, url: "", uploading: true, error: "" }; return n; });

    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const ext = file.name.split(".").pop();
    const path = `${user.id}/${Date.now()}-${slotIndex}.${ext}`;
    const { error: uploadError } = await supabase.storage.from("win-images").upload(path, file, { upsert: true });

    if (uploadError) {
      setImages((prev) => { const n = [...prev]; n[slotIndex] = { preview, url: "", uploading: false, error: uploadError.message }; return n; });
      return;
    }

    const { data: urlData } = supabase.storage.from("win-images").getPublicUrl(path);
    setImages((prev) => { const n = [...prev]; n[slotIndex] = { preview, url: urlData.publicUrl, uploading: false, error: "" }; return n; });
  }

  function removeImage(slotIndex: number) {
    setImages((prev) => { const n = [...prev]; n[slotIndex] = null; return n; });
    const ref = fileRefs[slotIndex];
    if (ref.current) ref.current.value = "";
  }

  async function onSubmit(data: FormData) {
    if (images.some((s) => s?.uploading)) {
      setServerError("Images still uploading, please wait.");
      return;
    }
    setLoading(true);
    setServerError("");

    const supabase = createClient();
    const finalUrls = images.filter((s): s is ImageSlot => !!s?.url).map((s) => s.url);
    const original = win.image_urls ?? [];
    const removed = original.filter((u) => !finalUrls.includes(u));
    const newImageUrls = finalUrls.length > 0 ? finalUrls : null;

    const { error } = await supabase
      .from("wins")
      .update({
        title: data.title,
        description: data.description,
        category: data.category,
        media_url: data.media_url || null,
        image_urls: newImageUrls,
      })
      .eq("id", win.id)
      .eq("user_id", win.user_id);

    if (error) {
      setServerError(error.message);
      setLoading(false);
      return;
    }

    // Delete removed images from storage (best-effort)
    if (removed.length > 0) {
      const paths = removed.map(storagePath).filter((p): p is string => !!p);
      if (paths.length) {
        await supabase.storage.from("win-images").remove(paths);
      }
    }

    onUpdated({
      title: data.title,
      description: data.description,
      category: data.category,
      media_url: data.media_url || null,
      image_urls: newImageUrls,
    });
  }

  return (
    <div
      className="st-overlay fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.6)" }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        className="st-modal w-full flex flex-col"
        style={{ maxWidth: "560px", maxHeight: "90vh", overflowY: "auto", background: "var(--bg-secondary)", border: "0.5px solid rgba(var(--fg-rgb),0.1)" }}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between px-8 py-6 sticky top-0"
          style={{ borderBottom: "0.5px solid rgba(var(--fg-rgb),0.08)", background: "var(--bg-secondary)" }}
        >
          <span className="font-poppins font-black uppercase text-[rgb(var(--fg-rgb))]" style={{ fontSize: "24px", letterSpacing: "0.05em" }}>
            EDIT WIN
          </span>
          <button
            onClick={onClose}
            style={{ fontSize: "24px", lineHeight: 1, background: "none", border: "none", cursor: "pointer", color: "rgba(var(--fg-rgb),0.4)", padding: "0 0 2px 8px" }}
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
                    className="st-pill font-poppins font-light uppercase"
                    style={{
                      fontSize: "10px", letterSpacing: "0.15em", padding: "6px 12px",
                      background: active ? "rgb(var(--fg-rgb))" : "var(--bg-surface)",
                      color: active ? "var(--bg-primary)" : "rgba(var(--fg-rgb),0.45)",
                      border: active ? "none" : "0.5px solid rgba(var(--fg-rgb),0.15)",
                      cursor: "pointer",
                    }}>
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
              <span className="font-poppins font-light" style={{ fontSize: "10px", color: titleVal.length > 72 ? "var(--accent)" : "rgba(var(--fg-rgb),0.2)" }}>
                {titleVal.length}/80
              </span>
            </div>
            <input {...register("title")} type="text" className="st-field font-poppins text-[rgb(var(--fg-rgb))] outline-none" style={fieldStyle} maxLength={80} />
            {errors.title && <span style={{ color: "var(--accent)", fontSize: "11px" }}>{errors.title.message}</span>}
          </div>

          {/* Description */}
          <div className="flex flex-col" style={{ gap: "8px" }}>
            <div className="flex items-center justify-between">
              <label className="font-poppins" style={labelStyle}>Tell us more</label>
              <span className="font-poppins font-light" style={{ fontSize: "10px", color: descVal.length > 450 ? "var(--accent)" : "rgba(var(--fg-rgb),0.2)" }}>
                {descVal.length}/500
              </span>
            </div>
            <textarea {...register("description")} rows={5} className="st-field font-poppins text-[rgb(var(--fg-rgb))] outline-none resize-none" style={{ ...fieldStyle, lineHeight: 1.7 }} maxLength={500} />
            {errors.description && <span style={{ color: "var(--accent)", fontSize: "11px" }}>{errors.description.message}</span>}
          </div>

          {/* Images */}
          <div className="flex flex-col" style={{ gap: "10px" }}>
            <label className="font-poppins" style={labelStyle}>Images <span style={{ opacity: 0.5 }}>(max 2)</span></label>
            <div className="flex" style={{ gap: "10px" }}>
              {[0, 1].map((slotIndex) => {
                const slot = images[slotIndex];
                return (
                  <div key={slotIndex} style={{ position: "relative", width: "120px", height: "120px", flexShrink: 0 }}>
                    {slot ? (
                      <>
                        {slot.uploading ? (
                          <div className="flex items-center justify-center" style={{ width: "120px", height: "120px", background: "var(--bg-surface)", border: "0.5px solid rgba(var(--fg-rgb),0.12)", borderRadius: "var(--radius-md)" }}>
                            <span className="font-poppins font-light" style={{ fontSize: "10px", color: "rgba(var(--fg-rgb),0.3)" }}>Uploading…</span>
                          </div>
                        ) : slot.error ? (
                          <div className="flex items-center justify-center" style={{ width: "120px", height: "120px", background: "var(--bg-surface)", border: "0.5px solid rgba(var(--accent-rgb),0.4)", borderRadius: "var(--radius-md)" }}>
                            <span style={{ color: "var(--accent)", fontSize: "10px", textAlign: "center", padding: "4px" }}>{slot.error}</span>
                          </div>
                        ) : (
                          <img src={slot.preview} alt="" className="object-cover" style={{ width: "120px", height: "120px", borderRadius: "var(--radius-md)" }} />
                        )}
                        <button type="button" onClick={() => removeImage(slotIndex)}
                          style={{ position: "absolute", top: "6px", right: "6px", width: "22px", height: "22px", background: "rgba(0,0,0,0.7)", color: "#fff", border: "none", cursor: "pointer", fontSize: "14px", lineHeight: 1, display: "flex", alignItems: "center", justifyContent: "center", borderRadius: "50%" }}>
                          ×
                        </button>
                      </>
                    ) : (
                      <button type="button" onClick={() => fileRefs[slotIndex].current?.click()}
                        className="flex flex-col items-center justify-center transition-colors hover:border-[rgba(var(--fg-rgb),0.4)]"
                        style={{ width: "120px", height: "120px", background: "transparent", border: "1px dashed rgba(var(--fg-rgb),0.2)", cursor: "pointer", gap: "6px", borderRadius: "var(--radius-md)" }}>
                        <span style={{ fontSize: "20px", color: "rgba(var(--fg-rgb),0.2)", lineHeight: 1 }}>+</span>
                        <span className="font-poppins font-light" style={{ fontSize: "9px", letterSpacing: "0.1em", color: "rgba(var(--fg-rgb),0.2)", textTransform: "uppercase" }}>Add image</span>
                      </button>
                    )}
                    <input ref={fileRefs[slotIndex]} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={(e) => handleImageSelect(slotIndex, e)} />
                  </div>
                );
              })}
            </div>
          </div>

          {/* Project link */}
          <div className="flex flex-col" style={{ gap: "8px" }}>
            <label className="font-poppins" style={labelStyle}>Project Link <span style={{ opacity: 0.5 }}>(optional)</span></label>
            <input {...register("media_url")} type="url" placeholder="Link to what you built…" className="st-field font-poppins text-[rgb(var(--fg-rgb))] outline-none" style={fieldStyle} />
            {errors.media_url && <span style={{ color: "var(--accent)", fontSize: "11px" }}>{errors.media_url.message}</span>}
          </div>

          {serverError && <p style={{ color: "var(--accent)", fontSize: "12px" }}>{serverError}</p>}

          <button type="submit" disabled={loading} className="st-btn font-poppins font-black uppercase"
            style={{ background: "rgb(var(--fg-rgb))", color: "var(--bg-primary)", fontSize: "12px", letterSpacing: "0.15em", padding: "16px", border: "none", cursor: loading ? "not-allowed" : "pointer", opacity: loading ? 0.5 : 1 }}>
            {loading ? "Saving…" : "SAVE CHANGES"}
          </button>
        </form>
      </div>
    </div>
  );
}
