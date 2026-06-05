"use client";

import { usePathname } from "next/navigation";
import BottomNav from "@/components/layout/BottomNav";
import type { User } from "@/types";

export default function PlatformShell({
  user,
  children,
}: {
  user: User;
  children: React.ReactNode;
}) {
  const pathname = usePathname();

  // Immersive full-height views (a chat room, a live work session) own their
  // own 100dvh scroll and have a back button. Hide the floating nav there so
  // it never covers their bottom input bars; the back button returns to a
  // station, where the nav reappears.
  const immersive =
    /\/network\/rooms\/[^/]+/.test(pathname) ||
    /\/work\/[^/]+/.test(pathname) ||
    /\/messages\/[^/]+/.test(pathname);

  return (
    <div className="min-h-screen">
      {/* Bottom padding clears the floating nav on normal scrollable pages. */}
      <main className={immersive ? "" : "pb-28"}>{children}</main>

      {!immersive && <BottomNav user={user} />}
    </div>
  );
}
