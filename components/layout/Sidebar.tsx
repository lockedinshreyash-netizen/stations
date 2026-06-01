"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { User } from "@/types";

const NAV = [
  { number: "01", label: "WINS", href: "/wins" },
  { number: "02", label: "NETWORK", href: "/network" },
  { number: "03", label: "ARCHIVE", href: "/archive" },
  { number: "04", label: "WORK", href: "/work" },
  { number: "05", label: "FOCUS", href: "/focus" },
];

function TierLabel({ tier }: { tier: User["membership_tier"] }) {
  const color =
    tier === "founding"
      ? "#c0392b"
      : tier === "paid"
      ? "rgba(240,235,224,0.4)"
      : "rgba(240,235,224,0.2)";
  const label = tier === "founding" ? "FOUNDING" : tier === "paid" ? "MEMBER" : "FREE";
  return (
    <span
      className="font-poppins uppercase"
      style={{ fontSize: "9px", letterSpacing: "0.15em", color }}
    >
      {label}
    </span>
  );
}

interface SidebarProps {
  user: User;
  collapsed: boolean;
  onToggle: () => void;
}

export default function Sidebar({ user, collapsed, onToggle }: SidebarProps) {
  const pathname = usePathname();

  return (
    <aside
      className="shrink-0 h-screen sticky top-0 flex flex-col overflow-hidden"
      style={{
        width: collapsed ? "64px" : "200px",
        background: "#0d0d0d",
        borderRight: "0.5px solid rgba(240,235,224,0.08)",
        transition: "width 250ms ease",
      }}
    >
      {/* Wordmark + toggle */}
      <div
        className="flex items-start justify-between"
        style={{ padding: "28px 20px 32px" }}
      >
        <div className="flex flex-col" style={{ gap: "6px" }}>
          <span
            className="font-poppins font-black text-[#f0ebe0] uppercase leading-none whitespace-nowrap"
            style={{ fontSize: "18px", letterSpacing: "0.25em" }}
          >
            {collapsed ? "S" : "STATIONS"}
          </span>
          {/* Red underline accent */}
          <div style={{ width: "24px", height: "0.5px", background: "#c0392b" }} />
        </div>

        {/* Collapse toggle */}
        <button
          onClick={onToggle}
          className="shrink-0 flex items-center justify-center transition-colors hover:text-[#f0ebe0]"
          style={{
            color: "rgba(240,235,224,0.3)",
            marginTop: "2px",
            padding: "2px",
            background: "none",
            border: "none",
            cursor: "pointer",
          }}
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          {/* Chevron — rotates based on collapsed state */}
          <svg
            width="14"
            height="14"
            viewBox="0 0 14 14"
            fill="none"
            style={{
              transform: collapsed ? "rotate(180deg)" : "rotate(0deg)",
              transition: "transform 250ms ease",
            }}
          >
            <path
              d="M9 3L5 7L9 11"
              stroke="currentColor"
              strokeWidth="1"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </button>
      </div>

      {/* Navigation */}
      <nav className="flex-1 flex flex-col" style={{ gap: "4px", paddingLeft: "0", paddingRight: "0" }}>
        {NAV.map(({ number, label, href }) => {
          const active = pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              className="group flex flex-col relative"
              style={{
                paddingTop: "10px",
                paddingBottom: "10px",
                paddingLeft: collapsed ? "0" : "20px",
                paddingRight: "12px",
                gap: "3px",
                alignItems: collapsed ? "center" : "flex-start",
                borderLeft: active ? "2px solid #c0392b" : "2px solid transparent",
                transition: "border-color 150ms ease",
              }}
            >
              {collapsed ? (
                /* Collapsed: number only, centered */
                <span
                  className="font-playfair italic"
                  style={{
                    fontSize: "11px",
                    color: active ? "#c0392b" : "rgba(240,235,224,0.35)",
                    lineHeight: 1,
                    transition: "color 150ms ease",
                  }}
                >
                  {number}
                </span>
              ) : (
                /* Expanded: number above, name below */
                <>
                  <span
                    className="font-playfair italic"
                    style={{
                      fontSize: "10px",
                      color: active ? "#c0392b" : "rgba(240,235,224,0.3)",
                      lineHeight: 1,
                      transition: "color 150ms ease",
                    }}
                  >
                    {number} —
                  </span>
                  <span
                    className="font-poppins font-black uppercase"
                    style={{
                      fontSize: "12px",
                      letterSpacing: "0.2em",
                      lineHeight: 1.1,
                      color: active
                        ? "#f0ebe0"
                        : "rgba(240,235,224,0.4)",
                      transition: "color 150ms ease",
                    }}
                  >
                    {label}
                  </span>
                </>
              )}
            </Link>
          );
        })}
      </nav>

      {/* User footer */}
      <div
        style={{
          borderTop: "0.5px solid rgba(240,235,224,0.08)",
          padding: collapsed ? "16px 0" : "16px 20px",
          display: "flex",
          alignItems: "center",
          justifyContent: collapsed ? "center" : "flex-start",
          gap: "10px",
        }}
      >
        {/* Avatar */}
        <div
          className="shrink-0 flex items-center justify-center overflow-hidden"
          style={{ width: "28px", height: "28px", background: "#1a1a1a", borderRadius: "50%" }}
        >
          {user.avatar_url ? (
            <img
              src={user.avatar_url}
              alt={user.username}
              className="w-full h-full object-cover"
            />
          ) : (
            <span
              className="font-poppins uppercase text-[rgba(240,235,224,0.5)]"
              style={{ fontSize: "11px", fontWeight: 500 }}
            >
              {user.username[0]}
            </span>
          )}
        </div>

        {/* Username + tier — hidden when collapsed */}
        {!collapsed && (
          <div className="flex flex-col min-w-0" style={{ gap: "3px" }}>
            <span
              className="font-poppins font-light text-[#f0ebe0] truncate"
              style={{ fontSize: "12px" }}
            >
              {user.username}
            </span>
            <TierLabel tier={user.membership_tier} />
          </div>
        )}
      </div>
    </aside>
  );
}
