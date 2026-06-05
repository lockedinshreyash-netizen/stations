# Stations — Design Direction v1 ("The Terminal")

> Goal: not "modern dashboard." A place. An institution with a pulse.
> North star: a user screenshots a single moment and sends it to a friend unprompted.

---

## 0. The concept — *The Terminal*

Stations is a transit terminal for ambition. Every surface borrows the visual
language of departure halls and Solari boards: split-flap numerals, platform
numbers, monospace status tickers, "now departing" framing. This is the single
ownable idea — no productivity/social app lives here. Everything below serves it.

Three words to hold the line: **Editorial · Kinetic · Atmospheric.**

---

## 1. Palette — evolve, don't replace

Keep the bones (they're good), add depth + a second accent so red can breathe.

| Token | Now | Direction | Why |
|---|---|---|---|
| `--bg-primary` | `#0a0a0a` | keep, but **never flat** — always under grain + a light source | flat black = lifeless |
| `--fg-rgb` | `240,235,224` (cream) | keep | the warmth is your secret weapon |
| `--accent` | `#c0392b` brick red | keep as the *signal* color (rare, loud) | scarcity = impact |
| `--accent-2` (new) | — | `#d9c7a3` muted brass/amber | the "lit board" glow; pairs with terminal motif |
| `--grain` (new) | — | SVG fractal-noise overlay @ 3–5% opacity | kills the dead-field feeling |
| `--halo` (new) | — | radial `rgba(217,199,163,0.06)` top-left | a light source in the room |

**Rule:** red is a *verb* (post, live, streak-on-fire), brass is *ambient* (lit
numbers, hairlines, "departing" labels). Cream is the voice. Black is the room.

---

## 2. Atmosphere layer (single biggest win, lowest effort)

Applied globally, above bg, below content:

1. **Grain** — fixed full-viewport SVG `feTurbulence` (baseFrequency ~0.9),
   `opacity: 0.035`, `mix-blend-mode: overlay`, `pointer-events: none`.
2. **Light source** — a fixed radial-gradient halo top-left, ~`0.06` brass.
3. **Vignette** — faint inset radial darkening at the edges, ~`0.25` black.

That trio alone moves the app from "void" to "room." Do this first.

---

## 3. Type — make it move

You already go huge (`clamp(48px,12vw,140px)` Poppins Black). Keep, and add:

- **Display:** Poppins Black, uppercase, tight `letter-spacing: -0.02em` for
  headlines (currently `+0.03em` — go negative for tension at large sizes).
- **Editorial:** Playfair italic — drop caps, issue numbers, footnotes.
- **Terminal (NEW):** a monospace (e.g. `Geist Mono` / `JetBrains Mono`) for
  all numerals, statuses, timestamps, platform tags. This is what sells the motif.
- **Kinetic rule:** headline numerals never just appear — they **flip in**
  (split-flap) or count up with spring. Words stagger in 30ms apart.

---

## 4. Motion language — the spine

Replace the uniform `200–300ms ease` with a tiered, intentional system.

| Role | Easing | Duration | Use |
|---|---|---|---|
| Micro (hover/press) | `cubic-bezier(0.2,0,0,1)` | 120ms | buttons, pills |
| Standard | spring `stiffness 260, damping 30` | ~350ms | cards, panels |
| Entrance | spring + 30ms stagger | 400–700ms | page/content reveal |
| Flip (Solari) | stepped, per-flap | 60ms/flap | numerals, stats |
| Page change | **View Transitions API** | 350ms cross-fade + slide | route nav |

Principles: **stagger over simultaneous; spring over ease; choreograph entrances.**
Respect `prefers-reduced-motion` (you already scaffold this).

Library: **Motion** (`motion`, the Framer successor) for springs + layout; native
View Transitions for routes.

---

## 5. Signature components

1. **SplitFlapNumber** — the hero. Solari-board digit that flips to its value.
   Used for: focus hours, streak, sessions, win counts, session timer.
   - Variants: `size` (sm ticker / xl hero), `flip on mount` + `flip on change`.
2. **DepartureRow** — monospace status line: `PLATFORM 04 · NOW DEPARTING · WORK SESSION · 25:00`.
   Used in /home, /work as the "what's live" strip.
3. **InkButton** — red bleeds outward from cursor on hover; press = haptic + soft chime.
4. **GrainField / Halo** — the atmosphere primitives (Section 2).
5. **KineticHeadline** — the giant username/section titles, weight + offset animate in.

---

## 6. Page applications

- **/home** → the arrivals hall. KineticHeadline name, a DepartureRow strip,
  stats as a row of SplitFlapNumbers under a "TODAY'S BOARD" label.
- **/wins** → moving magazine. Issue number, drop-cap first win, asymmetric grid,
  scroll-driven reveals, red reactions that bleed.
- **/work** → the platform. Giant split-flap session timer, ambient hum while
  focusing, a chime on completion. This is the screenshot moment.
- **/network** → "the concourse." Rooms as platforms with live tickers.
- **Nav** → glass concourse bar (you have `.st-glass`), active item lit in brass.

---

## 7. Sound & haptics (optional, high-impact)

- A single soft "station chime" (descending two-note) on: win posted, session done.
- Ambient low hum (toggleable, off by default) during a focus session.
- `navigator.vibrate` on mobile for primary actions.
- Ship muted by default; a tasteful sound toggle in the nav. Almost nobody does
  this well — it's pure differentiation.

---

## 8. Rollout (so we never break the working app)

- **Phase 0 — Atmosphere:** grain + halo + vignette + motion tokens + mono font.
  Global, zero layout change. Instant 50% lift. *(half a day)*
- **Phase 1 — Motion pass:** View Transitions + staggered entrances on existing
  pages. No redesign, just life. *(1 day)*
- **Phase 2 — Signature components:** SplitFlapNumber + DepartureRow, dropped into
  /home and /work. The "never seen before" lands here. *(1–2 days)*
- **Phase 3 — Editorial /wins + /network:** asymmetric kinetic layouts. *(2 days)*
- **Phase 4 — Sound/haptics polish.** *(optional)*

Each phase is independently shippable and reversible. The app keeps working the
whole way.

---

## 9. Decisions (locked 2026-06-05)

1. **Second accent: brass/amber `#d9c7a3`** — warm "lit board" glow, ambient use
   (numbers, hairlines, "departing" labels). Red stays the rare signal color.
2. **Sound: YES in v1, muted by default** — station chime on win/session-done +
   mobile haptics + a tasteful sound toggle in nav. Off until opted in.
3. **Both themes, full quality** — grain, brass halo, vignette, and the terminal
   motif all carry into **light mode** too. Light mode gets its own tuned values:
   grain lighter (~0.02), halo warm-white, vignette softer. Each phase ships both.
4. **First build: Phase 0 (Atmosphere)** when we resume — global grain + halo +
   vignette + motion tokens + mono font. No layout change.

### Still to decide (later, non-blocking)
- How bold on /wins — full magazine asymmetry vs. legible-first feed.
- Exact mono typeface (Geist Mono vs JetBrains Mono).
- The chime itself (two-note descending; source/synthesize).
