"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

/**
 * Scroll reveal: any element marked `[data-reveal]` fades in as it enters the
 * viewport (CSS adds the opacity transition; we just toggle `.st-in`). One
 * shared IntersectionObserver. Re-scans on navigation since the feed remounts.
 */
export default function RevealFX() {
  const pathname = usePathname();

  useEffect(() => {
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) {
      document
        .querySelectorAll("[data-reveal]")
        .forEach((el) => el.classList.add("st-in"));
      return;
    }

    const io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            entry.target.classList.add("st-in");
            io.unobserve(entry.target);
          }
        }
      },
      { rootMargin: "0px 0px -8% 0px", threshold: 0.05 }
    );

    // Defer a tick so freshly-navigated content is in the DOM.
    const id = requestAnimationFrame(() => {
      document.querySelectorAll("[data-reveal]:not(.st-in)").forEach((el) => {
        const r = el.getBoundingClientRect();
        // Anything already on-screen at mount reveals immediately (no flash).
        if (r.top < window.innerHeight) el.classList.add("st-in");
        else io.observe(el);
      });
    });

    return () => {
      cancelAnimationFrame(id);
      io.disconnect();
    };
  }, [pathname]);

  return null;
}
