"use client";

import { usePathname } from "next/navigation";
import BottomNav from "@/components/layout/BottomNav";
import TodoFab from "@/components/todos/TodoFab";
import AnnouncementBell from "@/components/announcements/AnnouncementBell";
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
      {/* Liquid-glass refraction filter. feTurbulence models the uneven glass
          surface; feDisplacementMap bends the backdrop through it the way light
          refracts through real glass. Referenced by .st-liquid's backdrop-filter.
          Mounted once, globally, since SVG filter ids are document-scoped. */}
      <svg
        aria-hidden
        width="0"
        height="0"
        style={{ position: "absolute", width: 0, height: 0, pointerEvents: "none" }}
      >
        <filter
          id="liquid-glass"
          x="-35%"
          y="-35%"
          width="170%"
          height="170%"
          colorInterpolationFilters="sRGB"
        >
          {/* Static water surface — anisotropic (wider horizontal waves).
              Static on purpose: animating baseFrequency re-rasterises the
              backdrop every frame, which makes a backdrop-filter'd bar janky on
              real devices. A strong static displacement already reads as liquid. */}
          <feTurbulence
            type="fractalNoise"
            baseFrequency="0.007 0.013"
            numOctaves="2"
            seed="17"
            result="noise"
          />
          <feGaussianBlur in="noise" stdDeviation="0.8" result="surface" />
          {/* Refract the backdrop through that surface — the actual lensing.
              Strong scale so the bend is unmistakably liquid. */}
          <feDisplacementMap
            in="SourceGraphic"
            in2="surface"
            scale="58"
            xChannelSelector="R"
            yChannelSelector="G"
            result="refracted"
          />
          {/* Light frost + richer colour on the refracted light (baked in so the
              CSS rule can use url() alone — chaining url() with blur()/saturate()
              makes Chromium discard the whole backdrop-filter). */}
          <feGaussianBlur in="refracted" stdDeviation="1.2" result="frosted" />
          <feColorMatrix in="frosted" type="saturate" values="1.7" />
        </filter>
      </svg>

      {/* Global announcement bell — top-right, hidden on immersive views (which
          own their full-height layout + back button), matching the bottom dock. */}
      {!immersive && <AnnouncementBell user={user} />}

      {/* Bottom padding clears the floating nav on normal scrollable pages. */}
      <main className={immersive ? "" : "pb-28"}>{children}</main>

      {/* Floating dock — the SINGLE positioning parent for the bottom chrome.
          The todo widget and the navbar are stacked here and centred together,
          so the widget is anchored to the navbar rather than to the viewport.
          The container is pointer-events-none (it spans the full width) while
          each interactive child re-enables pointer events; pop-ups (todo panel,
          profile) portal to <body>, so they aren't constrained by this dock. */}
      {!immersive && (
        <div
          className="fixed left-1/2 z-40 flex flex-col items-end gap-3 pointer-events-none"
          style={{
            bottom: "calc(16px + env(safe-area-inset-bottom))",
            // Centre the dock on the navbar's width, then right-align the column
            // so the todo widget pins to the navbar's RIGHT edge (not the
            // viewport edge) and the two move together.
            transform: "translateX(-50%)",
            maxWidth: "calc(100vw - 24px)",
          }}
        >
          <TodoFab user={user} />
          <BottomNav user={user} />
        </div>
      )}
    </div>
  );
}
