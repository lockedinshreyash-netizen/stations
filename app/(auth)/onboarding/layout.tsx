"use client";

import { usePathname } from "next/navigation";

const STEPS = [
  { path: "/onboarding/step-1", label: "Account" },
  { path: "/onboarding/step-2", label: "Profile" },
  { path: "/onboarding/step-3", label: "About you" },
  { path: "/onboarding/founder", label: "Founder code" },
  { path: "/onboarding/step-4", label: "Why Stations" },
];

export default function OnboardingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const currentIndex = STEPS.findIndex((s) => pathname.includes(s.path));
  const stepNumber = currentIndex + 1;

  return (
    <div className="min-h-screen bg-[var(--bg-primary)] flex flex-col">
      {/* Header */}
      <header className="px-6 md:px-8 pt-8 pb-0 flex items-center justify-between">
        <span className="font-poppins font-black text-xl tracking-widest uppercase text-[rgb(var(--fg-rgb))]">
          STATIONS
        </span>
        <span className="text-[rgba(var(--fg-rgb),0.3)] text-base font-light tracking-widest uppercase">
          Step {stepNumber} of {STEPS.length}
        </span>
      </header>

      {/* Progress bar */}
      <div className="px-6 md:px-8 mt-6">
        <div className="flex gap-2">
          {STEPS.map((_, i) => (
            <div
              key={i}
              className="h-[3px] flex-1 rounded-full transition-all duration-500"
              style={{
                background:
                  i < stepNumber
                    ? "var(--accent)"
                    : "rgba(var(--fg-rgb),0.1)",
              }}
            />
          ))}
        </div>
      </div>

      {/* Content */}
      <main className="flex-1 flex flex-col">{children}</main>
    </div>
  );
}
