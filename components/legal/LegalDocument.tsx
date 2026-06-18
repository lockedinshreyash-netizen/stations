import Link from "next/link";

const CONTACT_EMAIL = "lockedinshreyash@gmail.com";

/**
 * Shared chrome for the legal pages (Privacy Policy, Terms of Service).
 * Server-rendered, theme-driven, and mobile-first so it reads well inside the
 * Play Store TWA, a browser, and the installed PWA alike. Content is supplied
 * as children built from the <Section> / <P> / <List> primitives below.
 */
export default function LegalDocument({
  title,
  lastUpdated,
  intro,
  children,
}: {
  title: string;
  lastUpdated: string;
  intro: string;
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen" style={{ background: "var(--bg-primary)" }}>
      {/* Header — wordmark links home, matching the rest of the app */}
      <header className="px-6 md:px-8 pt-8 pb-6 flex items-center justify-between max-w-3xl mx-auto w-full">
        <Link
          href="/"
          className="font-poppins font-black tracking-widest uppercase text-[rgb(var(--fg-rgb))]"
          style={{ fontSize: "16px", letterSpacing: "0.2em" }}
        >
          STATIONS
        </Link>
        <Link
          href="/"
          className="font-poppins font-light text-[rgba(var(--fg-rgb),0.4)] hover:text-[rgba(var(--fg-rgb),0.7)] transition-colors"
          style={{ fontSize: "15px" }}
        >
          ← Back
        </Link>
      </header>

      <main className="px-6 md:px-8 pb-24 max-w-3xl mx-auto w-full st-rise">
        <p
          className="font-poppins uppercase tracking-[0.2em] text-[var(--accent)]"
          style={{ fontSize: "13px", marginBottom: "16px" }}
        >
          Legal
        </p>
        <h1
          className="font-playfair italic text-[rgb(var(--fg-rgb))] leading-[1.05]"
          style={{ fontSize: "clamp(2.25rem, 7vw, 3.25rem)" }}
        >
          {title}
        </h1>
        <p
          className="font-poppins font-light text-[rgba(var(--fg-rgb),0.4)]"
          style={{ fontSize: "14px", marginTop: "14px" }}
        >
          Last updated: {lastUpdated}
        </p>

        <p
          className="font-poppins font-light text-[rgba(var(--fg-rgb),0.6)] leading-relaxed"
          style={{ fontSize: "17px", marginTop: "28px" }}
        >
          {intro}
        </p>

        <div style={{ marginTop: "8px" }}>{children}</div>

        {/* Footer — contact + cross-links */}
        <footer
          className="mt-16 pt-8"
          style={{ borderTop: "0.5px solid rgba(var(--fg-rgb),0.12)" }}
        >
          <p
            className="font-poppins font-light text-[rgba(var(--fg-rgb),0.5)]"
            style={{ fontSize: "15px", lineHeight: 1.7 }}
          >
            Questions? Reach us at{" "}
            <a
              href={`mailto:${CONTACT_EMAIL}`}
              className="text-[rgb(var(--fg-rgb))] underline underline-offset-4"
            >
              {CONTACT_EMAIL}
            </a>
            .
          </p>
          <div
            className="flex flex-wrap gap-x-6 gap-y-2"
            style={{ marginTop: "20px" }}
          >
            <Link
              href="/privacy"
              className="font-poppins font-light text-[rgba(var(--fg-rgb),0.4)] hover:text-[rgb(var(--fg-rgb))] transition-colors underline underline-offset-4"
              style={{ fontSize: "14px" }}
            >
              Privacy Policy
            </Link>
            <Link
              href="/terms"
              className="font-poppins font-light text-[rgba(var(--fg-rgb),0.4)] hover:text-[rgb(var(--fg-rgb))] transition-colors underline underline-offset-4"
              style={{ fontSize: "14px" }}
            >
              Terms of Service
            </Link>
            <a
              href={`mailto:${CONTACT_EMAIL}`}
              className="font-poppins font-light text-[rgba(var(--fg-rgb),0.4)] hover:text-[rgb(var(--fg-rgb))] transition-colors underline underline-offset-4"
              style={{ fontSize: "14px" }}
            >
              Contact
            </a>
          </div>
        </footer>
      </main>
    </div>
  );
}

/** A titled section with a brass hairline lead-in. */
export function Section({
  heading,
  children,
}: {
  heading: string;
  children: React.ReactNode;
}) {
  return (
    <section style={{ marginTop: "40px" }}>
      <h2
        className="font-poppins font-black text-[rgb(var(--fg-rgb))]"
        style={{
          fontSize: "20px",
          letterSpacing: "0.01em",
          paddingLeft: "14px",
          borderLeft: "2px solid var(--accent)",
        }}
      >
        {heading}
      </h2>
      <div style={{ marginTop: "16px" }}>{children}</div>
    </section>
  );
}

/** Body paragraph with comfortable measure and line height. */
export function P({ children }: { children: React.ReactNode }) {
  return (
    <p
      className="font-poppins font-light text-[rgba(var(--fg-rgb),0.7)] leading-relaxed"
      style={{ fontSize: "16px", marginTop: "12px" }}
    >
      {children}
    </p>
  );
}

/** Bulleted list with brass markers. */
export function List({ items }: { items: React.ReactNode[] }) {
  return (
    <ul style={{ marginTop: "14px", display: "flex", flexDirection: "column", gap: "10px" }}>
      {items.map((item, i) => (
        <li
          key={i}
          className="font-poppins font-light text-[rgba(var(--fg-rgb),0.7)] leading-relaxed"
          style={{
            fontSize: "16px",
            paddingLeft: "20px",
            position: "relative",
          }}
        >
          <span
            aria-hidden
            style={{
              position: "absolute",
              left: 0,
              top: "0.65em",
              width: "6px",
              height: "6px",
              borderRadius: "50%",
              background: "var(--accent-2)",
            }}
          />
          {item}
        </li>
      ))}
    </ul>
  );
}

export { CONTACT_EMAIL };
