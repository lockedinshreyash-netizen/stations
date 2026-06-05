/**
 * Open the global read-only user profile card. Decoupled via a window event so
 * any username/avatar anywhere can open it with just an onClick — the single
 * <UserProfileModal/> mounted in the root layout fetches + renders.
 */
export const PROFILE_EVENT = "stations:profile";

export function openUserProfile(userId: string): void {
  if (typeof window === "undefined" || !userId) return;
  window.dispatchEvent(new CustomEvent(PROFILE_EVENT, { detail: { userId } }));
}
