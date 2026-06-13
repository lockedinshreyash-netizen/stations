"use client";

import { useCallback, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { ListChecks } from "lucide-react";
import { tap } from "@/lib/feedback";
import { fireCelebration } from "@/lib/celebrate";
import { notifyDailyComplete } from "@/lib/push/client";
import {
  createTodo,
  deleteTodo,
  listTodos,
  planStatus,
  planTodosForToday,
  toggleTodo,
} from "@/lib/todos/queries";
import type { Todo, TodoBoard, User } from "@/types";
import TodoPanel from "./TodoPanel";

/**
 * Global floating todo button. Lives on every non-immersive page (mounted by
 * PlatformShell, next to the bottom nav). It owns the todo board state so the
 * pill can show daily progress, and it detects the moment the day's plan is
 * fully completed to fire the celebration + notify the user's partners.
 */
export default function TodoFab({ user }: { user: User }) {
  const [board, setBoard] = useState<TodoBoard | null>(null);
  const [open, setOpen] = useState(false);

  const refresh = useCallback(async () => {
    try {
      setBoard(await listTodos(user.id));
    } catch {
      /* keep last good state */
    }
  }, [user.id]);

  useEffect(() => {
    // Initial load on mount. setState runs after the fetch resolves (async), so
    // this doesn't trigger the synchronous cascading renders the rule guards against.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    refresh();
  }, [refresh]);

  const status = board ? planStatus(board.today) : null;

  async function handleToggle(todo: Todo) {
    const wasAllDone = board ? planStatus(board.today).allDone : false;
    try {
      await toggleTodo(todo.id, !todo.done);
      const next = await listTodos(user.id);
      setBoard(next);
      // Celebrate + ping partners only on the transition INTO a fully-done plan.
      if (!wasAllDone && planStatus(next.today).allDone) {
        fireCelebration();
        notifyDailyComplete();
      }
    } catch {
      /* ignore */
    }
  }

  async function handleAdd(title: string, planForToday: boolean) {
    await createTodo(user.id, title, { planForToday });
    await refresh();
  }

  async function handlePlanToday(ids: string[]) {
    await planTodosForToday(ids);
    await refresh();
  }

  async function handleDelete(todo: Todo) {
    await deleteTodo(todo.id);
    await refresh();
  }

  return (
    <>
      <button
        type="button"
        onClick={() => { tap(); setOpen(true); }}
        aria-label="Todos"
        title="Todos"
        className="st-liquid pointer-events-auto relative flex items-center justify-center"
        style={{
          width: "52px",
          height: "52px",
          borderRadius: "9999px",
          color: "rgb(var(--fg-rgb))",
        }}
      >
        <ListChecks size={22} strokeWidth={1.75} />
        {status && status.total > 0 && (
          <span
            aria-label={`${status.completed} of ${status.total} done`}
            className="absolute font-poppins flex items-center justify-center"
            style={{
              top: "-5px",
              right: "-5px",
              minWidth: "20px",
              height: "20px",
              padding: "0 5px",
              borderRadius: "9999px",
              fontSize: "11px",
              fontWeight: 700,
              color: "#fff",
              background: status.allDone ? "var(--accent-2)" : "var(--accent)",
              boxShadow: "0 0 0 1.5px var(--glass-bg)",
            }}
          >
            {status.completed}/{status.total}
          </span>
        )}
      </button>

      {open && board && createPortal(
        <TodoPanel
          board={board}
          onClose={() => setOpen(false)}
          onToggle={handleToggle}
          onAdd={handleAdd}
          onPlanToday={handlePlanToday}
          onDelete={handleDelete}
        />,
        document.body,
      )}
    </>
  );
}
