import {
  Globe,
  GraduationCap,
  Hammer,
  Sparkles,
  Dumbbell,
  Crown,
} from "lucide-react";
import type { RoomName } from "@/lib/firebase/rooms";

/** A lucide-style glyph component (size/strokeWidth/style props). */
type Glyph = (props: {
  size?: number;
  strokeWidth?: number;
  className?: string;
  style?: React.CSSProperties;
  "aria-hidden"?: boolean;
}) => React.ReactNode;

export interface RoomIdentity {
  /** Departure-board platform code shown in the corner / header. */
  code: string;
  /** Room glyph. */
  Icon: Glyph;
  /** Founding Cohort gets the brass-seal treatment. */
  sealed?: boolean;
}

/**
 * Per-room display identity for the network surfaces. Differentiation is by
 * glyph + platform code, never by hue — the locked palette keeps red as the
 * rare signal and brass as the ambient accent.
 */
export const ROOM_IDENTITY: Record<RoomName, RoomIdentity> = {
  collective: { code: "00", Icon: Globe },
  scholar: { code: "01", Icon: GraduationCap },
  builder: { code: "02", Icon: Hammer },
  creator: { code: "03", Icon: Sparkles },
  athlete: { code: "04", Icon: Dumbbell },
  founding: { code: "✦", Icon: Crown, sealed: true },
};
