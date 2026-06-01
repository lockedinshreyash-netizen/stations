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
  bio: string | null;
  status: UserStatus;
  membership_tier: MembershipTier;
  is_admin: boolean;
  total_focus_minutes: number;
  total_sessions: number;
  streak_days: number;
  last_active_at: string | null;
  created_at: string;
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
