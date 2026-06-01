import { z } from "zod";

export const step1Schema = z.object({
  email: z.string().email("Invalid email address"),
  password: z.string().min(8, "Password must be at least 8 characters"),
});

export const step2Schema = z.object({
  full_name: z.string().min(2, "Full name is required"),
  username: z
    .string()
    .min(3, "Username must be at least 3 characters")
    .max(20, "Username must be under 20 characters")
    .regex(/^[a-z0-9_]+$/, "Lowercase letters, numbers, and underscores only"),
});

const roleEnum = z.enum([
  "student",
  "founder",
  "creator",
  "developer",
  "designer",
  "athlete",
  "other",
]);

const goalEnum = z.enum([
  "academic excellence",
  "build a product",
  "grow an audience",
  "get fit",
  "land a job",
  "learn a skill",
  "ship a project",
  "other",
]);

export const step3Schema = z.object({
  roles: z
    .array(roleEnum)
    .min(1, "Select at least one role")
    .max(3, "Maximum 3 roles"),
  goals: z
    .array(goalEnum)
    .min(1, "Select at least one goal")
    .max(5, "Maximum 5 goals"),
  availability: z.enum(["1–2 hrs/day", "2–4 hrs/day", "4+ hrs/day"]),
});

export const step4Schema = z.object({
  why_join: z.string().min(50, "Please write at least 50 characters"),
});

export type Step1Data = z.infer<typeof step1Schema>;
export type Step2Data = z.infer<typeof step2Schema>;
export type Step3Data = z.infer<typeof step3Schema>;
export type Step4Data = z.infer<typeof step4Schema>;
