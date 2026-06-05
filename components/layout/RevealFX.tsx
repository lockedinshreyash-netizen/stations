"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

/**
 * Scroll reveal: elements marked `[data-reveal]` fade in as they enter the
 * viewport. Fail-OPEN by design — an element is only hidden once we've "armed"
 * it (added .st-armed); if this never runs, content stays visible.
 *
 * Robust to streamed/async content: a MutationObserver arms cards that mount
 * after the initial scan (e.g. the wins feed appearing after its loading state).
 */
export default function RevealFX() {
  const pathname = usePathname();

  useEffect(() => {
    const reduce = window.matchMedia?.(
      "(prefers-reduced-motion: reduce)"
    ).matches;

    const io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            entry.target.classList.add("st-in");
            io.unobserve(entry.target);
          }
        }
      },
      { rootMargin: "0px 0px -8% 0px", threshold: 0.04 }
    );

    const armed = new WeakSet<Element>();
    function arm(el: Element) {
      if (armed.has(el)) return;
      armed.add(el);
      if (reduce) return; // leave visible
      const r = el.getBoundingClientRect();
      // Already in view (or above) → leave visible. Off-screen → hide + observe.
      if (r.top < window.innerHeight && r.bottom > 0) return;
      el.classList.add("st-armed");
      io.observe(el);
    }

    const scan = () =>
      document.querySelectorAll("[data-reveal]").forEach(arm);
    // Initial scan next frame, then keep catching newly-mounted nodes.
    const raf = requestAnimationFrame(scan);

    const mo = new MutationObserver((muts) => {
      for (const m of muts) {
        for (const node of m.addedNodes) {
          if (!(node instanceof Element)) continue;
          if (node.matches("[data-reveal]")) arm(node);
          node.querySelectorAll?.("[data-reveal]").forEach(arm);
        }
      }
    });
    mo.observe(document.body, { childList: true, subtree: true });

    return () => {
      cancelAnimationFrame(raf);
      io.disconnect();
      mo.disconnect();
    };
  }, [pathname]);

  return null;
}
