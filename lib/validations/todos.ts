import { z } from "zod";

/** A single todo. Mirrors the DB check constraint (1–200 chars). */
export const todoSchema = z.object({
  title: z
    .string()
    .trim()
    .min(1, "Write something to do")
    .max(200, "Keep it under 200 characters"),
});

export type TodoData = z.infer<typeof todoSchema>;

/** How many todos a member may commit to in a single day's plan. */
export const DAILY_PLAN_LIMIT = 3;
