import Link from "next/link";

const CONTACT_EMAIL = "lockedinshreyash@gmail.com";

/**
 * Compact legal footer for public surfaces (login, the join funnel). Surfaces
 * the Privacy Policy, Terms, and a Contact mailto — required for Play Store
 * listings and a baseline trust signal. Muted to stay out of the way.
 */
export default function LegalFooter({
  className = "",
}: {
  className?: string;
}) {
  const linkClass =
    "font-poppins font-light text-[rgba(var(--fg-rgb),0.35)] hover:text-[rgba(var(--fg-rgb),0.7)] transition-colors";
  return (
    <footer
      className={`flex flex-wrap items-center gap-x-5 gap-y-2 ${className}`}
      style={{ fontSize: "13px" }}
    >
      <Link href="/privacy" className={linkClass}>
        Privacy Policy
      </Link>
      <span style={{ color: "rgba(var(--fg-rgb),0.15)" }} aria-hidden>
        ·
      </span>
      <Link href="/terms" className={linkClass}>
        Terms
      </Link>
      <span style={{ color: "rgba(var(--fg-rgb),0.15)" }} aria-hidden>
        ·
      </span>
      <a href={`mailto:${CONTACT_EMAIL}`} className={linkClass}>
        Contact
      </a>
    </footer>
  );
}
