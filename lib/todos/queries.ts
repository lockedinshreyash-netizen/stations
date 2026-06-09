"use client";

import { createClient } from "@/lib/supabase/client";
import { DAILY_PLAN_LIMIT } from "@/lib/validations/todos";
import type {
  PartnerTodo,
  Todo,
  TodoBoard,
  TodayPlanStatus,
} from "@/types";

/**
 * "Today" as a UTC date string (YYYY-MM-DD). We deliberately use UTC so it
 * matches the database's `current_date` (Supabase runs in UTC), which is what
 * get_partner_today_plan() and the completion resolver compare against. This
 * keeps the owner's view, a partner's view, and the completion push all in
 * agreement on which todos count as "today". Per-user timezones are a V2 item.
 */
export function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

/** Compute today's progress from the day's committed todos. */
export function planStatus(today: Todo[]): TodayPlanStatus {
  const completed = today.filter((t) => t.done).length;
  return {
    total: today.length,
    completed,
    allDone: today.length > 0 && completed === today.length,
  };
}

/** Every todo the caller owns, split into today's plan vs. the backlog. */
export async function listTodos(selfId: string): Promise<TodoBoard> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("todos")
    .select("*")
    .eq("user_id", selfId)
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);

  const all = (data as Todo[]) ?? [];
  const today = todayISO();
  return {
    today: all.filter((t) => t.planned_for === today),
    backlog: all.filter((t) => t.planned_for !== today),
  };
}

/** Add a new todo. Optionally commit it straight into today's plan. */
export async function createTodo(
  selfId: string,
  title: string,
  opts: { planForToday?: boolean } = {}
): Promise<Todo> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("todos")
    .insert({
      user_id: selfId,
      title: title.trim().slice(0, 200),
      planned_for: opts.planForToday ? todayISO() : null,
    })
    .select("*")
    .single();
  if (error) throw new Error(error.message);
  return data as Todo;
}

/** Toggle a todo's done state, stamping completed_at accordingly. */
export async function toggleTodo(id: string, done: boolean): Promise<Todo> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("todos")
    .update({
      done,
      completed_at: done ? new Date().toISOString() : null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .select("*")
    .single();
  if (error) throw new Error(error.message);
  return data as Todo;
}

/** Move a todo into (planned=true) or out of (planned=false) today's plan. */
export async function setPlannedForToday(
  id: string,
  planned: boolean
): Promise<Todo> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("todos")
    .update({
      planned_for: planned ? todayISO() : null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .select("*")
    .single();
  if (error) throw new Error(error.message);
  return data as Todo;
}

/** Commit a set of existing todos to today's plan (capped at the daily limit). */
export async function planTodosForToday(ids: string[]): Promise<void> {
  const capped = ids.slice(0, DAILY_PLAN_LIMIT);
  if (capped.length === 0) return;
  const supabase = createClient();
  const { error } = await supabase
    .from("todos")
    .update({ planned_for: todayISO(), updated_at: new Date().toISOString() })
    .in("id", capped);
  if (error) throw new Error(error.message);
}

/** Permanently delete a todo. */
export async function deleteTodo(id: string): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase.from("todos").delete().eq("id", id);
  if (error) throw new Error(error.message);
}

/**
 * A partner's daily plan + completion status. Authorized in the database by
 * get_partner_today_plan(), which raises if the two aren't accepted partners.
 */
export async function getPartnerTodayPlan(
  partnerId: string
): Promise<PartnerTodo[]> {
  const supabase = createClient();
  const { data, error } = await supabase.rpc("get_partner_today_plan", {
    partner_id: partnerId,
  });
  if (error) throw new Error(error.message);
  return (data as PartnerTodo[]) ?? [];
}
