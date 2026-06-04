/**
 * Decorative dappled-foliage shadow. Pure SVG (a branch + leaf cluster) blurred
 * and rendered at very low opacity so it reads as soft light through leaves.
 * Uses currentColor → foreground, so it flips with the theme. Purely cosmetic:
 * aria-hidden + pointer-events: none.
 */
export default function LeafShadow({
  className = "",
  style,
}: {
  className?: string;
  style?: React.CSSProperties;
}) {
  return (
    <div
      aria-hidden
      className={`pointer-events-none select-none ${className}`}
      style={{
        position: "absolute",
        top: "-70px",
        right: "-50px",
        width: "560px",
        maxWidth: "70%",
        color: "rgb(var(--fg-rgb))",
        opacity: 0.05,
        filter: "blur(7px)",
        zIndex: 0,
        ...style,
      }}
    >
      <svg viewBox="0 0 520 380" width="100%" fill="currentColor">
        <defs>
          {/* A single pointed leaf, tip toward +x. */}
          <path id="leaf" d="M0 0 C10 -11 30 -11 42 0 C30 11 10 11 0 0 Z" />
        </defs>

        {/* Main stem */}
        <path
          d="M512 8 C 380 46 286 104 196 196 C 150 242 112 304 92 372"
          fill="none"
          stroke="currentColor"
          strokeWidth="3.5"
          strokeLinecap="round"
        />
        {/* Secondary stem */}
        <path
          d="M470 40 C 408 92 372 150 372 226"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
        />

        {/* Leaves along the stems */}
        <use href="#leaf" transform="translate(486,20) rotate(196) scale(1.15)" />
        <use href="#leaf" transform="translate(452,40) rotate(150) scale(1.35)" />
        <use href="#leaf" transform="translate(470,58) rotate(232) scale(1.1)" />
        <use href="#leaf" transform="translate(412,82) rotate(158) scale(1.45)" />
        <use href="#leaf" transform="translate(424,108) rotate(248) scale(1.2)" />
        <use href="#leaf" transform="translate(366,128) rotate(168) scale(1.5)" />
        <use href="#leaf" transform="translate(384,158) rotate(258) scale(1.25)" />
        <use href="#leaf" transform="translate(312,176) rotate(176) scale(1.55)" />
        <use href="#leaf" transform="translate(332,206) rotate(266) scale(1.3)" />
        <use href="#leaf" transform="translate(258,224) rotate(186) scale(1.5)" />
        <use href="#leaf" transform="translate(276,256) rotate(272) scale(1.25)" />
        <use href="#leaf" transform="translate(206,272) rotate(196) scale(1.4)" />
        <use href="#leaf" transform="translate(222,304) rotate(280) scale(1.15)" />
        <use href="#leaf" transform="translate(150,318) rotate(206) scale(1.3)" />
        {/* Secondary-stem leaves */}
        <use href="#leaf" transform="translate(446,70) rotate(120) scale(1.2)" />
        <use href="#leaf" transform="translate(404,128) rotate(128) scale(1.3)" />
        <use href="#leaf" transform="translate(382,186) rotate(136) scale(1.2)" />
      </svg>
    </div>
  );
}
