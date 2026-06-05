import { isToday, isYesterday, format } from "date-fns";

/**
 * WhatsApp-style day label for chat date separators:
 *   today      → "Today"
 *   yesterday  → "Yesterday"
 *   this year  → "Thursday, 19/07"
 *   older      → "Thursday, 19/07/2024"
 */
export function dayLabel(date: Date): string {
  if (isToday(date)) return "Today";
  if (isYesterday(date)) return "Yesterday";
  const sameYear = date.getFullYear() === new Date().getFullYear();
  return format(date, sameYear ? "EEEE, dd/MM" : "EEEE, dd/MM/yyyy");
}
