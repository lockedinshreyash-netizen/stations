"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { X, Plus, Check, Trash2 } from "lucide-react";
import { tap } from "@/lib/feedback";
import { planStatus } from "@/lib/todos/queries";
import { todoSchema, type TodoData, DAILY_PLAN_LIMIT } from "@/lib/validations/todos";
import type { Todo, TodoBoard } from "@/types";

export default function TodoPanel({
  board,
  onClose,
  onToggle,
  onAdd,
  onPlanToday,
  onDelete,
}: {
  board: TodoBoard;
  onClose: () => void;
  onToggle: (todo: Todo) => void;
  onAdd: (title: string, planForToday: boolean) => Promise<void> | void;
  onPlanToday: (ids: string[]) => Promise<void> | void;
  onDelete: (todo: Todo) => void;
}) {
  const status = planStatus(board.today);
  const room = DAILY_PLAN_LIMIT - status.total; // open slots in today's plan
  const isAfternoon = new Date().getHours() >= 12;
  const incomplete = board.today.filter((t) => !t.done);

  // Selection for promoting backlog items into today's plan.
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const toggleSelect = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else if (next.size < room) next.add(id);
      return next;
    });
  };

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<TodoData>({ resolver: zodResolver(todoSchema) });
  const [addToToday, setAddToToday] = useState(false);

  async function submitAdd(data: TodoData) {
    await onAdd(data.title, addToToday && room > 0);
    reset({ title: "" });
  }

  async function commitSelected() {
    if (selected.size === 0) return;
    await onPlanToday([...selected]);
    setSelected(new Set());
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center" role="dialog" aria-modal="true" aria-label="Your todos">
      <div className="st-overlay absolute inset-0" style={{ background: "rgba(0,0,0,0.4)" }} onClick={onClose} aria-hidden />

      <div
        className="st-liquid st-card st-rise relative w-full flex flex-col"
        style={{
          maxWidth: "460px",
          maxHeight: "82vh",
          margin: "0 12px",
          // Rest just above the floating taskbar (bottom 16px + its ~64px height).
          marginBottom: "calc(96px + env(safe-area-inset-bottom))",
          borderRadius: "var(--radius-card)",
        }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 pt-5 pb-3 shrink-0">
          <div className="flex flex-col">
            <span className="font-poppins font-black uppercase text-[rgb(var(--fg-rgb))]" style={{ fontSize: "15px", letterSpacing: "0.18em" }}>
              Today
            </span>
            <span className="font-poppins font-light text-[rgba(var(--fg-rgb),0.4)]" style={{ fontSize: "13px" }}>
              {status.total > 0 ? `${status.completed} of ${status.total} done` : "Plan your 3 things"}
            </span>
          </div>
          <button
            type="button"
            onClick={() => { tap(); onClose(); }}
            aria-label="Close"
            className="st-pill flex items-center justify-center"
            style={{ width: "36px", height: "36px", color: "rgba(var(--fg-rgb),0.5)" }}
          >
            <X size={18} strokeWidth={1.75} />
          </button>
        </div>

        <div className="flex flex-col gap-5 px-5 pb-5 overflow-y-auto">
          {/* Daily prompt / today's plan */}
          <section className="flex flex-col gap-2.5">
            {status.total === 0 ? (
              <p className="font-playfair italic text-[rgba(var(--fg-rgb),0.55)]" style={{ fontSize: "17px" }}>
                What are the 3 things you&apos;ll do today?
              </p>
            ) : (
              <>
                {/* Progress bar */}
                <div className="h-1.5 w-full rounded-full overflow-hidden" style={{ background: "rgba(var(--fg-rgb),0.08)" }}>
                  <div
                    className="h-full rounded-full"
                    style={{
                      width: `${(status.completed / status.total) * 100}%`,
                      background: status.allDone ? "var(--accent-2)" : "var(--accent)",
                      transition: "width 0.4s var(--ease)",
                    }}
                  />
                </div>

                {board.today.map((t) => (
                  <TodoRow key={t.id} todo={t} onToggle={onToggle} onDelete={onDelete} />
                ))}

                {status.allDone ? (
                  <p className="font-poppins text-[var(--accent-2)] pt-1" style={{ fontSize: "14px", fontWeight: 600 }}>
                    All done — your partners have been cheered 🎉
                  </p>
                ) : isAfternoon ? (
                  <div
                    className="rounded-[var(--radius-sm)] px-3 py-2.5 mt-1"
                    style={{ background: "rgba(var(--accent-rgb),0.08)", border: "0.5px solid rgba(var(--accent-rgb),0.2)" }}
                  >
                    <span className="font-poppins text-[rgb(var(--fg-rgb))]" style={{ fontSize: "13px" }}>
                      You said you&apos;d do: {incomplete.map((t) => t.title).join(", ")}
                    </span>
                  </div>
                ) : null}
              </>
            )}
          </section>

          {/* Promote backlog items into today (only when there's room) */}
          {room > 0 && board.backlog.length > 0 && (
            <section className="flex flex-col gap-2">
              <span className="font-poppins font-medium uppercase text-[rgba(var(--fg-rgb),0.35)]" style={{ fontSize: "11px", letterSpacing: "0.14em" }}>
                Add from your list ({room} slot{room === 1 ? "" : "s"} left)
              </span>
              {board.backlog.filter((t) => !t.done).map((t) => {
                const checked = selected.has(t.id);
                const atCap = !checked && selected.size >= room;
                return (
                  <button
                    key={t.id}
                    type="button"
                    disabled={atCap}
                    onClick={() => { tap(); toggleSelect(t.id); }}
                    className="flex items-center gap-3 text-left disabled:opacity-40"
                  >
                    <SquareBox checked={checked} />
                    <span className="font-poppins text-[rgb(var(--fg-rgb))] truncate" style={{ fontSize: "15px" }}>
                      {t.title}
                    </span>
                  </button>
                );
              })}
              {selected.size > 0 && (
                <button
                  type="button"
                  onClick={() => { tap(); commitSelected(); }}
                  className="st-btn self-start mt-1 px-4 py-2 font-poppins"
                  style={{ background: "var(--accent)", color: "#fff", fontSize: "14px", fontWeight: 600 }}
                >
                  Add {selected.size} to today
                </button>
              )}
            </section>
          )}

          {/* Add a new todo */}
          <form onSubmit={handleSubmit(submitAdd)} className="flex flex-col gap-2">
            <div className="flex items-center gap-2">
              <input
                {...register("title")}
                placeholder="Add a todo…"
                autoComplete="off"
                className="st-field flex-1 bg-[var(--bg-surface)] text-[rgb(var(--fg-rgb))] px-4 py-3 outline-none border border-[rgba(var(--fg-rgb),0.1)] focus:border-[var(--accent)] placeholder:text-[rgba(var(--fg-rgb),0.25)]"
                style={{ fontSize: "15px" }}
              />
              <button
                type="submit"
                disabled={isSubmitting}
                aria-label="Add todo"
                className="st-btn flex items-center justify-center shrink-0 disabled:opacity-50"
                style={{ width: "46px", height: "46px", background: "var(--bg-surface)", border: "0.5px solid rgba(var(--fg-rgb),0.12)", color: "rgb(var(--fg-rgb))" }}
              >
                <Plus size={20} strokeWidth={2} />
              </button>
            </div>
            {room > 0 && (
              <button
                type="button"
                onClick={() => { tap(); setAddToToday((v) => !v); }}
                className="self-start flex items-center gap-2"
              >
                <SquareBox checked={addToToday} />
                <span className="font-poppins text-[rgba(var(--fg-rgb),0.55)]" style={{ fontSize: "13px" }}>
                  Add to today&apos;s plan
                </span>
              </button>
            )}
            {errors.title && (
              <span className="text-[var(--accent)]" style={{ fontSize: "13px" }}>{errors.title.message}</span>
            )}
          </form>

          {/* Remaining backlog (not in today's plan) */}
          {board.backlog.length > 0 && (
            <section className="flex flex-col gap-2">
              <span className="font-poppins font-medium uppercase text-[rgba(var(--fg-rgb),0.35)]" style={{ fontSize: "11px", letterSpacing: "0.14em" }}>
                Your list
              </span>
              {board.backlog.map((t) => (
                <TodoRow key={t.id} todo={t} onToggle={onToggle} onDelete={onDelete} />
              ))}
            </section>
          )}
        </div>
      </div>
    </div>
  );
}

/** A todo line with a complete toggle and a delete affordance. */
function TodoRow({
  todo,
  onToggle,
  onDelete,
}: {
  todo: Todo;
  onToggle: (t: Todo) => void;
  onDelete: (t: Todo) => void;
}) {
  return (
    <div className="flex items-center gap-3 group">
      <button
        type="button"
        onClick={() => { tap(); onToggle(todo); }}
        aria-label={todo.done ? "Mark not done" : "Mark done"}
        className="shrink-0"
      >
        <SquareBox checked={todo.done} />
      </button>
      <span
        className="font-poppins flex-1 truncate"
        style={{
          fontSize: "15px",
          color: todo.done ? "rgba(var(--fg-rgb),0.35)" : "rgb(var(--fg-rgb))",
          textDecoration: todo.done ? "line-through" : "none",
        }}
      >
        {todo.title}
      </span>
      <button
        type="button"
        onClick={() => { tap(); onDelete(todo); }}
        aria-label="Delete todo"
        className="shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"
        style={{ color: "rgba(var(--fg-rgb),0.35)" }}
      >
        <Trash2 size={16} strokeWidth={1.75} />
      </button>
    </div>
  );
}

/** A small checkbox square that fills with the accent when checked. */
function SquareBox({ checked }: { checked: boolean }) {
  return (
    <span
      className="flex items-center justify-center shrink-0"
      style={{
        width: "22px",
        height: "22px",
        borderRadius: "7px",
        border: checked ? "none" : "1.5px solid rgba(var(--fg-rgb),0.25)",
        background: checked ? "var(--accent)" : "transparent",
        transition: "background 160ms var(--ease)",
      }}
    >
      {checked && <Check size={15} strokeWidth={3} color="#fff" />}
    </span>
  );
}
