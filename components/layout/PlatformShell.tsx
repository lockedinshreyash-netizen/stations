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
          {/* Uneven glass surface */}
          <feTurbulence
            type="fractalNoise"
            baseFrequency="0.011 0.015"
            numOctaves="2"
            seed="17"
            result="noise"
          />
          <feGaussianBlur in="noise" stdDeviation="1.1" result="surface" />
          {/* Refract the backdrop through that surface — the actual lensing */}
          <feDisplacementMap
            in="SourceGraphic"
            in2="surface"
            scale="48"
            xChannelSelector="R"
            yChannelSelector="G"
            result="refracted"
          />
          {/* Frost + richen the refracted light (baked in so the CSS rule can
              use url() alone — chaining url() with blur()/saturate() makes
              Chromium discard the whole backdrop-filter). */}
          <feGaussianBlur in="refracted" stdDeviation="1.6" result="frosted" />
          <feColorMatrix in="frosted" type="saturate" values="1.8" />
        </filter>
      </svg>

      {/* Bottom padding clears the floating nav on normal scrollable pages. */}
      <main className={immersive ? "" : "pb-28"}>{children}</main>

      {!immersive && <TodoFab user={user} />}
      {!immersive && <BottomNav user={user} />}
    </div>
  );
}
