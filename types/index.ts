export type MembershipTier = "founding" | "paid" | "free";
export type UserRole =
  | "student"
  | "founder"
  | "creator"
  | "developer"
  | "designer"
  | "athlete"
  | "other";
export type UserCategory =
  | "Scholar"
  | "Builder"
  | "Creator"
  | "Athlete"
  | "Grinder";
export type UserStatus = "pending" | "active" | "suspended";
export type ApplicationStatus = "pending" | "approved" | "rejected";
export type SessionType = "study" | "work" | "build" | "focus";
export type SessionStation = "work" | "focus";
export type SessionStatus = "waiting" | "active" | "ended";
export type WinCategory =
  | "startup"
  | "project"
  | "fitness"
  | "exam"
  | "personal"
  | "other";

export type ReactionType = "respect" | "fire" | "build" | "focused" | "strong";

export interface ReactionCounts {
  respect: number;
  fire: number;
  build: number;
  focused: number;
  strong: number;
}
export type BuildStage = "idea" | "building" | "launched";
export type ChallengeType = "weekly" | "monthly";
export type ChallengeMetric =
  | "focus_minutes"
  | "sessions_completed"
  | "wins_posted"
  | "streak_days";

export interface User {
  id: string;
  username: string;
  full_name: string;
  avatar_url: string | null;
  role: UserRole;
  goals: string[];
  category: UserCategory;
  room_memberships: string[];
  bio: string | null;
  status: UserStatus;
  membership_tier: MembershipTier;
  // Permanent Founding Cohort number (#1…#100). Null for everyone else.
  founder_number: number | null;
  is_admin: boolean;
  total_focus_minutes: number;
  total_sessions: number;
  streak_days: number;
  // Work station (04) focus stats — added by supabase/work_sessions.sql
  total_focus_hours: number;
  total_sessions_completed: number;
  focus_streak_days: number;
  last_focus_session_date: string | null;
  last_active_at: string | null;
  created_at: string;
}

// ============================================================
// WORK STATION (04) — scheduled co-working sessions
// ============================================================
export type WorkCategory = "scholar" | "builder" | "creator" | "athlete";
export type WorkSessionStatus =
  | "scheduled"
  | "active"
  | "completed"
  | "cancelled";

export interface WorkSession {
  id: string;
  host_id: string;
  title: string;
  category: WorkCategory;
  duration_minutes: number;
  scheduled_start_time: string;
  scheduled_end_time: string;
  actual_start_time: string | null;
  actual_end_time: string | null;
  status: WorkSessionStatus;
  chat_closed: boolean;
  created_at: string;
}

export interface WorkSessionMember {
  id: string;
  session_id: string;
  user_id: string;
  joined_at: string;
  left_early: boolean;
  leave_reason: string | null;
  left_at: string | null;
  focus_quality_rating: number | null;
}

/** A session row enriched with its live member count + host display info. */
export interface WorkSessionWithMeta extends WorkSession {
  member_count: number;
  host_username: string;
  host_avatar_url: string | null;
  host_founder_number: number | null;
}

// ============================================================
// ARCHIVE STATION (03) — courses (Mux video) + progress
// supabase/archive.sql
// ============================================================
export type CourseStatus = "draft" | "published" | "archived";
export type LessonStatus =
  | "awaiting_upload"
  | "processing"
  | "ready"
  | "errored";

export interface ArchiveCourse {
  id: string;
  title: string;
  subtitle: string | null;
  description: string | null;
  instructor_name: string;
  instructor_title: string | null;
  instructor_avatar_url: string | null;
  instructor_user_id: string | null;
  thumbnail_url: string | null;
  topic: string | null;
  status: CourseStatus;
  sort_order: number;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface ArchiveLesson {
  id: string;
  course_id: string;
  title: string;
  description: string | null;
  order_index: number;
  mux_upload_id: string | null;
  mux_asset_id: string | null;
  mux_playback_id: string | null;
  duration_seconds: number | null;
  status: LessonStatus;
  created_at: string;
}

export interface ArchiveLessonProgress {
  id: string;
  user_id: string;
  lesson_id: string;
  completed: boolean;
  last_position_seconds: number;
  updated_at: string;
}

/**
 * A course enriched for the catalog: lesson count, total runtime, and the
 * caller's progress. `progress_percent` is 0–100 (rounded), 0 when no progress.
 */
export interface ArchiveCourseWithMeta extends ArchiveCourse {
  lesson_count: number;
  total_duration_seconds: number;
  completed_lessons: number;
  progress_percent: number;
}

// ============================================================
// DIRECT MESSAGES (private 1:1) — supabase/direct_messages.sql
// ============================================================
export interface DirectMessage {
  id: string;
  conversation_id: string;
  sender_id: string;
  content: string;
  created_at: string;
  read_at: string | null;
  edited_at: string | null;
}

/** Minimal public profile of the other person in a conversation. */
export interface DmParticipant {
  id: string;
  username: string;
  avatar_url: string | null;
  founder_number: number | null;
}

/** A conversation row enriched with the other participant + preview, for the inbox. */
export interface ConversationSummary {
  id: string;
  last_message_at: string;
  other: DmParticipant;
  last_message: string | null;
  unread: boolean;
}

export interface Application {
  id: string;
  user_id: string;
  why_join: string;
  goals_declaration: string;
  role: string;
  status: ApplicationStatus;
  reviewed_by: string | null;
  reviewed_at: string | null;
  created_at: string;
}

export interface Session {
  id: string;
  title: string;
  type: SessionType;
  host_id: string;
  station: SessionStation;
  status: SessionStatus;
  chat_locked: boolean;
  started_at: string | null;
  ended_at: string | null;
  created_at: string;
}

export interface SessionParticipant {
  id: string;
  session_id: string;
  user_id: string;
  joined_at: string;
  left_at: string | null;
  duration_minutes: number | null;
}

export interface Win {
  id: string;
  user_id: string;
  title: string;
  description: string;
  category: WinCategory;
  media_url: string | null;
  reactions_count: number;
  reaction_counts: ReactionCounts | null;
  created_at: string;
}

export interface WinReaction {
  id: string;
  win_id: string;
  user_id: string;
  reaction_type: ReactionType;
  created_at: string;
}

export interface Build {
  id: string;
  user_id: string;
  name: string;
  description: string;
  stage: BuildStage;
  looking_for: string | null;
  is_looking: boolean;
  tags: string[];
  url: string | null;
  created_at: string;
  updated_at: string;
}

export interface Challenge {
  id: string;
  title: string;
  description: string;
  type: ChallengeType;
  category: string | null;
  metric: ChallengeMetric;
  target_value: number;
  starts_at: string;
  ends_at: string;
  created_by: string;
  created_at: string;
}

export interface ChallengeParticipant {
  id: string;
  challenge_id: string;
  user_id: string;
  current_value: number;
  completed: boolean;
  joined_at: string;
}

export interface Message {
  id: string;
  session_id: string;
  user_id: string;
  content: string;
  created_at: string;
}

// ============================================================
// TODOS + DAILY "3 THINGS" PLAN — supabase/todos.sql
// ============================================================
export interface Todo {
  id: string;
  user_id: string;
  title: string;
  done: boolean;
  completed_at: string | null;
  // null = backlog; an ISO date (YYYY-MM-DD) = committed to that day's plan.
  planned_for: string | null;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

/** The caller's todos split into today's committed plan vs. the backlog. */
export interface TodoBoard {
  today: Todo[];
  backlog: Todo[];
}

/** Progress summary for today's daily plan. */
export interface TodayPlanStatus {
  total: number;
  completed: number;
  allDone: boolean;
}

/** A single item of a partner's daily plan (no ids leak beyond what's needed). */
export interface PartnerTodo {
  id: string;
  title: string;
  done: boolean;
}

// ============================================================
// ACCOUNTABILITY PARTNERS (1:1) — supabase/partnerships.sql
// ============================================================
export type PartnershipStatus = "pending" | "accepted" | "declined";

export interface Partnership {
  id: string;
  requester_id: string;
  addressee_id: string;
  status: PartnershipStatus;
  created_at: string;
  responded_at: string | null;
}

/** An accepted partner, enriched with their public profile, for the inbox. */
export interface PartnerSummary {
  partnership_id: string;
  partner: DmParticipant;
}

/** An incoming pending request, enriched with the requester's profile. */
export interface PartnerRequest {
  partnership_id: string;
  from: DmParticipant;
  created_at: string;
}
