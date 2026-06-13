"use client";

import { usePathname } from "next/navigation";
import BottomNav from "@/components/layout/BottomNav";
import TodoFab from "@/components/todos/TodoFab";
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
          {/* Rippling water surface — anisotropic (wider horizontal waves) and
              slowly animated so the distortion flows like real water. */}
          <feTurbulence
            type="fractalNoise"
            baseFrequency="0.007 0.013"
            numOctaves="2"
            seed="17"
            result="noise"
          >
            <animate
              attributeName="baseFrequency"
              dur="20s"
              values="0.007 0.013; 0.010 0.010; 0.007 0.013"
              repeatCount="indefinite"
            />
          </feTurbulence>
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
          className="fixed inset-x-0 z-40 flex flex-col items-center gap-3 px-3 pointer-events-none"
          style={{ bottom: "calc(16px + env(safe-area-inset-bottom))" }}
        >
          <TodoFab user={user} />
          <BottomNav user={user} />
        </div>
      )}
    </div>
  );
}
