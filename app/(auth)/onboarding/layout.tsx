"use client";

import { usePathname } from "next/navigation";

const STEPS = [
  { path: "/onboarding/step-1", label: "Account" },
  { path: "/onboarding/step-2", label: "Profile" },
  { path: "/onboarding/step-3", label: "About you" },
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
    <div className="min-h-screen bg-[#0a0a0a] flex flex-col">
      {/* Header */}
      <header className="px-8 pt-8 pb-0 flex items-center justify-between">
        <span className="font-poppins font-black text-xl tracking-widest uppercase text-[#f0ebe0]">
          STATIONS
        </span>
        <span className="text-[rgba(240,235,224,0.3)] text-sm font-light tracking-widest uppercase">
          Step {stepNumber} of 4
        </span>
      </header>

      {/* Progress bar */}
      <div className="px-8 mt-6">
        <div className="flex gap-2">
          {STEPS.map((_, i) => (
            <div
              key={i}
              className="h-[2px] flex-1 transition-all duration-500"
              style={{
                background:
                  i < stepNumber
                    ? "#c0392b"
                    : "rgba(240,235,224,0.1)",
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
