"use client";

import { useEffect, useRef } from "react";
import { CELEBRATE_EVENT } from "@/lib/celebrate";
import { celebrate as celebrateSound } from "@/lib/feedback";

/**
 * Full-screen party-popper confetti, rendered to a canvas so hundreds of
 * pieces stay smooth. Two poppers fire inward from the bottom corners in
 * silver and gold, arc up under gravity, spin, and fade. Triggered by the
 * global CELEBRATE_EVENT; also plays the matching cheerful sound + haptic.
 */

type Piece = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  rot: number;
  vr: number;
  size: number;
  color: string;
  shape: "rect" | "circ";
  life: number;
  ttl: number;
};

const GOLD = ["#d4af37", "#f5d77a", "#caa64b", "#ffe9a8"];
const SILVER = ["#c0c0c0", "#e8e8e8", "#a8a8a8", "#f4f4f4"];

export default function Celebration() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const piecesRef = useRef<Piece[]>([]);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    const canvasEl = canvasRef.current;
    if (!canvasEl) return;
    const ctxMaybe = canvasEl.getContext("2d");
    if (!ctxMaybe) return;
    // Fresh non-null consts so the nested rAF closures keep the narrowed type.
    const canvas = canvasEl;
    const ctx = ctxMaybe;

    const reduce = window.matchMedia?.(
      "(prefers-reduced-motion: reduce)"
    ).matches;

    function resize() {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = window.innerWidth * dpr;
      canvas.height = window.innerHeight * dpr;
      canvas.style.width = window.innerWidth + "px";
      canvas.style.height = window.innerHeight + "px";
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }
    resize();
    window.addEventListener("resize", resize);

    function burst() {
      const W = window.innerWidth;
      const H = window.innerHeight;
      const count = reduce ? 40 : 130;
      const pieces = piecesRef.current;
      // Two poppers: bottom-left aims up-right, bottom-right aims up-left.
      for (let side = 0; side < 2; side++) {
        const originX = side === 0 ? 0 : W;
        const originY = H;
        const baseAngle = side === 0 ? -Math.PI / 3.2 : -Math.PI + Math.PI / 3.2;
        for (let i = 0; i < count / 2; i++) {
          const spread = (Math.random() - 0.5) * 0.9;
          const angle = baseAngle + spread;
          const speed = 9 + Math.random() * 13;
          const palette = Math.random() > 0.5 ? GOLD : SILVER;
          pieces.push({
            x: originX,
            y: originY,
            vx: Math.cos(angle) * speed,
            vy: Math.sin(angle) * speed,
            rot: Math.random() * Math.PI * 2,
            vr: (Math.random() - 0.5) * 0.4,
            size: 6 + Math.random() * 7,
            color: palette[(Math.random() * palette.length) | 0],
            shape: Math.random() > 0.35 ? "rect" : "circ",
            life: 0,
            ttl: 90 + Math.random() * 50,
          });
        }
      }
      if (rafRef.current == null) loop();
    }

    function loop() {
      const pieces = piecesRef.current;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      for (let i = pieces.length - 1; i >= 0; i--) {
        const p = pieces[i];
        p.life++;
        p.vy += 0.28; // gravity
        p.vx *= 0.99; // drag
        p.vy *= 0.99;
        p.x += p.vx;
        p.y += p.vy;
        p.rot += p.vr;
        const fade = Math.max(0, 1 - p.life / p.ttl);
        if (fade <= 0 || p.y > window.innerHeight + 40) {
          pieces.splice(i, 1);
          continue;
        }
        ctx.save();
        ctx.globalAlpha = fade;
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rot);
        ctx.fillStyle = p.color;
        if (p.shape === "rect") {
          ctx.fillRect(-p.size / 2, -p.size / 4, p.size, p.size / 2);
        } else {
          ctx.beginPath();
          ctx.arc(0, 0, p.size / 2, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.restore();
      }
      if (pieces.length > 0) {
        rafRef.current = requestAnimationFrame(loop);
      } else {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        rafRef.current = null;
      }
    }

    function onCelebrate() {
      celebrateSound();
      burst();
    }

    window.addEventListener(CELEBRATE_EVENT, onCelebrate);
    return () => {
      window.removeEventListener(CELEBRATE_EVENT, onCelebrate);
      window.removeEventListener("resize", resize);
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 9996,
        pointerEvents: "none",
      }}
    />
  );
}
