"use client";

import { useState, useCallback } from "react";
import Link from "next/link";
import {
  Download,
  Share,
  Plus,
  Check,
  Maximize2,
  WifiOff,
  Bell,
  ArrowRight,
} from "lucide-react";
import { tap } from "@/lib/feedback";
import { useInstallPrompt } from "@/lib/use-install-prompt";

/**
 * The dedicated, shareable "get the app" screen. Stations ships as a PWA
 * (install-to-home-screen), so this page is the one place that walks every
 * platform to an installed app:
 *  - Chromium (Android / desktop): one-tap native install dialog.
 *  - iOS Safari: there's no programmatic prompt, so reveal the manual
 *    Share → Add to Home Screen steps.
 *  - Already installed: confirm + a way straight into the app.
 *  - Anything else: a gentle nudge to open in a supported browser, so the
 *    primary action is never a dead end.
 *
 * Visual language is the app's modern-glass aesthetic (frosted card, soft
 * aurora glow, brass accent). Atmosphere + grain come from the root layout.
 */

const BENEFITS = [
  {
    icon: Maximize2,
    title: "Full-screen, no browser",
    body: "Opens like a native app — straight from your home screen.",
  },
  {
    icon: WifiOff,
    title: "Works offline",
    body: "Your sessions and wins stay with you, even off the grid.",
  },
  {
    icon: Bell,
    title: "Instant notifications",
    body: "Never miss a session, a message, or a partner's nudge.",
  },
] as const;

export default function DownloadScreen() {
  const { mounted, installed, isIOS, canPrompt, promptInstall } =
    useInstallPrompt();
  const [showIosHelp, setShowIosHelp] = useState(false);

  const handleInstall = useCallback(async () => {
    tap();
    if (isIOS) {
      setShowIosHelp((v) => !v);
      return;
    }
    const outcome = await promptInstall();
    // No captured prompt (unsupported browser, or not yet eligible): surface the
    // manual hint so the button is never a dead end.
    if (outcome === "unavailable") setShowIosHelp((v) => !v);
  }, [isIOS, promptInstall]);

  // Avoid an SSR/first-paint flash before we know the platform/installed state.
  if (!mounted) return null;

  const ctaLabel = isIOS
    ? "How to install"
    : canPrompt
      ? "Install Stations"
      : "Get the app";

  return (
    <main className="relative min-h-screen overflow-hidden">
      {/* Soft aurora glow behind the hero — calm ambience, not a theme. */}
      <div className="st-aurora" aria-hidden="true" />

      <div
        className="relative z-[2] mx-auto flex min-h-screen w-full max-w-md flex-col items-center justify-center px-6 py-16 text-center"
        style={{
          paddingTop: "calc(env(safe-area-inset-top, 0px) + 4rem)",
          paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 4rem)",
        }}
      >
        <div className="st-stagger flex w-full flex-col items-center">
          {/* App icon */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/icon-192.png"
            alt="Stations"
            width={88}
            height={88}
            className="rounded-3xl shadow-2xl"
            style={{ width: 88, height: 88 }}
          />

          {/* Eyebrow */}
          <p className="mt-8 font-poppins text-sm uppercase tracking-[0.2em] text-accent-brass">
            {installed ? "Installed" : "The Stations app"}
          </p>

          {/* Headline */}
          <h1 className="mt-3 font-playfair text-4xl italic leading-[1.1] text-text-primary md:text-5xl">
            {installed
              ? "You're all set."
              : "Stations, on your home screen."}
          </h1>

          {/* Subcopy */}
          <p className="mt-4 max-w-sm text-lg font-light leading-relaxed text-text-secondary">
            {installed
              ? "The app is installed on this device. Jump back in whenever you're ready."
              : "Install the app for a full-screen, offline-ready home for your most ambitious work."}
          </p>

          {/* ── Already installed ─────────────────────────────────── */}
          {installed ? (
            <Link
              href="/wins"
              onClick={() => tap()}
              className="st-btn mt-10 flex w-full items-center justify-center gap-2 rounded-xl bg-accent-brass px-6 py-4 text-base font-semibold text-bg-primary"
            >
              Open Stations
              <ArrowRight size={18} />
            </Link>
          ) : (
            <>
              {/* Benefits card */}
              <div className="st-card st-glass mt-10 w-full rounded-2xl border p-5 text-left">
                <ul className="flex flex-col gap-5">
                  {BENEFITS.map(({ icon: Icon, title, body }) => (
                    <li key={title} className="flex items-start gap-4">
                      <span className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[rgba(var(--accent-2-rgb),0.12)] text-accent-brass">
                        <Icon size={20} />
                      </span>
                      <div className="min-w-0">
                        <p className="font-medium text-text-primary">{title}</p>
                        <p className="mt-0.5 text-sm leading-snug text-text-secondary">
                          {body}
                        </p>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>

              {/* iOS manual steps */}
              {showIosHelp ? (
                <div className="st-card st-glass mt-4 w-full rounded-2xl border p-5 text-left">
                  <p className="mb-3 font-medium text-text-primary">
                    {isIOS ? "Add to Home Screen" : "Install from your browser"}
                  </p>
                  {isIOS ? (
                    <ol className="flex flex-col gap-2.5 text-sm text-text-secondary">
                      <li className="flex items-center gap-2">
                        <StepDot n={1} />
                        <span>Tap</span>
                        <Share size={16} className="text-accent-brass" />
                        <span>in the Safari toolbar</span>
                      </li>
                      <li className="flex items-center gap-2">
                        <StepDot n={2} />
                        <span>Choose</span>
                        <Plus size={16} className="text-accent-brass" />
                        <span>“Add to Home Screen”</span>
                      </li>
                      <li className="flex items-center gap-2">
                        <StepDot n={3} />
                        <span>Tap “Add” — done.</span>
                      </li>
                    </ol>
                  ) : (
                    <p className="text-sm leading-relaxed text-text-secondary">
                      Open this page in Chrome (Android) or Safari (iPhone), then
                      use your browser menu and choose{" "}
                      <span className="text-text-primary">
                        “Install app”
                      </span>{" "}
                      or{" "}
                      <span className="text-text-primary">
                        “Add to Home Screen.”
                      </span>
                    </p>
                  )}
                </div>
              ) : null}

              {/* Primary CTA */}
              <button
                onClick={handleInstall}
                className="st-btn mt-6 flex w-full items-center justify-center gap-2 rounded-xl bg-accent-brass px-6 py-4 text-base font-semibold text-bg-primary"
              >
                <Download size={18} />
                {ctaLabel}
              </button>

              {/* Trust line */}
              <p className="mt-5 flex items-center justify-center gap-1.5 text-sm font-light text-text-muted">
                <Check size={14} className="text-accent-brass" />
                Free · No app store needed · Installs in seconds
              </p>
            </>
          )}
        </div>
      </div>
    </main>
  );
}

function StepDot({ n }: { n: number }) {
  return (
    <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[rgba(var(--accent-2-rgb),0.15)] text-xs font-semibold text-accent-brass">
      {n}
    </span>
  );
}
