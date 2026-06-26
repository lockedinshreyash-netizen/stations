export const metadata = {
  title: "Stations — Back Soon",
  robots: { index: false, follow: false },
};

export default function MaintenancePage() {
  return (
    <div className="min-h-screen flex items-center justify-center px-6">
      <div className="max-w-sm w-full">
        <p
          className="text-xs tracking-widest uppercase mb-10"
          style={{ color: "rgba(var(--fg-rgb), 0.35)" }}
        >
          Stations
        </p>

        <h1
          className="text-2xl font-light leading-snug mb-8"
          style={{ color: "rgba(var(--fg-rgb), 0.9)" }}
        >
          Stations is temporarily paused.
        </h1>

        <p
          className="text-sm leading-relaxed"
          style={{ color: "rgba(var(--fg-rgb), 0.5)" }}
        >
          I&apos;m focusing completely on my exams for the next few months.
          <br />
          <br />
          Thank you for believing in Stations this early.
          <br />
          <br />
          I&apos;ll be back soon with a better platform.
        </p>

        <p
          className="text-sm mt-10"
          style={{ color: "rgba(var(--fg-rgb), 0.35)" }}
        >
          — Shreyash
        </p>
      </div>
    </div>
  );
}
